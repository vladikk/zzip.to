#!/usr/bin/env bash
set -euo pipefail

# deploy.sh - Automated deployment script for zzip.to redirect service
# Usage: ./deploy.sh <stack-name> <environment> <domain-name> <certificate-arn> [rate-limit]

# Define color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check minimum required arguments
if [ $# -lt 4 ]; then
    log_error "Insufficient arguments"
    echo "Usage: $0 <stack-name> <environment> <domain-name> <certificate-arn> [rate-limit]"
    echo ""
    echo "Arguments:"
    echo "  stack-name       : CloudFormation stack name (e.g., zzipto-redirect)"
    echo "  environment      : Environment (dev, test, or prod)"
    echo "  domain-name      : Domain name (e.g., zzip.to)"
    echo "  certificate-arn  : ACM certificate ARN in us-east-1"
    echo "  rate-limit       : Optional. Requests per IP per 5 min (default: 2000)"
    echo ""
    echo "Example:"
    echo "  $0 zzipto-redirect prod zzip.to arn:aws:acm:us-east-1:123456789012:certificate/abc-123 2000"
    exit 1
fi

STACK_NAME="$1"
ENVIRONMENT="$2"
DOMAIN_NAME="$3"
CERTIFICATE_ARN="$4"
RATE_LIMIT="${5:-2000}"  # Default to 2000 if not provided

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|test|prod)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_error "Must be one of: dev, test, prod"
    exit 1
fi

# Define AWS region constant
AWS_REGION="us-east-1"
log_info "Using AWS region: $AWS_REGION"

# Check AWS CLI is installed
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not found. Please install it first."
    exit 1
fi

# Check Python 3 is installed (for template validation)
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 not found. Please install it first."
    exit 1
fi

# Check template file exists
TEMPLATE_FILE="cloudformation/redirect-service.yaml"
if [ ! -f "$TEMPLATE_FILE" ]; then
    log_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi

log_info "Prerequisites check passed"

# Validate AWS credentials
log_info "Validating AWS credentials..."
if ! aws sts get-caller-identity --region "$AWS_REGION" &> /dev/null; then
    log_error "AWS credentials not configured or invalid"
    log_error "Run: aws configure"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$AWS_REGION")
log_info "Using AWS Account: $AWS_ACCOUNT_ID"

# Validate CloudFormation template
log_info "Validating CloudFormation template..."

# Validate YAML syntax
if ! python3 -c "import yaml; yaml.safe_load(open('$TEMPLATE_FILE'))" 2>/dev/null; then
    log_error "Template has invalid YAML syntax"
    exit 1
fi

# Validate with CloudFormation
if ! aws cloudformation validate-template \
    --template-body "file://$TEMPLATE_FILE" \
    --region "$AWS_REGION" &> /dev/null; then
    log_error "Template validation failed"
    aws cloudformation validate-template \
        --template-body "file://$TEMPLATE_FILE" \
        --region "$AWS_REGION"
    exit 1
fi

log_info "Template validation passed"

# Check if stack already exists
log_info "Checking if stack exists: $STACK_NAME"

STACK_EXISTS=false
if aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" &> /dev/null; then
    STACK_EXISTS=true
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text)
    log_warn "Stack already exists with status: $STACK_STATUS"
else
    log_info "Stack does not exist. Will create new stack."
fi

# Prompt for confirmation
echo ""
log_info "=== Deployment Configuration ==="
echo "Stack Name:       $STACK_NAME"
echo "Environment:      $ENVIRONMENT"
echo "Domain Name:      $DOMAIN_NAME"
echo "Certificate ARN:  $CERTIFICATE_ARN"
echo "Rate Limit:       $RATE_LIMIT requests per IP per 5 min"
echo "AWS Region:       $AWS_REGION"
echo "AWS Account:      $AWS_ACCOUNT_ID"
if [ "$STACK_EXISTS" = true ]; then
    echo "Action:           UPDATE EXISTING STACK"
else
    echo "Action:           CREATE NEW STACK"
fi
echo ""

read -p "Continue with deployment? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log_warn "Deployment cancelled by user"
    exit 0
fi

# Deploy or update stack
if [ "$STACK_EXISTS" = true ]; then
    log_info "Updating stack: $STACK_NAME"

    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --parameters \
            ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
            ParameterKey=DomainName,ParameterValue="$DOMAIN_NAME" \
            ParameterKey=CertificateArn,ParameterValue="$CERTIFICATE_ARN" \
            ParameterKey=RateLimitPerIP,ParameterValue="$RATE_LIMIT" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_IAM

    OPERATION="update"
    WAIT_CONDITION="stack-update-complete"
else
    log_info "Creating stack: $STACK_NAME"

    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE_FILE" \
        --parameters \
            ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
            ParameterKey=DomainName,ParameterValue="$DOMAIN_NAME" \
            ParameterKey=CertificateArn,ParameterValue="$CERTIFICATE_ARN" \
            ParameterKey=RateLimitPerIP,ParameterValue="$RATE_LIMIT" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_IAM

    OPERATION="create"
    WAIT_CONDITION="stack-create-complete"
fi

# Wait for stack operation to complete
log_info "Waiting for stack ${OPERATION} to complete..."
log_warn "This may take 15-30 minutes (CloudFront distribution provisioning)"

if ! aws cloudformation wait "$WAIT_CONDITION" \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION"; then
    log_error "Stack ${OPERATION} failed"

    # Show recent stack events for debugging
    log_error "Recent stack events:"
    aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --max-items 10 \
        --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[ResourceType, ResourceStatus, ResourceStatusReason]' \
        --output table

    exit 1
fi

log_info "Stack ${OPERATION} completed successfully!"

# Retrieve and display stack outputs
log_info "Retrieving stack outputs..."
echo ""
log_info "=== Stack Outputs ==="

aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

# Get specific outputs for instructions
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
    --output text)

DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
    --output text)

KVS_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`KeyValueStoreArn`].OutputValue' \
    --output text)

# Display next steps
echo ""
log_info "=== Next Steps ==="
echo ""
echo "1. Configure DNS:"
echo "   Point $DOMAIN_NAME to: $DISTRIBUTION_DOMAIN"
echo "   (Use ALIAS record in Route 53 or CNAME with external DNS)"
echo ""
echo "2. Add redirect mappings to KeyValueStore:"
echo "   Example (wildcard redirect):"
echo "   aws cloudfront-keyvaluestore put-key \\"
echo "     --kvs-arn $KVS_ARN \\"
echo "     --key gh \\"
echo "     --value 'https://github.com/*' \\"
echo "     --region $AWS_REGION"
echo ""
echo "   Example (exact redirect):"
echo "   aws cloudfront-keyvaluestore put-key \\"
echo "     --kvs-arn $KVS_ARN \\"
echo "     --key docs \\"
echo "     --value 'https://docs.example.com' \\"
echo "     --region $AWS_REGION"
echo ""
echo "3. Test the redirect:"
echo "   curl -I https://$DOMAIN_NAME/gh/test"
echo ""
log_info "Deployment complete!"
