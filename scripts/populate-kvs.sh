#!/bin/bash
set -euo pipefail

KVS_ARN=${1:-}
DATA_FILE=${2:-data/redirects.json}

if [[ -z "$KVS_ARN" ]]; then
  echo "Usage: ./scripts/populate-kvs.sh <kvs-arn> [data-file]"
  exit 1
fi

echo "Populating KVS from $DATA_FILE..."

# Get current ETag
ETAG=$(aws cloudfront-keyvaluestore describe-key-value-store \
  --kvs-arn "$KVS_ARN" \
  --query 'ETag' \
  --output text)

# Read JSON and update each key
jq -c '.[]' "$DATA_FILE" | while read -r item; do
  KEY=$(echo "$item" | jq -r '.key')
  VALUE=$(echo "$item" | jq -r '.value')

  echo "Setting $KEY -> $VALUE"

  ETAG=$(aws cloudfront-keyvaluestore put-key \
    --kvs-arn "$KVS_ARN" \
    --key "$KEY" \
    --value "$VALUE" \
    --if-match "$ETAG" \
    --query 'ETag' \
    --output text)
done

echo "KVS population complete!"
