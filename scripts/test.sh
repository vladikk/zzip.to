#!/bin/bash
set -euo pipefail

echo "Running unit tests..."
node --test tests/*.test.js

echo "All tests passed!"
