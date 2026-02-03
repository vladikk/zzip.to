const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// --- Mock CloudFront KeyValueStore client ---
let lastDescribeInput = null;
let lastPutInput = null;
let lastDeleteInput = null;
let mockETag = 'mock-etag-123';
let mockDescribeError = null;
let mockPutError = null;
let mockDeleteError = null;
let putCallCount = 0;
let deleteCallCount = 0;
let describeCallCount = 0;

function resetMocks() {
  lastDescribeInput = null;
  lastPutInput = null;
  lastDeleteInput = null;
  mockETag = 'mock-etag-123';
  mockDescribeError = null;
  mockPutError = null;
  mockDeleteError = null;
  putCallCount = 0;
  deleteCallCount = 0;
  describeCallCount = 0;
}

let mockPutETag = 'mock-etag-after-put';
let mockDeleteETag = 'mock-etag-after-delete';

// Mock send function
function mockSend(command) {
  if (command._type === 'DescribeKeyValueStore') {
    describeCallCount++;
    lastDescribeInput = command.input;
    if (mockDescribeError) throw mockDescribeError;
    return { ETag: mockETag };
  }
  if (command._type === 'PutKey') {
    putCallCount++;
    lastPutInput = command.input;
    if (mockPutError) throw mockPutError;
    return { ETag: mockPutETag };
  }
  if (command._type === 'DeleteKey') {
    deleteCallCount++;
    lastDeleteInput = command.input;
    if (mockDeleteError) throw mockDeleteError;
    return { ETag: mockDeleteETag };
  }
  throw new Error(`Unknown command: ${command._type}`);
}

// Command constructors matching the SDK pattern
function DescribeKeyValueStoreCommand(input) {
  return { _type: 'DescribeKeyValueStore', input };
}
function PutKeyCommand(input) {
  return { _type: 'PutKey', input };
}
function DeleteKeyCommand(input) {
  return { _type: 'DeleteKey', input };
}

// --- Replicate KVS sync handler logic from CloudFormation inline code ---
function createKvsSyncHandler(kvsArn) {
  async function getETag() {
    const resp = await mockSend(new DescribeKeyValueStoreCommand({ KvsARN: kvsArn }));
    return resp.ETag;
  }

  return async (event) => {
    let currentEtag = await getETag();
    for (const record of event.Records) {
      const eventName = record.eventName;
      try {
        if (eventName === 'INSERT' || eventName === 'MODIFY') {
          const newImage = record.dynamodb.NewImage;
          const key = newImage.key.S;
          const value = newImage.value.S;
          try {
            const result = await mockSend(new PutKeyCommand({
              KvsARN: kvsArn,
              Key: key,
              Value: value,
              IfMatch: currentEtag
            }));
            currentEtag = result.ETag;
          } catch (putErr) {
            if (putErr.name === 'ConflictException') {
              currentEtag = await getETag();
              const result = await mockSend(new PutKeyCommand({
                KvsARN: kvsArn,
                Key: key,
                Value: value,
                IfMatch: currentEtag
              }));
              currentEtag = result.ETag;
            } else {
              throw putErr;
            }
          }
        } else if (eventName === 'REMOVE') {
          const oldImage = record.dynamodb.OldImage;
          const key = oldImage.key.S;
          try {
            const result = await mockSend(new DeleteKeyCommand({
              KvsARN: kvsArn,
              Key: key,
              IfMatch: currentEtag
            }));
            currentEtag = result.ETag;
          } catch (deleteErr) {
            if (deleteErr.name === 'ResourceNotFoundException') {
              currentEtag = await getETag();
            } else if (deleteErr.name === 'ConflictException') {
              currentEtag = await getETag();
              const result = await mockSend(new DeleteKeyCommand({
                KvsARN: kvsArn,
                Key: key,
                IfMatch: currentEtag
              }));
              currentEtag = result.ETag;
            } else {
              throw deleteErr;
            }
          }
        }
      } catch (err) {
        console.error(`Error processing ${eventName} for record:`, JSON.stringify(record), err);
        throw err;
      }
    }
  };
}

const TEST_KVS_ARN = 'arn:aws:cloudfront::123456789012:key-value-store/test-kvs';

