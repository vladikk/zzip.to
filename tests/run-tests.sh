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
