#!/bin/bash
set -euo pipefail

# Load config file if it exists
if [ -f "config/deploy-params.local.sh" ]; then
  echo "Loading configuration from config/deploy-params.local.sh..."
  source config/deploy-params.local.sh
fi

ENVIRONMENT=${1:-${ENVIRONMENT:-dev}}
STACK_NAME=${2:-${STACK_NAME:-zzip-to}}
REGION=${REGION:-us-east-1}

FULL_STACK_NAME="$STACK_NAME-$ENVIRONMENT"

echo "Fetching stack outputs for $FULL_STACK_NAME..."

ADMIN_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$FULL_STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminBucketName'].OutputValue" \
  --output text)

ADMIN_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$FULL_STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AdminDistributionId'].OutputValue" \
  --output text)

if [[ -z "$ADMIN_BUCKET" || -z "$ADMIN_DISTRIBUTION_ID" ]]; then
  echo "Error: Could not fetch AdminBucketName or AdminDistributionId from stack outputs."
  echo "Make sure the stack $FULL_STACK_NAME is deployed with the admin UI resources."
  exit 1
fi

echo "Admin bucket: $ADMIN_BUCKET"
echo "Admin distribution: $ADMIN_DISTRIBUTION_ID"

echo "Building UI..."
cd ui
npm ci
npm run build
cd ..

echo "Syncing build output to S3..."
aws s3 sync ui/dist/ "s3://$ADMIN_BUCKET" \
  --delete \
  --region "$REGION"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$ADMIN_DISTRIBUTION_ID" \
  --paths "/*" \
  --region "$REGION"

echo "UI deployment complete!"
