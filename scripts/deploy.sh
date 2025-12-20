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

if [[ -z "$CERTIFICATE_ARN" || -z "$HOSTED_ZONE_ID" ]]; then
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

echo "Deploying $STACK_NAME ($ENVIRONMENT) to us-east-1..."

aws cloudformation deploy \
  --template-file cloudformation/template.yaml \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region us-east-1 \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    CertificateArn="$CERTIFICATE_ARN" \
    HostedZoneId="$HOSTED_ZONE_ID" \
    DomainName="$DOMAIN_NAME" \
    RateLimitThreshold="$RATE_LIMIT_THRESHOLD" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo "Deployment complete!"
echo "Fetching outputs..."
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
