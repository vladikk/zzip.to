#!/bin/bash
set -euo pipefail

# One-time migration script: seeds the DynamoDB LinksTable from data/redirects.json.
# Use this script after deploying the CloudFormation stack to migrate existing
# file-based redirects into DynamoDB. Once migrated, all redirect management
# should be done through the admin UI at admin.zzip.to.

TABLE_NAME=${1:-}
DATA_FILE=${2:-data/redirects.json}
REGION=${REGION:-us-east-1}

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

  # Build the request items JSON using jq for safe escaping
  local request_items
  request_items=$(printf '%s\n' "${BATCH[@]}" | jq -s '.')

  local request_json
  request_json=$(jq -n --arg table "$TABLE_NAME" --argjson items "$request_items" '{($table): $items}')

  local response
  response=$(aws dynamodb batch-write-item \
    --region "$REGION" \
    --request-items "$request_json" \
    --output json)

  # Check for unprocessed items and retry with backoff
  local unprocessed
  unprocessed=$(echo "$response" | jq -r ".UnprocessedItems.\"$TABLE_NAME\" // [] | length")
  local retry_count=0
  local max_retries=5
  while [[ "$unprocessed" -gt 0 && "$retry_count" -lt "$max_retries" ]]; do
    retry_count=$((retry_count + 1))
    local sleep_time=$((retry_count * 2))
    echo "  WARNING: $unprocessed items unprocessed. Retry $retry_count/$max_retries (backoff ${sleep_time}s)..."
    sleep "$sleep_time"
    response=$(aws dynamodb batch-write-item \
      --region "$REGION" \
      --request-items "$(echo "$response" | jq '.UnprocessedItems')" \
      --output json)
    unprocessed=$(echo "$response" | jq -r ".UnprocessedItems.\"$TABLE_NAME\" // [] | length")
  done
  if [[ "$unprocessed" -gt 0 ]]; then
    echo "  ERROR: $unprocessed items still unprocessed after $max_retries retries. Aborting."
    exit 1
  fi

  WRITTEN=$((WRITTEN + ${#BATCH[@]}))
  echo "  Written $WRITTEN / $ITEM_COUNT items..."
  BATCH=()
}

while read -r item; do
  # Use jq for safe JSON construction to avoid injection via special characters
  PUT_REQUEST=$(echo "$item" | jq -c '{PutRequest: {Item: {key: {S: .key}, value: {S: .value}}}}')
  BATCH+=("$PUT_REQUEST")

  if [[ ${#BATCH[@]} -ge $BATCH_SIZE ]]; then
    flush_batch
  fi
done <<< "$ITEMS"

# Flush remaining items
flush_batch

echo "Seeding complete! $WRITTEN items written to $TABLE_NAME."
