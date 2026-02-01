#!/bin/bash
set -euo pipefail

# One-time migration script: seeds the DynamoDB LinksTable from data/redirects.json.
# Use this script after deploying the CloudFormation stack to migrate existing
# file-based redirects into DynamoDB. Once migrated, all redirect management
# should be done through the admin UI at admin.zzip.to.

TABLE_NAME=${1:-}
DATA_FILE=${2:-data/redirects.json}

if [[ -z "$TABLE_NAME" ]]; then
  echo "Usage: ./scripts/seed-dynamodb.sh <table-name> [data-file]"
  echo ""
  echo "Arguments:"
  echo "  table-name   Name of the DynamoDB LinksTable (e.g., zzip-to-dev-LinksTable-xxx)"
  echo "  data-file    Path to redirects JSON file (default: data/redirects.json)"
  echo ""
  echo "This is a one-time migration from file-based to DB-based redirect management."
  exit 1
fi

if [[ ! -f "$DATA_FILE" ]]; then
  echo "Error: Data file not found: $DATA_FILE"
  exit 1
fi

ITEM_COUNT=$(jq length "$DATA_FILE")
echo "Seeding DynamoDB table '$TABLE_NAME' with $ITEM_COUNT items from $DATA_FILE..."

# DynamoDB batch-write-item supports up to 25 items per batch
BATCH_SIZE=25
ITEMS=$(jq -c '.[]' "$DATA_FILE")
BATCH=()
WRITTEN=0

flush_batch() {
  if [[ ${#BATCH[@]} -eq 0 ]]; then
    return
  fi

  # Build the request items JSON
  local request_items="["
  local first=true
  for item in "${BATCH[@]}"; do
    if [[ "$first" == "true" ]]; then
      first=false
    else
      request_items+=","
    fi
    request_items+="$item"
  done
  request_items+="]"

  local request_json="{\"$TABLE_NAME\": $request_items}"

  aws dynamodb batch-write-item \
    --region us-east-1 \
    --request-items "$request_json" \
    --output text > /dev/null

  WRITTEN=$((WRITTEN + ${#BATCH[@]}))
  echo "  Written $WRITTEN / $ITEM_COUNT items..."
  BATCH=()
}

while read -r item; do
  KEY=$(echo "$item" | jq -r '.key')
  VALUE=$(echo "$item" | jq -r '.value')

  PUT_REQUEST="{\"PutRequest\":{\"Item\":{\"key\":{\"S\":\"$KEY\"},\"value\":{\"S\":\"$VALUE\"}}}}"
  BATCH+=("$PUT_REQUEST")

  if [[ ${#BATCH[@]} -ge $BATCH_SIZE ]]; then
    flush_batch
  fi
done <<< "$ITEMS"

# Flush remaining items
flush_batch

echo "Seeding complete! $WRITTEN items written to $TABLE_NAME."
