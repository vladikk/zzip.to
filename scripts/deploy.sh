#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-dev}
STACK_NAME=${2:-zzip-to}
CERTIFICATE_ARN=${3:-}
HOSTED_ZONE_ID=${4:-}
DOMAIN_NAME=${5:-zzip.to}

if [[ -z "$CERTIFICATE_ARN" || -z "$HOSTED_ZONE_ID" ]]; then
  echo "Usage: ./scripts/deploy.sh <environment> <stack-name> <certificate-arn> <hosted-zone-id> [domain-name]"
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
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo "Deployment complete!"
echo "Fetching outputs..."
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME-$ENVIRONMENT" \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
