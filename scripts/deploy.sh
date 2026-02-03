#!/bin/bash
set -euo pipefail

# Load config file if it exists
if [ -f "config/deploy-params.local.sh" ]; then
  echo "Loading configuration from config/deploy-params.local.sh..."
  source config/deploy-params.local.sh
fi

# Command-line arguments override config file
ENVIRONMENT=${1:-${ENVIRONMENT:-dev}}
STACK_NAME=${2:-${STACK_NAME:-zzip-to}}
CERTIFICATE_ARN=${3:-${CERTIFICATE_ARN:-}}
HOSTED_ZONE_ID=${4:-${HOSTED_ZONE_ID:-}}
DOMAIN_NAME=${5:-${DOMAIN_NAME:-zzip.to}}
RATE_LIMIT_THRESHOLD=${RATE_LIMIT_THRESHOLD:-1000}
ALLOWED_EMAILS=${ALLOWED_EMAILS:-}
ADMIN_DOMAIN_NAME=${ADMIN_DOMAIN_NAME:-admin.zzip.to}
REGION=${REGION:-us-east-1}

if [[ -z "$CERTIFICATE_ARN" || -z "$HOSTED_ZONE_ID" || -z "$ALLOWED_EMAILS" ]]; then
  echo "Usage: ./scripts/deploy.sh [environment] [stack-name] [certificate-arn] [hosted-zone-id] [domain-name]"
  echo ""
  echo "Parameters can be provided via:"
  echo "  1. Command-line arguments (highest priority)"
  echo "  2. config/deploy-params.local.sh file"
  echo ""
  echo "To use a config file:"
  echo "  cp config/deploy-params.sh config/deploy-params.local.sh"
  echo "  # Edit deploy-params.local.sh with your values"
  echo "  ./scripts/deploy.sh"
  exit 1
fi

echo "Deploying $STACK_NAME ($ENVIRONMENT) to $REGION..."

aws cloudformation deploy \
  --template-file cloudformation/template.yaml \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region "$REGION" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    CertificateArn="$CERTIFICATE_ARN" \
    HostedZoneId="$HOSTED_ZONE_ID" \
    DomainName="$DOMAIN_NAME" \
    RateLimitThreshold="$RATE_LIMIT_THRESHOLD" \
    AllowedEmails="$ALLOWED_EMAILS" \
    AdminDomainName="$ADMIN_DOMAIN_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

echo "Deployment complete!"

echo "Creating new API Gateway deployment to ensure latest configuration is active..."
API_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text | sed 's|https://||' | cut -d. -f1)

if [ -n "$API_ID" ]; then
  aws apigateway create-deployment \
    --rest-api-id "$API_ID" \
    --stage-name "$ENVIRONMENT" \
    --region "$REGION" > /dev/null
  echo "API Gateway deployment updated."
else
  echo "Warning: Could not determine API Gateway ID. API deployment may need manual update."
fi

echo "Fetching outputs..."
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output table
