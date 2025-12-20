#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-dev}
STACK_NAME=${2:-zzip-to}

echo "Deleting stack $STACK_NAME-$ENVIRONMENT..."

# Empty logging bucket first (required for deletion)
BUCKET=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --logical-resource-id LoggingBucket \
  --region us-east-1 \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text 2>/dev/null || echo "")

if [[ -n "$BUCKET" ]]; then
  echo "Emptying logging bucket $BUCKET..."
  aws s3 rm "s3://$BUCKET" --recursive || true
fi

aws cloudformation delete-stack \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region us-east-1

echo "Waiting for deletion..."
aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region us-east-1

echo "Stack deleted!"
