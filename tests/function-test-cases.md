# CloudFront Function Test Cases

This document defines test cases for the redirect function logic.

## Test Environment Setup

To test the function, you need:
- CloudFront distribution deployed
- KeyValueStore with test mappings
- Ability to make HTTP requests (curl, browser, etc.)

## Key Value Store Test Data

Before running tests, populate KVS with these mappings:

```bash
# Wildcard redirects
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key gh --value "https://github.com/*"
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key tw --value "https://twitter.com/*"

# Exact redirects
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key docs --value "https://docs.example.com"
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key home --value "https://example.com/home"
```

Wait 1-2 minutes for KVS propagation to edge locations.

---

## Test Categories

### Category 1: Wildcard Redirects

#### Test 1.1: Wildcard redirect - root path
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/`

**Test Command:**
```bash
curl -I https://zzip.to/gh
```

**Expected Output:**
```
HTTP/2 301
location: https://github.com/
```

**Pass Criteria:** Location header is exactly `https://github.com/`

---

#### Test 1.2: Wildcard redirect - single path segment
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk`

**Test Command:**
```bash
curl -I https://zzip.to/gh/vladikk
```

**Pass Criteria:** Location header is exactly `https://github.com/vladikk`

---

#### Test 1.3: Wildcard redirect - multiple path segments
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk/repos/awesome-project`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk/repos/awesome-project`

**Test Command:**
```bash
curl -I https://zzip.to/gh/vladikk/repos/awesome-project
```

**Pass Criteria:** All path segments after `/gh/` are appended

---

#### Test 1.4: Wildcard redirect - with query string
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk?tab=repositories&sort=stars`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk?tab=repositories&sort=stars`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vladikk?tab=repositories&sort=stars'
```

**Pass Criteria:** Query string is preserved exactly

---

#### Test 1.5: Wildcard redirect - path with query string
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk/repos?type=public`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk/repos?type=public`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vladikk/repos?type=public'
```

**Pass Criteria:** Both path and query string preserved

---

### Category 2: Exact Redirects

#### Test 2.1: Exact redirect - valid
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://docs.example.com`

**Test Command:**
```bash
curl -I https://zzip.to/docs
```

**Pass Criteria:** Redirects to exact URL, no trailing slash added

---

#### Test 2.2: Exact redirect - with query string
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs?search=api`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://docs.example.com?search=api`

**Test Command:**
```bash
curl -I 'https://zzip.to/docs?search=api'
```

**Pass Criteria:** Query string appended to exact URL

---

#### Test 2.3: Exact redirect - with extra path (should fail)
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs/guide/intro`

**Expected Response:**
- Status: `404 Not Found`
- Body: `Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/docs/guide/intro
```

**Pass Criteria:** Returns 404 (exact redirects don't allow extra path)

**Reason:** Exact redirects must match the key exactly. Any additional path segments result in 404.

---

#### Test 2.4: Exact redirect - with trailing slash (should fail)
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs/`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/docs/
```

**Pass Criteria:** Returns 404

**Reason:** `/docs/` has an extra empty segment, treated as extra path

---

### Category 3: Key Not Found

#### Test 3.1: Unknown key
**Setup:** Key `unknown` does not exist in KVS

**Request:** `GET /unknown`

**Expected Response:**
- Status: `404 Not Found`
- Header: `content-type: text/plain`
- Body: `Not Found`

**Test Command:**
```bash
curl -i https://zzip.to/unknown
```

**Pass Criteria:** 404 response with body

---

#### Test 3.2: Unknown key with path
**Setup:** Key `notfound` does not exist in KVS

**Request:** `GET /notfound/some/path`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/notfound/some/path
```

**Pass Criteria:** 404 response

---

### Category 4: Path Validation - Security

#### Test 4.1: Path with double dots (directory traversal attempt)
**Request:** `GET /gh/../etc/passwd`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh/../etc/passwd
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `..` which is blocked for security

---

#### Test 4.2: Path with double slashes
**Request:** `GET /gh//vladikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh//vladikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `//` which is blocked

---

#### Test 4.3: Path with encoded slash (lowercase)
**Request:** `GET /gh%2fvladikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh%2fvladikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `%2f` (URL-encoded `/`)

---

#### Test 4.4: Path with encoded slash (uppercase)
**Request:** `GET /gh%2Fvladikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh%2Fvladikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `%2F` (URL-encoded `/`)

