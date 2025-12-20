# Task 3: CloudFront Function Redirect Logic Implementation

## Goal

Implement the complete redirect logic in the CloudFront Function, including path parsing, validation, KeyValueStore lookup, wildcard handling, and proper HTTP redirect responses. This is the core business logic of the redirect service.

## Context

- Requirement: Parse request path to extract key and optional rest segments
- Requirement: Validate paths (allowed chars, max length, no `..`, no `//`, no encoded slashes)
- Requirement: Lookup key in KeyValueStore
- Requirement: Handle exact redirects (no `/*` suffix) and wildcard redirects (`/*` suffix)
- Requirement: Preserve query strings
- Requirement: Return 301 (permanent) or 307 (temporary) redirects
- Requirement: Return 404 for invalid paths, missing keys, or exact redirect with rest path
- Depends on Task 2 for Function resource and KVS association

## Assumptions

- **Default Redirect Status:** 301 (permanent redirect) as the default. The requirements mention both 301 and 307 but don't specify when to use each. Using 301 as default since most short links are permanent. If per-link status is needed, the KVS value format could be extended in the future.
- **Query String Handling:** Query strings from the original request are appended to the redirect URL. If the target URL already has query parameters, this could cause issues - but this is consistent with requirements and matches expected behavior.
- **Max Path Length:** 256 characters as specified in requirements.

## Work Breakdown

1. **Create the CloudFront Function source file**
   - File: `functions/redirect.js`
   - This file will contain the complete function code
   - The CloudFormation template will reference this file's content

2. **Implement the main handler structure**
   ```javascript
   import cf from 'cloudfront';

   const kvsId = 'KVS_ARN_PLACEHOLDER'; // Will be replaced during deployment
   const kvsHandle = cf.kvs(kvsId);

   async function handler(event) {
     const request = event.request;
     const uri = request.uri;
     const querystring = request.querystring;

     // Validation and redirect logic here

     return response;
   }
   ```

3. **Implement path validation function**
   ```javascript
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
     const allowedPattern = /^[A-Za-z0-9_\-\/]+$/;
     if (!allowedPattern.test(path)) {
       return false;
     }

     return true;
   }
   ```

4. **Implement path parsing function**
   ```javascript
   function parsePath(uri) {
     // Remove leading slash
     const path = uri.startsWith('/') ? uri.slice(1) : uri;

     if (path === '') {
       return { key: null, rest: null };
     }

     const segments = path.split('/');
     const key = segments[0];
     const rest = segments.length > 1 ? segments.slice(1).join('/') : null;

     return { key, rest };
   }
   ```

5. **Implement query string builder**
   ```javascript
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
   ```

6. **Implement redirect URL builder**
   ```javascript
   function buildRedirectUrl(target, rest, querystring) {
     let url = target;

     // Handle wildcard targets (ending with /*)
     const isWildcard = target.endsWith('/*');

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
     } else {
       // Exact redirect - rest path not allowed (handled in main logic)
     }

     // Append query string
     url += buildQueryString(querystring);

     return url;
   }
   ```

7. **Implement response builders**
   ```javascript
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
   ```

8. **Implement main handler logic**
   ```javascript
   async function handler(event) {
     const request = event.request;
     const uri = request.uri;
     const querystring = request.querystring;

     // Handle root path
     if (uri === '/' || uri === '') {
       return notFound();
     }

     // Validate path
     if (!validatePath(uri)) {
       return notFound();
     }

     // Parse path
     const { key, rest } = parsePath(uri);

     if (!key) {
       return notFound();
     }

     // Lookup in KVS
     let target;
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
     const isWildcard = target.endsWith('/*');

     // Exact redirect with rest path = 404
     if (!isWildcard && rest) {
       return notFound();
     }

     // Build redirect URL
     const redirectUrl = buildRedirectUrl(target, rest, querystring);

     return redirect301(redirectUrl);
   }
   ```

9. **Update CloudFormation template to use external function code**
   - Modify the `RedirectFunction` resource in `cloudformation/template.yaml`
   - Use `Fn::Sub` to inject the KVS ARN into the function code
   - The function code should be included inline with the ARN substituted

10. **Create the complete function file with all components**
    - File: `functions/redirect.js`
    - Combine all the above functions into a single, well-documented file
    - Include comments explaining each section

## Deliverables (Acceptance Criteria)

- [ ] File `functions/redirect.js` created with complete redirect logic
- [ ] Path validation implemented:
  - Max 256 character length check
  - Allowed characters: `A-Z a-z 0-9 _ - /`
  - Rejects `..` (path traversal)
  - Rejects `//` (empty segments)
  - Rejects `%2F` and `%2f` (encoded slashes)
- [ ] Path parsing extracts key and optional rest segments correctly
- [ ] KVS lookup implemented with error handling
- [ ] Exact redirect (no `/*`): returns 301 to target URL
- [ ] Exact redirect with rest path: returns 404
- [ ] Wildcard redirect (`/*`): appends rest path to target
- [ ] Query strings preserved in redirect URL
- [ ] 404 returned for: missing key, invalid path, root path
- [ ] Response includes proper headers (Location, Cache-Control)
- [ ] CloudFormation template updated to use function code
- [ ] Template validates successfully

