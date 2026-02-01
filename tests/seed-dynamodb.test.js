const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Test the seed script logic: parsing redirects.json and generating correct DynamoDB items

describe('seed-dynamodb logic', () => {
  const dataFile = path.join(__dirname, '..', 'data', 'redirects.json');

  it('redirects.json exists and is valid JSON', () => {
    assert.ok(fs.existsSync(dataFile), 'data/redirects.json should exist');
    const content = fs.readFileSync(dataFile, 'utf-8');
    const data = JSON.parse(content);
    assert.ok(Array.isArray(data), 'redirects.json should contain an array');
    assert.ok(data.length > 0, 'redirects.json should not be empty');
  });

  it('each entry has required key and value fields', () => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    for (const item of data) {
      assert.ok(typeof item.key === 'string' && item.key.length > 0,
        `Item should have a non-empty string key, got: ${JSON.stringify(item)}`);
      assert.ok(typeof item.value === 'string' && item.value.length > 0,
        `Item should have a non-empty string value, got: ${JSON.stringify(item)}`);
    }
  });

  it('all keys are unique', () => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const keys = data.map(item => item.key);
    const uniqueKeys = new Set(keys);
    assert.strictEqual(keys.length, uniqueKeys.size, 'All keys should be unique');
  });

  it('generates correct DynamoDB PutRequest items', () => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));

    // Simulate the DynamoDB item generation from the script
    const putRequests = data.map(item => ({
      PutRequest: {
        Item: {
          key: { S: item.key },
          value: { S: item.value }
        }
      }
    }));

    assert.strictEqual(putRequests.length, data.length);

    // Verify first item structure
    const first = putRequests[0];
    assert.ok(first.PutRequest, 'Should have PutRequest wrapper');
    assert.ok(first.PutRequest.Item, 'Should have Item');
    assert.ok(first.PutRequest.Item.key.S, 'Should have key as DynamoDB String');
    assert.ok(first.PutRequest.Item.value.S, 'Should have value as DynamoDB String');

    // Verify specific known entries
    const ghItem = putRequests.find(r => r.PutRequest.Item.key.S === 'gh');
    assert.ok(ghItem, 'Should contain gh redirect');
    assert.strictEqual(ghItem.PutRequest.Item.value.S, 'https://github.com/*');
  });

  it('correctly identifies wildcard vs exact redirects', () => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const wildcardItems = data.filter(item => item.value.endsWith('/*'));
    const exactItems = data.filter(item => !item.value.endsWith('/*'));

    assert.ok(wildcardItems.length > 0, 'Should have at least one wildcard redirect');
    assert.ok(exactItems.length > 0, 'Should have at least one exact redirect');

    // gh and repo are wildcard redirects
    const wildcardKeys = wildcardItems.map(i => i.key);
    assert.ok(wildcardKeys.includes('gh'), 'gh should be a wildcard redirect');
    assert.ok(wildcardKeys.includes('repo'), 'repo should be a wildcard redirect');
  });

  it('batch size of 25 correctly partitions items', () => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const BATCH_SIZE = 25;

    const batches = [];
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      batches.push(data.slice(i, i + BATCH_SIZE));
    }

    const expectedBatches = Math.ceil(data.length / BATCH_SIZE);
    assert.strictEqual(batches.length, expectedBatches);

    // All items should be accounted for
    const totalItems = batches.reduce((sum, batch) => sum + batch.length, 0);
    assert.strictEqual(totalItems, data.length);

    // No batch should exceed 25 items
    for (const batch of batches) {
      assert.ok(batch.length <= BATCH_SIZE, `Batch should not exceed ${BATCH_SIZE} items`);
    }
  });

  it('values with special characters are preserved', () => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const royalP = data.find(item => item.key === 'royal-p');
    assert.ok(royalP, 'Should contain royal-p redirect');
    assert.ok(royalP.value.includes('requestUrl='), 'royal-p URL with query params should be preserved');
    assert.ok(royalP.value.includes('%3A'), 'URL-encoded characters should be preserved');
  });
});
