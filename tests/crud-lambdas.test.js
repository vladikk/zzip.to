const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// --- Mock DynamoDB client ---
let mockScanResult = {};
let mockPutResult = {};
let mockDeleteResult = {};
let lastScanInput = null;
let lastPutInput = null;
let lastDeleteInput = null;
let mockScanError = null;
let mockPutError = null;
let mockDeleteError = null;

function resetMocks() {
  mockScanResult = { Items: [] };
  mockPutResult = {};
  mockDeleteResult = {};
  lastScanInput = null;
  lastPutInput = null;
  lastDeleteInput = null;
  mockScanError = null;
  mockPutError = null;
  mockDeleteError = null;
}

// --- Replicate Lambda handler logic from CloudFormation inline code ---

// ListLinks handler logic
function createListLinksHandler(tableName, adminOrigin) {
  return async (event) => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': adminOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    };
    try {
      if (mockScanError) throw mockScanError;
      lastScanInput = { TableName: tableName };
      const result = mockScanResult;
      const items = (result.Items || []).map(item => ({
        key: item.key.S,
        value: item.value.S
      })).sort((a, b) => a.key.localeCompare(b.key));
      return { statusCode: 200, headers, body: JSON.stringify(items) };
    } catch (err) {
      console.error('Error listing links:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
  };
}

// CreateLink handler logic
function createCreateLinkHandler(tableName, adminOrigin) {
  return async (event) => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': adminOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'PUT,DELETE,OPTIONS'
    };
    try {
      const key = event.pathParameters && event.pathParameters.key;
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing key parameter' }) };
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid key format. Only alphanumeric characters, hyphens, and underscores are allowed.' }) };
      }
      if (key.length > 128) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Key must be 128 characters or fewer' }) };
      }
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
      }
      const value = body.value;
      if (!value || typeof value !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing or invalid value field' }) };
      }
      const urlPattern = /^https?:\/\/.+/;
      const isWildcard = value.endsWith('/*');
      const urlToValidate = isWildcard ? value.slice(0, -2) : value;
      if (!urlPattern.test(urlToValidate)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Value must be a valid HTTP/HTTPS URL' }) };
      }
      if (mockPutError) throw mockPutError;
      lastPutInput = {
        TableName: tableName,
        Item: { key: { S: key }, value: { S: value } }
      };
      return { statusCode: 200, headers, body: JSON.stringify({ key, value }) };
    } catch (err) {
      console.error('Error creating link:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
  };
}

// DeleteLink handler logic
function createDeleteLinkHandler(tableName, adminOrigin) {
  return async (event) => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': adminOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'PUT,DELETE,OPTIONS'
    };
    try {
      const key = event.pathParameters && event.pathParameters.key;
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing key parameter' }) };
      }
      if (mockDeleteError) throw mockDeleteError;
      lastDeleteInput = {
        TableName: tableName,
        Key: { key: { S: key } }
      };
      return { statusCode: 200, headers, body: JSON.stringify({ deleted: key }) };
    } catch (err) {
      console.error('Error deleting link:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
  };
}

const TABLE_NAME = 'test-links-table';
const ADMIN_ORIGIN = 'https://admin.zzip.to';

describe('ListLinks Lambda', () => {
  let handler;

  beforeEach(() => {
    resetMocks();
    handler = createListLinksHandler(TABLE_NAME, ADMIN_ORIGIN);
  });

  it('should return empty array when no items', async () => {
    mockScanResult = { Items: [] };
    const result = await handler({});
    assert.strictEqual(result.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(result.body), []);
  });

  it('should return items sorted by key', async () => {
    mockScanResult = {
      Items: [
        { key: { S: 'zoo' }, value: { S: 'https://zoo.com' } },
        { key: { S: 'abc' }, value: { S: 'https://abc.com' } },
        { key: { S: 'mid' }, value: { S: 'https://mid.com' } }
      ]
    };
    const result = await handler({});
    assert.strictEqual(result.statusCode, 200);
    const items = JSON.parse(result.body);
    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].key, 'abc');
    assert.strictEqual(items[1].key, 'mid');
    assert.strictEqual(items[2].key, 'zoo');
  });

  it('should include CORS headers', async () => {
    const result = await handler({});
    assert.strictEqual(result.headers['Access-Control-Allow-Origin'], ADMIN_ORIGIN);
    assert.strictEqual(result.headers['Access-Control-Allow-Headers'], 'Content-Type,Authorization');
    assert.strictEqual(result.headers['Access-Control-Allow-Methods'], 'GET,OPTIONS');
  });

  it('should return 500 on DynamoDB error', async () => {
    mockScanError = new Error('DynamoDB error');
    const result = await handler({});
    assert.strictEqual(result.statusCode, 500);
    assert.deepStrictEqual(JSON.parse(result.body), { error: 'Internal server error' });
  });

  it('should include CORS headers on error response', async () => {
    mockScanError = new Error('DynamoDB error');
    const result = await handler({});
    assert.strictEqual(result.headers['Access-Control-Allow-Origin'], ADMIN_ORIGIN);
  });

  it('should handle items with wildcard values', async () => {
    mockScanResult = {
      Items: [
        { key: { S: 'gh' }, value: { S: 'https://github.com/*' } }
      ]
    };
    const result = await handler({});
    const items = JSON.parse(result.body);
    assert.strictEqual(items[0].value, 'https://github.com/*');
  });
});