---

#### Test 4.5: Path with invalid characters
**Request:** `GET /gh/vlad@ikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh/vlad@ikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** `@` is not in allowed characters set

---

#### Test 4.6: Path with space
**Request:** `GET /gh/vlad ikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vlad ikk'
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Space is not an allowed character

---

#### Test 4.7: Path with special characters
**Request:** `GET /gh/vlad$ikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vlad$ikk'
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** `$` is not an allowed character

---

### Category 5: Path Length Validation

#### Test 5.1: Maximum valid path (256 characters)
**Setup:** KVS `test = https://example.com/*`

**Request:** `GET /test/` + 251 characters of `a`

**Expected Response:**
- Status: `301 Moved Permanently`

**Test Command:**
```bash
# Generate 251 'a' characters (total path = 256 including /test/)
PATH_256=$(printf '/test/%0.s' {1..251} | sed 's/.$/a/g')
curl -I "https://zzip.to${PATH_256:0:256}"
```

**Pass Criteria:** Redirects successfully

**Reason:** 256 is the maximum allowed length

---

#### Test 5.2: Path too long (257 characters)
**Request:** `GET /test/` + 252 characters

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
# Generate 252 'a' characters (total path = 257)
PATH_257=$(printf 'a%.0s' {1..252})
curl -I "https://zzip.to/test/${PATH_257}"
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path exceeds 256 character limit

---

### Category 6: Edge Cases

#### Test 6.1: Root path only
**Request:** `GET /`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/
```

**Pass Criteria:** 404 response

**Reason:** No key extracted from path

---

#### Test 6.2: Empty path after normalization
**Request:** `GET //`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to//
```

**Pass Criteria:** 404 response

**Reason:** Path contains `//`

---

#### Test 6.3: Query string only (no path)
**Request:** `GET /?param=value`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I 'https://zzip.to/?param=value'
```

**Pass Criteria:** 404 response

**Reason:** No key in path

---

#### Test 6.4: Key with underscore
**Setup:** KVS `test_key = https://example.com`

**Request:** `GET /test_key`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://example.com`

**Test Command:**
```bash
curl -I https://zzip.to/test_key
```

**Pass Criteria:** Redirects successfully

**Reason:** Underscore is allowed character

---

#### Test 6.5: Key with hyphen
**Setup:** KVS `test-key = https://example.com`

**Request:** `GET /test-key`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://example.com`

**Test Command:**
```bash
curl -I https://zzip.to/test-key
```

**Pass Criteria:** Redirects successfully

**Reason:** Hyphen is allowed character

---

#### Test 6.6: Key with numbers
**Setup:** KVS `key123 = https://example.com`

**Request:** `GET /key123`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://example.com`

**Test Command:**
```bash
curl -I https://zzip.to/key123
```

**Pass Criteria:** Redirects successfully

**Reason:** Numbers are allowed

---

#### Test 6.7: Case sensitivity
**Setup:** KVS `GH = https://github.com/*` (uppercase)

**Request:** `GET /gh` (lowercase)

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh
```

**Pass Criteria:** 404 response

**Reason:** Keys are case-sensitive. `GH` ≠ `gh`

---

### Category 7: Multiple Query Parameters

#### Test 7.1: Multiple query parameters
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/search?q=test&type=repositories&sort=stars`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/search?q=test&type=repositories&sort=stars`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/search?q=test&type=repositories&sort=stars'
```

**Pass Criteria:** All query parameters preserved

---

#### Test 7.2: Query parameter with special characters
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk?q=hello+world&filter=stars>100`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: Location with encoded query string

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vladikk?q=hello+world&filter=stars>100'
```

**Pass Criteria:** Query string preserved (may be URL-encoded by CloudFront)

---

### Category 8: HTTP Methods

#### Test 8.1: HEAD request
**Setup:** KVS `gh = https://github.com/*`

**Request:** `HEAD /gh/vladikk`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk`
- No body

**Test Command:**
```bash
curl -I -X HEAD https://zzip.to/gh/vladikk
```

**Pass Criteria:** Same redirect response as GET

---

#### Test 8.2: OPTIONS request
**Setup:** KVS `gh = https://github.com/*`

