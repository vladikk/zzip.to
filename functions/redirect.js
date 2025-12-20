import cf from 'cloudfront';

const kvsId = 'KVS_ARN_PLACEHOLDER';
const kvsHandle = cf.kvs(kvsId);

/**
 * Validates the request path according to redirect service rules.
 * Returns false if the path contains any invalid patterns or characters.
 *
 * @param {string} path - The request URI path
 * @returns {boolean} - true if valid, false otherwise
 */
function validatePath(path) {
  // Check max length (256 chars)
  if (path.length > 256) {
    return false;
  }

  // Check for path traversal
  if (path.includes('..')) {
    return false;
  }

  // Check for empty segments (double slashes)
  if (path.includes('//')) {
    return false;
  }

  // Check for encoded slashes (%2F or %2f)
  if (path.includes('%2F') || path.includes('%2f')) {
    return false;
  }

  // Check allowed characters: A-Z a-z 0-9 _ - /
  var allowedPattern = /^[A-Za-z0-9_\-\/]+$/;
  if (!allowedPattern.test(path)) {
    return false;
  }

  return true;
}

/**
 * Parses the URI path into key and rest segments.
 *
 * @param {string} uri - The request URI (e.g., "/gh/vladikk")
 * @returns {Object} - Object with key and rest properties
 */
function parsePath(uri) {
  // Remove leading slash
  var path = uri.startsWith('/') ? uri.slice(1) : uri;

  if (path === '') {
    return { key: null, rest: null };
  }

  var segments = path.split('/');
  var key = segments[0];
  var rest = segments.length > 1 ? segments.slice(1).join('/') : null;

  return { key: key, rest: rest };
}

/**
 * Builds a query string from CloudFront querystring object.
 *
 * @param {Object} querystring - CloudFront querystring object
 * @returns {string} - Query string with leading '?' or empty string
 */
function buildQueryString(querystring) {
  if (!querystring || Object.keys(querystring).length === 0) {
    return '';
  }

  var params = [];
  for (var k in querystring) {
    var param = querystring[k];
    if (param.multiValue) {
      param.multiValue.forEach(function(mv) {
        params.push(mv.value ? k + '=' + mv.value : k);
      });
    } else {
      params.push(param.value ? k + '=' + param.value : k);
    }
  }

  return params.length > 0 ? '?' + params.join('&') : '';
}

/**
 * Builds the final redirect URL from target, rest path, and query string.
 *
 * @param {string} target - The target URL from KVS
 * @param {string|null} rest - The rest of the path after the key
 * @param {Object} querystring - CloudFront querystring object
 * @returns {string} - Complete redirect URL
 */
function buildRedirectUrl(target, rest, querystring) {
  var url = target;

  // Handle wildcard targets (ending with /*)
  var isWildcard = target.endsWith('/*');

  if (isWildcard) {
    // Remove /* from target
    url = target.slice(0, -2);

    // Append rest path if present
    if (rest) {
      // Ensure single slash between base and rest
      url = url.endsWith('/') ? url + rest : url + '/' + rest;
    } else {
      // Ensure trailing slash for bare wildcard
      if (!url.endsWith('/')) {
        url = url + '/';
      }
    }
  }

  // Append query string
  url += buildQueryString(querystring);

  return url;
}

/**
 * Creates a 301 redirect response.
 *
 * @param {string} location - The redirect target URL
 * @returns {Object} - CloudFront Function response object
 */
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

/**
 * Creates a 404 Not Found response.
 *
 * @returns {Object} - CloudFront Function response object
 */
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

/**
 * Main handler for CloudFront Function.
 * Processes redirect requests and returns appropriate HTTP responses.
 *
 * @param {Object} event - CloudFront Function event object
 * @returns {Promise<Object>} - HTTP response object
 */
async function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var querystring = request.querystring;

  // Handle root path
  if (uri === '/' || uri === '') {
    return notFound();
  }

  // Validate path
  if (!validatePath(uri)) {
    return notFound();
  }

  // Parse path
  var parsed = parsePath(uri);
  var key = parsed.key;
  var rest = parsed.rest;

  if (!key) {
    return notFound();
  }

  // Lookup in KVS
  var target;
  try {
    target = await kvsHandle.get(key);
  } catch (err) {
    // Key not found or KVS error
    return notFound();
  }

  if (!target) {
    return notFound();
  }

  // Check if wildcard redirect
  var isWildcard = target.endsWith('/*');

  // Exact redirect with rest path = 404
  if (!isWildcard && rest) {
    return notFound();
  }

  // Build redirect URL
  var redirectUrl = buildRedirectUrl(target, rest, querystring);

  return redirect301(redirectUrl);
}