describe('KVS Sync Lambda', () => {
  let handler;

  beforeEach(() => {
    resetMocks();
    handler = createKvsSyncHandler(TEST_KVS_ARN);
  });

  describe('INSERT events', () => {
    it('should put key in KVS when a new item is inserted', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              key: { S: 'gh' },
              value: { S: 'https://github.com' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(describeCallCount, 1);
      assert.strictEqual(putCallCount, 1);
      assert.deepStrictEqual(lastPutInput, {
        KvsARN: TEST_KVS_ARN,
        Key: 'gh',
        Value: 'https://github.com',
        IfMatch: 'mock-etag-123'
      });
    });

    it('should handle wildcard redirect values', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              key: { S: 'docs' },
              value: { S: 'https://docs.example.com/*' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(putCallCount, 1);
      assert.strictEqual(lastPutInput.Value, 'https://docs.example.com/*');
    });
  });

  describe('MODIFY events', () => {
    it('should update key in KVS when an item is modified', async () => {
      const event = {
        Records: [{
          eventName: 'MODIFY',
          dynamodb: {
            NewImage: {
              key: { S: 'gh' },
              value: { S: 'https://github.com/new-org' }
            },
            OldImage: {
              key: { S: 'gh' },
              value: { S: 'https://github.com' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(putCallCount, 1);
      assert.deepStrictEqual(lastPutInput, {
        KvsARN: TEST_KVS_ARN,
        Key: 'gh',
        Value: 'https://github.com/new-org',
        IfMatch: 'mock-etag-123'
      });
    });
  });

  describe('REMOVE events', () => {
    it('should delete key from KVS when an item is removed', async () => {
      const event = {
        Records: [{
          eventName: 'REMOVE',
          dynamodb: {
            OldImage: {
              key: { S: 'gh' },
              value: { S: 'https://github.com' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(describeCallCount, 1);
      assert.strictEqual(deleteCallCount, 1);
      assert.deepStrictEqual(lastDeleteInput, {
        KvsARN: TEST_KVS_ARN,
        Key: 'gh',
        IfMatch: 'mock-etag-123'
      });
    });

    it('should handle ResourceNotFoundException gracefully on delete', async () => {
      const notFoundErr = new Error('ResourceNotFoundException');
      notFoundErr.name = 'ResourceNotFoundException';
      mockDeleteError = notFoundErr;

      const event = {
        Records: [{
          eventName: 'REMOVE',
          dynamodb: {
            OldImage: {
              key: { S: 'already-deleted' },
              value: { S: 'https://example.com' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(deleteCallCount, 1);
      // Should have called describe twice: once initial, once to refresh after ResourceNotFoundException
      assert.strictEqual(describeCallCount, 2);
    });

    it('should retry with fresh ETag on ConflictException for DELETE', async () => {
      let customDeleteCount = 0;
      let customDescribeCount = 0;
      const customHandler = async (event) => {
        function send(command) {
          if (command._type === 'DescribeKeyValueStore') {
            customDescribeCount++;
            return { ETag: customDescribeCount === 1 ? 'stale-etag' : 'fresh-etag' };
          }
          if (command._type === 'DeleteKey') {
            customDeleteCount++;
            if (customDeleteCount === 1) {
              const err = new Error('ConflictException');
              err.name = 'ConflictException';
              throw err;
            }
            return { ETag: 'after-delete-etag' };
          }
          throw new Error(`Unknown command: ${command._type}`);
        }

        async function getETag() {
          const resp = await send(new DescribeKeyValueStoreCommand({ KvsARN: TEST_KVS_ARN }));
          return resp.ETag;
        }

        let currentEtag = await getETag();
        for (const record of event.Records) {
          const eventName = record.eventName;
          if (eventName === 'REMOVE') {
            const oldImage = record.dynamodb.OldImage;
            const key = oldImage.key.S;
            try {
              const result = await send(new DeleteKeyCommand({
                KvsARN: TEST_KVS_ARN, Key: key, IfMatch: currentEtag
              }));
              currentEtag = result.ETag;
            } catch (deleteErr) {
              if (deleteErr.name === 'ConflictException') {
                currentEtag = await getETag();
                const result = await send(new DeleteKeyCommand({
                  KvsARN: TEST_KVS_ARN, Key: key, IfMatch: currentEtag
                }));
                currentEtag = result.ETag;
              } else {
                throw deleteErr;
              }
            }
          }
        }
      };

      const event = {
        Records: [{
          eventName: 'REMOVE',
          dynamodb: {
            OldImage: {
              key: { S: 'conflict-delete-test' },
              value: { S: 'https://example.com' }
            }
          }
        }]
      };

      await customHandler(event);

      assert.strictEqual(customDescribeCount, 2, 'should describe twice (initial + retry)');
      assert.strictEqual(customDeleteCount, 2, 'should delete twice (fail + retry)');
    });
  });

  describe('Multiple records', () => {
    it('should process multiple records in a single event', async () => {
      const event = {
        Records: [
          {
            eventName: 'INSERT',
            dynamodb: {
              NewImage: {
                key: { S: 'gh' },
                value: { S: 'https://github.com' }
              }
            }
          },
          {
            eventName: 'INSERT',
            dynamodb: {
              NewImage: {
                key: { S: 'aws' },
                value: { S: 'https://console.aws.amazon.com' }
              }
            }
          },
          {
            eventName: 'REMOVE',
            dynamodb: {
              OldImage: {
                key: { S: 'old' },
                value: { S: 'https://old.example.com' }
              }
            }
          }
        ]
      };

      await handler(event);

      assert.strictEqual(putCallCount, 2);
      assert.strictEqual(deleteCallCount, 1);
      assert.strictEqual(describeCallCount, 1);
    });
  });

  describe('ETag handling', () => {
    it('should fetch ETag once before processing records', async () => {
      const event = {
        Records: [{
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              key: { S: 'test' },
              value: { S: 'https://test.com' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(describeCallCount, 1);
      assert.deepStrictEqual(lastDescribeInput, { KvsARN: TEST_KVS_ARN });
    });

    it('should retry with fresh ETag on ConflictException for PUT', async () => {
      let customDescribeCount = 0;
      let customPutCount = 0;
      const customHandler = async (event) => {
        function send(command) {
          if (command._type === 'DescribeKeyValueStore') {
            customDescribeCount++;
            return { ETag: customDescribeCount === 1 ? 'stale-etag' : 'fresh-etag' };
          }
          if (command._type === 'PutKey') {
            customPutCount++;
            if (customPutCount === 1) {
              const err = new Error('ConflictException');
              err.name = 'ConflictException';
              throw err;
            }
            return { ETag: 'after-put-etag' };
          }
          throw new Error(`Unknown command: ${command._type}`);
        }

        async function getETag() {
          const resp = await send(new DescribeKeyValueStoreCommand({ KvsARN: TEST_KVS_ARN }));
          return resp.ETag;
        }

        let currentEtag = await getETag();
        for (const record of event.Records) {
          const eventName = record.eventName;
          if (eventName === 'INSERT' || eventName === 'MODIFY') {
            const newImage = record.dynamodb.NewImage;
            const key = newImage.key.S;
            const value = newImage.value.S;
            try {
              const result = await send(new PutKeyCommand({
                KvsARN: TEST_KVS_ARN, Key: key, Value: value, IfMatch: currentEtag
              }));
              currentEtag = result.ETag;
            } catch (putErr) {
              if (putErr.name === 'ConflictException') {
                currentEtag = await getETag();
                const result = await send(new PutKeyCommand({
                  KvsARN: TEST_KVS_ARN, Key: key, Value: value, IfMatch: currentEtag
                }));
                currentEtag = result.ETag;
              } else {
                throw putErr;
              }
            }
          }
        }
      };

      const event = {
        Records: [{
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              key: { S: 'conflict-test' },
              value: { S: 'https://conflict.example.com' }
            }
          }
        }]
      };

      await customHandler(event);

      assert.strictEqual(customDescribeCount, 2, 'should describe twice (initial + retry)');
      assert.strictEqual(customPutCount, 2, 'should put twice (fail + retry)');
    });

    it('should use returned ETag from previous operation for next operation', async () => {
      const event = {
        Records: [
          {
            eventName: 'INSERT',
            dynamodb: {
              NewImage: {
                key: { S: 'first' },
                value: { S: 'https://first.com' }
              }
            }
          },
          {
            eventName: 'INSERT',
            dynamodb: {
              NewImage: {
                key: { S: 'second' },
                value: { S: 'https://second.com' }
              }
            }
          }
        ]
      };

      await handler(event);

      // Should only describe once (at the start), not per-record
      assert.strictEqual(describeCallCount, 1);
      assert.strictEqual(putCallCount, 2);
    });
  });

  describe('Error handling', () => {
    it('should throw when KVS put fails', async () => {
      mockPutError = new Error('KVS put failed');
      const event = {
        Records: [{
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              key: { S: 'test' },
              value: { S: 'https://test.com' }
            }
          }
        }]
      };

      await assert.rejects(() => handler(event), { message: 'KVS put failed' });
    });

    it('should throw when KVS delete fails', async () => {
      mockDeleteError = new Error('KVS delete failed');
      const event = {
        Records: [{
          eventName: 'REMOVE',
          dynamodb: {
            OldImage: {
              key: { S: 'test' },
              value: { S: 'https://test.com' }
            }
          }
        }]
      };

      await assert.rejects(() => handler(event), { message: 'KVS delete failed' });
    });

    it('should throw when describe KVS fails', async () => {
      mockDescribeError = new Error('Describe failed');
      const event = {
        Records: [{
          eventName: 'INSERT',
          dynamodb: {
            NewImage: {
              key: { S: 'test' },
              value: { S: 'https://test.com' }
            }
          }
        }]
      };

      await assert.rejects(() => handler(event), { message: 'Describe failed' });
    });
  });

  describe('Unknown event types', () => {
    it('should skip unknown event types without error', async () => {
      const event = {
        Records: [{
          eventName: 'UNKNOWN_EVENT',
          dynamodb: {
            NewImage: {
              key: { S: 'test' },
              value: { S: 'https://test.com' }
            }
          }
        }]
      };

      await handler(event);

      assert.strictEqual(putCallCount, 0);
      assert.strictEqual(deleteCallCount, 0);
      // ETag is fetched once at the start regardless of event types
      assert.strictEqual(describeCallCount, 1);
    });
  });
});
