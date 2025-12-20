#!/bin/bash
# Deployment configuration parameters
# Copy this file to deploy-params.local.sh and fill in your values
# The .local.sh file is gitignored for security

# Environment (prod, test, or dev)
ENVIRONMENT="dev"

# Stack name
STACK_NAME="zziptodev"

# ACM Certificate ARN (must be in us-east-1)
CERTIFICATE_ARN="arn:aws:acm:us-east-1:594884061901:certificate/YOUR_CERT_ID"

# Route 53 Hosted Zone ID
HOSTED_ZONE_ID="YOUR_HOSTED_ZONE_ID"

# Domain name
DOMAIN_NAME="zzip.to"

# Rate limit threshold (requests per 5-minute window)
RATE_LIMIT_THRESHOLD="1000"
