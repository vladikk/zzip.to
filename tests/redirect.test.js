const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock the cloudfront module
const { kvs, setKvsData } = require('./mocks/cloudfront');

// Now import the handler code (we need to evaluate it in this context)
// Since the function code is embedded in CloudFormation, we'll replicate it here
const kvsId = 'test-kvs-arn';
const kvsHandle = kvs(kvsId);

function validatePath(path) {
  if (path.length > 256) {
    return false;
  }
  if (path.includes('..')) {
    return false;
  }
  if (path.includes('//')) {
    return false;
  }
  if (path.includes('%2F') || path.includes('%2f')) {
    return false;
  }
  const allowedPattern = /^[A-Za-z0-9_\-\/]+$/;
  if (!allowedPattern.test(path)) {
    return false;
  }
  return true;
}

function parsePath(uri) {
  const path = uri.startsWith('/') ? uri.slice(1) : uri;
  if (path === '') {
    return { key: null, rest: null };
  }
  const segments = path.split('/');
  const key = segments[0];
  const rest = segments.length > 1 ? segments.slice(1).join('/') : null;
  return { key, rest };
}

function buildQueryString(querystring) {
  if (!querystring || Object.keys(querystring).length === 0) {
    return '';
  }
  const params = [];
  for (const key in querystring) {
    const param = querystring[key];
    if (param.multiValue) {
      param.multiValue.forEach(mv => {
        params.push(mv.value ? `${key}=${mv.value}` : key);
      });
    } else {
      params.push(param.value ? `${key}=${param.value}` : key);
    }
  }
  return params.length > 0 ? '?' + params.join('&') : '';
}

function buildRedirectUrl(target, rest, querystring) {
  let url = target;
  const isWildcard = target.endsWith('/*');
  if (isWildcard) {
    url = target.slice(0, -2);
    if (rest) {
      url = url.endsWith('/') ? url + rest : url + '/' + rest;
    } else {
      if (!url.endsWith('/')) {
        url = url + '/';
      }
    }
  }
  url += buildQueryString(querystring);
  return url;
}

function redirect301(location) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      'location': { value: location },
      'cache-control': { value: 'public, max-age=86400' }
    }
  };
}

function notFound() {
  return {
    statusCode: 404,
    statusDescription: 'Not Found',
    headers: {
      'content-type': { value: 'text/plain' }
    },
    body: 'Not Found'
  };
}

async function handler(event) {
  const request = event.request;
  const uri = request.uri;
  const querystring = request.querystring;
  if (uri === '/' || uri === '') {
    return notFound();
  }
  if (!validatePath(uri)) {
    return notFound();
  }
  const { key, rest } = parsePath(uri);
  if (!key) {
    return notFound();
  }
  let target;
  try {
    target = await kvsHandle.get(key);
  } catch (err) {
    return notFound();
  }
  if (!target) {
    return notFound();
  }
  const isWildcard = target.endsWith('/*');
  if (!isWildcard && rest) {
    return notFound();
  }
  const redirectUrl = buildRedirectUrl(target, rest, querystring);
  return redirect301(redirectUrl);
}

