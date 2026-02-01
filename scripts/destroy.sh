#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-dev}
STACK_NAME=${2:-zzip-to}
REGION=${REGION:-us-east-1}

echo "Deleting stack $STACK_NAME-$ENVIRONMENT in $REGION..."

# Empty logging bucket first (required for deletion)
BUCKET=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --logical-resource-id LoggingBucket \
  --region "$REGION" \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text 2>/dev/null || echo "")

if [[ -n "$BUCKET" ]]; then
  echo "Emptying logging bucket $BUCKET..."
  aws s3 rm "s3://$BUCKET" --recursive || true
fi

# Empty admin UI bucket (required for deletion)
ADMIN_BUCKET=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --logical-resource-id AdminBucket \
  --region "$REGION" \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text 2>/dev/null || echo "")

if [[ -n "$ADMIN_BUCKET" ]]; then
  echo "Emptying admin UI bucket $ADMIN_BUCKET..."
  aws s3 rm "s3://$ADMIN_BUCKET" --recursive || true
fi

# Empty dummy origin bucket (required for deletion)
DUMMY_BUCKET=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --logical-resource-id DummyOriginBucket \
  --region "$REGION" \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text 2>/dev/null || echo "")

if [[ -n "$DUMMY_BUCKET" ]]; then
  echo "Emptying dummy origin bucket $DUMMY_BUCKET..."
  aws s3 rm "s3://$DUMMY_BUCKET" --recursive || true
fi

aws cloudformation delete-stack \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region "$REGION"

echo "Waiting for deletion..."
aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region "$REGION"

echo "Stack deleted!"