**Request:** `OPTIONS /gh/vladikk`

**Expected Response:**
- Status: `301 Moved Permanently` or handled by CloudFront

**Test Command:**
```bash
curl -I -X OPTIONS https://zzip.to/gh/vladikk
```

**Pass Criteria:** Request is processed (may be handled by CloudFront before function)

---

## Test Execution Checklist

Run tests in order:

- [ ] Setup: Deploy CloudFormation stack
- [ ] Setup: Populate KVS with test data
- [ ] Setup: Wait 2 minutes for propagation
- [ ] Category 1: All wildcard redirect tests (1.1 - 1.5)
- [ ] Category 2: All exact redirect tests (2.1 - 2.4)
- [ ] Category 3: All key not found tests (3.1 - 3.2)
- [ ] Category 4: All security validation tests (4.1 - 4.7)
- [ ] Category 5: All path length tests (5.1 - 5.2)
- [ ] Category 6: All edge case tests (6.1 - 6.7)
- [ ] Category 7: All query parameter tests (7.1 - 7.2)
- [ ] Category 8: All HTTP method tests (8.1 - 8.2)

## Automated Testing Script

Create `tests/run-tests.sh` for automated testing:

```bash
#!/usr/bin/env bash
# Run all test cases and report results

DOMAIN="zzip.to"
PASSED=0
FAILED=0

test_redirect() {
    local name="$1"
    local path="$2"
    local expected_code="$3"
    local expected_location="$4"

    response=$(curl -s -I "https://${DOMAIN}${path}")
    code=$(echo "$response" | grep -i "^HTTP" | awk '{print $2}')
    location=$(echo "$response" | grep -i "^location:" | cut -d' ' -f2- | tr -d '\r')

    if [ "$code" = "$expected_code" ]; then
        if [ -z "$expected_location" ] || [ "$location" = "$expected_location" ]; then
            echo "✓ $name"
            ((PASSED++))
            return 0
        fi
    fi

    echo "✗ $name (got: $code $location)"
    ((FAILED++))
    return 1
}

echo "Running CloudFront Function Tests..."
echo ""

# Category 1: Wildcard redirects
test_redirect "1.1 Wildcard root" "/gh" "301" "https://github.com/"
test_redirect "1.2 Wildcard single path" "/gh/vladikk" "301" "https://github.com/vladikk"
test_redirect "1.3 Wildcard multiple paths" "/gh/vladikk/repos" "301" "https://github.com/vladikk/repos"

# Category 2: Exact redirects
test_redirect "2.1 Exact redirect" "/docs" "301" "https://docs.example.com"
test_redirect "2.3 Exact with extra path" "/docs/guide" "404" ""

# Category 3: Not found
test_redirect "3.1 Unknown key" "/unknown" "404" ""

# Category 4: Security
test_redirect "4.1 Path with .." "/gh/../etc" "404" ""
test_redirect "4.2 Path with //" "/gh//vladikk" "404" ""
test_redirect "4.5 Invalid characters" "/gh/vlad@ikk" "404" ""

echo ""
echo "Results: $PASSED passed, $FAILED failed"

if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
```

Make executable: `chmod +x tests/run-tests.sh`

## Success Criteria

All tests must pass for the function to be considered correct.

**Critical Tests (must pass):**
- All Category 1 tests (wildcard redirects)
- All Category 2 tests (exact redirects)
- All Category 4 tests (security validation)
- Test 5.2 (path length limit)

**Important Tests (should pass):**
- All other categories

## Troubleshooting Test Failures

**If wildcard redirects fail:**
- Check KVS value ends with `/*`
- Verify KVS propagation (wait 2-5 minutes)
- Check function code wildcard handling

**If exact redirects fail:**
- Check KVS value does NOT end with `/*`
- Verify exact match logic in function

**If validation fails:**
- Check regex pattern for allowed characters
- Verify path length check (≤ 256)
- Check for `..`, `//`, `%2F` patterns

**If 404s are returned unexpectedly:**
- Verify KVS key exists: `aws cloudfront-keyvaluestore list-keys`
- Check key case sensitivity
- Wait for KVS propagation

**If redirects go to wrong location:**
- Check target URL in KVS
- Verify path concatenation logic
- Check query string handling