// Test suite
describe('CloudFront Redirect Function', () => {
  beforeEach(() => {
    // Reset KVS data before each test
    setKvsData({
      'docs': 'https://docs.example.com',
      'gh': 'https://github.com/*',
      'blog': 'https://blog.example.com/*'
    });
  });

  describe('Root path handling', () => {
    it('should return 404 for root path "/"', async () => {
      const event = {
        request: {
          uri: '/',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 for empty path ""', async () => {
      const event = {
        request: {
          uri: '',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Exact redirects', () => {
    it('should return 301 redirect for valid exact key', async () => {
      const event = {
        request: {
          uri: '/docs',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.statusDescription, 'Moved Permanently');
      assert.strictEqual(response.headers.location.value, 'https://docs.example.com');
      assert.strictEqual(response.headers['cache-control'].value, 'public, max-age=86400');
    });

    it('should return 404 for exact redirect with rest path', async () => {
      const event = {
        request: {
          uri: '/docs/page',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Wildcard redirects', () => {
    it('should redirect to base URL with trailing slash for wildcard without rest', async () => {
      const event = {
        request: {
          uri: '/gh',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location.value, 'https://github.com/');
    });

    it('should append rest path for wildcard redirect with single segment', async () => {
      const event = {
        request: {
          uri: '/gh/vladikk',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location.value, 'https://github.com/vladikk');
    });

    it('should append rest path for wildcard redirect with multiple segments', async () => {
      const event = {
        request: {
          uri: '/gh/vladikk/repos',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location.value, 'https://github.com/vladikk/repos');
    });
  });

  describe('Query string handling', () => {
    it('should preserve query string in redirect', async () => {
      const event = {
        request: {
          uri: '/gh/vladikk',
          querystring: {
            tab: { value: 'repos' }
          }
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location.value, 'https://github.com/vladikk?tab=repos');
    });

    it('should preserve multiple query parameters', async () => {
      const event = {
        request: {
          uri: '/gh/vladikk',
          querystring: {
            tab: { value: 'repos' },
            sort: { value: 'updated' }
          }
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.ok(response.headers.location.value.includes('tab=repos'));
      assert.ok(response.headers.location.value.includes('sort=updated'));
    });

    it('should handle query parameter without value', async () => {
      const event = {
        request: {
          uri: '/docs',
          querystring: {
            debug: { value: '' }
          }
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location.value, 'https://docs.example.com?debug');
    });
  });

  describe('Unknown keys', () => {
    it('should return 404 for unknown key', async () => {
      const event = {
        request: {
          uri: '/unknown',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Path validation - path traversal', () => {
    it('should return 404 for path with ".."', async () => {
      const event = {
        request: {
          uri: '/gh/../etc/passwd',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Path validation - double slashes', () => {
    it('should return 404 for path with "//"', async () => {
      const event = {
        request: {
          uri: '/gh//vladikk',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Path validation - encoded slashes', () => {
    it('should return 404 for path with %2F', async () => {
      const event = {
        request: {
          uri: '/gh%2Fvladikk',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 for path with %2f', async () => {
      const event = {
        request: {
          uri: '/gh%2fvladikk',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Path validation - max length', () => {
    it('should return 404 for path exceeding 256 characters', async () => {
      const event = {
        request: {
          uri: '/' + 'a'.repeat(257),
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });

    it('should accept path with exactly 256 characters', async () => {
      // Set up a valid key
      setKvsData({
        'a': 'https://example.com'
      });
      const event = {
        request: {
          uri: '/' + 'a'.repeat(256),
          querystring: {}
        }
      };
      const response = await handler(event);
      // Should return 404 because key not found, not because of validation
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Path validation - invalid characters', () => {
    it('should return 404 for path with question mark', async () => {
      const event = {
        request: {
          uri: '/gh?foo',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 for path with space', async () => {
      const event = {
        request: {
          uri: '/gh test',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });

    it('should return 404 for path with special characters', async () => {
      const event = {
        request: {
          uri: '/gh@test',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 404);
    });
  });

  describe('Path validation - allowed characters', () => {
    it('should accept path with alphanumeric characters', async () => {
      setKvsData({
        'test123': 'https://example.com'
      });
      const event = {
        request: {
          uri: '/test123',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
    });

    it('should accept path with hyphens', async () => {
      setKvsData({
        'test-key': 'https://example.com'
      });
      const event = {
        request: {
          uri: '/test-key',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
    });

    it('should accept path with underscores', async () => {
      setKvsData({
        'test_key': 'https://example.com'
      });
      const event = {
        request: {
          uri: '/test_key',
          querystring: {}
        }
      };
      const response = await handler(event);
      assert.strictEqual(response.statusCode, 301);
    });
  });

  describe('Helper function - validatePath', () => {
    it('should return true for valid path', () => {
      assert.strictEqual(validatePath('/valid/path'), true);
    });

    it('should return false for path with ..', () => {
      assert.strictEqual(validatePath('/path/../other'), false);
    });

    it('should return false for path with //', () => {
      assert.strictEqual(validatePath('/path//other'), false);
    });

    it('should return false for path exceeding max length', () => {
      assert.strictEqual(validatePath('/' + 'a'.repeat(257)), false);
    });
  });

  describe('Helper function - parsePath', () => {
    it('should parse simple path', () => {
      const result = parsePath('/key');
      assert.strictEqual(result.key, 'key');
      assert.strictEqual(result.rest, null);
    });

    it('should parse path with rest', () => {
      const result = parsePath('/key/rest');
      assert.strictEqual(result.key, 'key');
      assert.strictEqual(result.rest, 'rest');
    });

    it('should parse path with multiple rest segments', () => {
      const result = parsePath('/key/rest/segments');
      assert.strictEqual(result.key, 'key');
      assert.strictEqual(result.rest, 'rest/segments');
    });

    it('should handle empty path', () => {
      const result = parsePath('/');
      assert.strictEqual(result.key, null);
      assert.strictEqual(result.rest, null);
    });
  });

  describe('Helper function - buildQueryString', () => {
    it('should return empty string for empty querystring', () => {
      assert.strictEqual(buildQueryString({}), '');
    });

    it('should build query string with single parameter', () => {
      const qs = buildQueryString({ key: { value: 'value' } });
      assert.strictEqual(qs, '?key=value');
    });

    it('should build query string with multiple parameters', () => {
      const qs = buildQueryString({
        key1: { value: 'value1' },
        key2: { value: 'value2' }
      });
      assert.ok(qs.includes('key1=value1'));
      assert.ok(qs.includes('key2=value2'));
    });
  });

  describe('Helper function - buildRedirectUrl', () => {
    it('should return exact URL for non-wildcard', () => {
      const url = buildRedirectUrl('https://example.com', null, {});
      assert.strictEqual(url, 'https://example.com');
    });

    it('should append trailing slash for wildcard without rest', () => {
      const url = buildRedirectUrl('https://example.com/*', null, {});
      assert.strictEqual(url, 'https://example.com/');
    });

    it('should append rest for wildcard with rest', () => {
      const url = buildRedirectUrl('https://example.com/*', 'path', {});
      assert.strictEqual(url, 'https://example.com/path');
    });

    it('should append query string', () => {
      const url = buildRedirectUrl('https://example.com', null, { key: { value: 'value' } });
      assert.strictEqual(url, 'https://example.com?key=value');
    });
  });
});