describe('CreateLink Lambda', () => {
  let handler;

  beforeEach(() => {
    resetMocks();
    handler = createCreateLinkHandler(TABLE_NAME, ADMIN_ORIGIN);
  });

  it('should create a link successfully', async () => {
    const event = {
      pathParameters: { key: 'gh' },
      body: JSON.stringify({ value: 'https://github.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 200);
    const body = JSON.parse(result.body);
    assert.strictEqual(body.key, 'gh');
    assert.strictEqual(body.value, 'https://github.com');
  });

  it('should create a wildcard link', async () => {
    const event = {
      pathParameters: { key: 'gh' },
      body: JSON.stringify({ value: 'https://github.com/*' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 200);
    const body = JSON.parse(result.body);
    assert.strictEqual(body.value, 'https://github.com/*');
  });

  it('should write correct DynamoDB item', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    await handler(event);
    assert.deepStrictEqual(lastPutInput, {
      TableName: TABLE_NAME,
      Item: { key: { S: 'test' }, value: { S: 'https://example.com' } }
    });
  });

  it('should include CORS headers', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.headers['Access-Control-Allow-Origin'], ADMIN_ORIGIN);
    assert.strictEqual(result.headers['Access-Control-Allow-Methods'], 'PUT,DELETE,OPTIONS');
  });

  it('should reject missing key parameter', async () => {
    const event = { pathParameters: null, body: '{}' };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Missing key/);
  });

  it('should reject invalid key format with special chars', async () => {
    const event = {
      pathParameters: { key: 'bad key!' },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Invalid key format/);
  });

  it('should reject key with spaces', async () => {
    const event = {
      pathParameters: { key: 'has space' },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
  });

  it('should allow key with hyphens and underscores', async () => {
    const event = {
      pathParameters: { key: 'my-link_v2' },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 200);
  });

  it('should reject key longer than 128 characters', async () => {
    const event = {
      pathParameters: { key: 'a'.repeat(129) },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /128 characters/);
  });

  it('should accept key exactly 128 characters', async () => {
    const event = {
      pathParameters: { key: 'a'.repeat(128) },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 200);
  });

  it('should reject invalid JSON body', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: 'not json'
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Invalid JSON/);
  });

  it('should reject missing value field', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({})
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Missing or invalid value/);
  });

  it('should reject non-string value', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 123 })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Missing or invalid value/);
  });

  it('should reject value without http/https scheme', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 'ftp://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /valid HTTP\/HTTPS URL/);
  });

  it('should reject value that is just a string', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 'not-a-url' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
  });

  it('should accept http URL', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 'http://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 200);
  });

  it('should return 500 on DynamoDB error', async () => {
    mockPutError = new Error('DynamoDB error');
    const event = {
      pathParameters: { key: 'test' },
      body: JSON.stringify({ value: 'https://example.com' })
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 500);
  });

  it('should handle empty body gracefully', async () => {
    const event = {
      pathParameters: { key: 'test' },
      body: null
    };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Missing or invalid value/);
  });
});

describe('DeleteLink Lambda', () => {
  let handler;

  beforeEach(() => {
    resetMocks();
    handler = createDeleteLinkHandler(TABLE_NAME, ADMIN_ORIGIN);
  });

  it('should delete a link successfully', async () => {
    const event = { pathParameters: { key: 'gh' } };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(result.body), { deleted: 'gh' });
  });

  it('should send correct DynamoDB delete command', async () => {
    const event = { pathParameters: { key: 'test-key' } };
    await handler(event);
    assert.deepStrictEqual(lastDeleteInput, {
      TableName: TABLE_NAME,
      Key: { key: { S: 'test-key' } }
    });
  });

  it('should include CORS headers', async () => {
    const event = { pathParameters: { key: 'test' } };
    const result = await handler(event);
    assert.strictEqual(result.headers['Access-Control-Allow-Origin'], ADMIN_ORIGIN);
    assert.strictEqual(result.headers['Access-Control-Allow-Methods'], 'PUT,DELETE,OPTIONS');
  });

  it('should reject missing key parameter', async () => {
    const event = { pathParameters: null };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
    assert.match(JSON.parse(result.body).error, /Missing key/);
  });

  it('should reject when pathParameters is undefined', async () => {
    const event = {};
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 400);
  });

  it('should return 500 on DynamoDB error', async () => {
    mockDeleteError = new Error('DynamoDB error');
    const event = { pathParameters: { key: 'test' } };
    const result = await handler(event);
    assert.strictEqual(result.statusCode, 500);
    assert.deepStrictEqual(JSON.parse(result.body), { error: 'Internal server error' });
  });

  it('should include CORS headers on error response', async () => {
    mockDeleteError = new Error('DynamoDB error');
    const event = { pathParameters: { key: 'test' } };
    const result = await handler(event);
    assert.strictEqual(result.headers['Access-Control-Allow-Origin'], ADMIN_ORIGIN);
  });
});
