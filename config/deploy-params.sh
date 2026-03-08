#!/bin/bash
# Deployment configuration parameters
# Copy this file to deploy-params.local.sh and fill in your values
# The .local.sh file is gitignored for security

# Environment (prod, test, or dev)
ENVIRONMENT="dev"

# Stack name
STACK_NAME="zzip-to"

# ACM Certificate ARN (must be in us-east-1)
CERTIFICATE_ARN="arn:aws:acm:us-east-1:123456789012:certificate/YOUR_CERT_ID"

# Route 53 Hosted Zone ID
HOSTED_ZONE_ID="YOUR_HOSTED_ZONE_ID"

# Domain name
DOMAIN_NAME="zzip.to"

# Comma-separated list of email addresses allowed admin access (required)
ALLOWED_EMAILS="admin@example.com"

# Admin UI domain name
ADMIN_DOMAIN_NAME="admin.zzip.to"