## Tests

**Test Types Required:**
- Unit tests for each helper function
- Integration tests for the complete handler
- Edge case tests for validation

**Test Cases:**

1. **Test:** Root path returns 404
   - **Input:** `uri: '/'`
   - **Expected Output:** `{ statusCode: 404 }`

2. **Test:** Valid key with exact redirect
   - **Input:** `uri: '/docs'`, KVS: `docs -> https://docs.example.com`
   - **Expected Output:** `{ statusCode: 301, headers: { location: { value: 'https://docs.example.com' } } }`

3. **Test:** Exact redirect with rest path returns 404
   - **Input:** `uri: '/docs/page'`, KVS: `docs -> https://docs.example.com`
   - **Expected Output:** `{ statusCode: 404 }`

4. **Test:** Wildcard redirect without rest
   - **Input:** `uri: '/gh'`, KVS: `gh -> https://github.com/*`
   - **Expected Output:** `{ statusCode: 301, headers: { location: { value: 'https://github.com/' } } }`

5. **Test:** Wildcard redirect with rest
   - **Input:** `uri: '/gh/vladikk'`, KVS: `gh -> https://github.com/*`
   - **Expected Output:** `{ statusCode: 301, headers: { location: { value: 'https://github.com/vladikk' } } }`

6. **Test:** Wildcard redirect with multiple segments
   - **Input:** `uri: '/gh/vladikk/repos'`, KVS: `gh -> https://github.com/*`
   - **Expected Output:** `{ statusCode: 301, headers: { location: { value: 'https://github.com/vladikk/repos' } } }`

7. **Test:** Query string preservation
   - **Input:** `uri: '/gh/vladikk'`, `querystring: { tab: { value: 'repos' } }`, KVS: `gh -> https://github.com/*`
   - **Expected Output:** Location ends with `?tab=repos`

8. **Test:** Unknown key returns 404
   - **Input:** `uri: '/unknown'`, KVS: key not found
   - **Expected Output:** `{ statusCode: 404 }`

9. **Test:** Path with `..` returns 404
   - **Input:** `uri: '/gh/../etc/passwd'`
   - **Expected Output:** `{ statusCode: 404 }`

10. **Test:** Path with `//` returns 404
    - **Input:** `uri: '/gh//vladikk'`
    - **Expected Output:** `{ statusCode: 404 }`

11. **Test:** Path with encoded slash returns 404
    - **Input:** `uri: '/gh%2Fvladikk'`
    - **Expected Output:** `{ statusCode: 404 }`

12. **Test:** Path exceeding 256 chars returns 404
    - **Input:** `uri: '/' + 'a'.repeat(257)`
    - **Expected Output:** `{ statusCode: 404 }`

13. **Test:** Path with invalid characters returns 404
    - **Input:** `uri: '/gh?foo'` (question mark in path, not query)
    - **Expected Output:** `{ statusCode: 404 }`

**Running Tests:**
```bash
# Create test file
# File: tests/redirect.test.js

# Run tests with Node.js test runner or Jest
node --test tests/redirect.test.js
# OR
npx jest tests/redirect.test.js
```

## Observability / Ops

**Logging:**
- CloudFront Functions do not support console.log in production
- Errors are observable via CloudFront access logs (4xx status codes)
- Function execution metrics available in CloudWatch

**Metrics to Monitor:**
- `FunctionExecutionTime` - should be < 1ms for redirect logic
- `FunctionThrottles` - indicates capacity issues
- `FunctionValidationErrors` - code deployment issues

## Security / Privacy

**Input Validation:**
- All path validation happens before KVS lookup
- No user input is reflected in responses (prevents XSS)
- Path traversal attempts blocked

**Data Handling:**
- Query strings are passed through but not logged by the function
- No PII is stored in KVS (only short codes and target URLs)

## Dependencies

**Internal:**
- CloudFront Function runtime (`cloudfront-js-2.0`)
- KeyValueStore API (`cf.kvs()`)

**External:**
- None (pure edge function)

**Task Dependencies:**
- Depends on: Task 2 (`tasks/task-2.md`) - KVS and Function resources must exist
- Blocks: Task 4 (`tasks/task-4.md`) - Testing and deployment requires complete function

## Notes

- CloudFront Functions have a 10KB code size limit and 1ms execution time limit - the redirect logic is well within these constraints
- The KVS ID must be injected at deployment time since it's not known until the stack is created
- Consider using `Fn::Join` or `Fn::Sub` in CloudFormation to embed the function code with the KVS ARN
- The `cf.kvs().get()` method is async and returns undefined (not throws) when key is not found in some versions - handle both cases
- Cache-Control header on 301 responses allows browsers to cache redirects, reducing repeated lookups
- The validation regex `^[A-Za-z0-9_\-\/]+$` is intentionally strict - only alphanumeric, underscore, hyphen, and slash
