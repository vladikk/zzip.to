# zzip.to — Deployment & Configuration Guide

## Project Overview

**zzip.to** is a serverless URL shortener/redirect service built entirely on AWS. It has two main parts:

1. **Redirect Service** — CloudFront Function + KeyValueStore for ultra-fast global redirects (e.g., `zzip.to/gh` → `https://github.com/*`)
2. **Admin UI** — A React app (Vite/TypeScript) at `admin.zzip.to` for managing links, backed by API Gateway + Lambda + DynamoDB + Cognito auth

## Recent Developments (branch: `links-management-ui`)

The entire admin management layer was added:

- **DynamoDB table + API Gateway** added to CloudFormation
- **Lambda CRUD handlers** — list, create, delete links
- **KVS sync Lambda** — DynamoDB Streams → CloudFront KVS (edits go live automatically)
- **Cognito authentication** with email whitelist (pre-auth Lambda trigger)
- **React admin UI** — login page, links table, add/delete dialogs (Radix UI)
- **Admin UI hosting** — S3 + CloudFront distribution for `admin.zzip.to`
- **Seed script** — migrates from `data/redirects.json` into DynamoDB
- **Deployment scripts** — `deploy.sh`, `deploy-ui.sh`, `destroy.sh`
- Code review completed, all 144 tests passing (105 backend + 39 frontend)

## Prerequisites

- **AWS CLI v2.15.2+** installed and configured with credentials
- **Node.js 18+** (for building the React UI)
- **jq** (for JSON processing in scripts)
- **ACM certificate** in `us-east-1` covering your domain (e.g., `zzip.to` and `*.zzip.to`)
- **Route 53 hosted zone** for your domain

> **Important:** Everything must deploy to **us-east-1** — CloudFront and WAF require it.

## Step 1: Configure Deployment Parameters

```bash
cp config/deploy-params.sh config/deploy-params.local.sh
```

Edit `config/deploy-params.local.sh` with your values:

```bash
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

# Rate limit threshold (requests per 5-minute window per IP)
RATE_LIMIT_THRESHOLD="1000"

# Comma-separated list of email addresses allowed admin access
ALLOWED_EMAILS="admin@example.com"

# Admin UI domain name
ADMIN_DOMAIN_NAME="admin.zzip.to"
```

The `.local.sh` file is gitignored so your secrets stay out of version control.

## Step 2: Deploy the CloudFormation Stack

```bash
./scripts/deploy.sh
```

The script reads from `config/deploy-params.local.sh` automatically. You can also pass arguments directly:

```bash
./scripts/deploy.sh dev zzip-to <cert-arn> <zone-id> zzip.to
```

This creates all AWS resources:

- WAF WebACL (rate limiting + managed rules)
- CloudFront distribution + CloudFront Function + KeyValueStore
- Route 53 DNS records
- Cognito User Pool + Client
- API Gateway REST API (`GET /links`, `PUT /links/{key}`, `DELETE /links/{key}`)
- Lambda functions (CRUD handlers, KVS sync, pre-auth)
- DynamoDB table (with Streams enabled)
- Admin UI S3 bucket + CloudFront distribution

After deployment, the script prints all stack outputs (API endpoint, Cognito IDs, etc.).

## Step 3: Seed Initial Redirects (Optional)

To populate DynamoDB with the default redirects from `data/redirects.json`:

```bash
./scripts/seed-dynamodb.sh <table-name>
```

The table name is in the stack outputs. The KVS sync Lambda will automatically propagate these to CloudFront KVS via DynamoDB Streams.

## Step 4: Build & Deploy the Admin UI

```bash
./scripts/deploy-ui.sh
```

This script automatically:
1. Fetches Cognito and API Gateway values from stack outputs
2. Sets the `VITE_*` environment variables
3. Runs `npm ci && npm run build` in the `ui/` directory
4. Syncs the built files to S3
5. Invalidates the CloudFront cache

You can also pass arguments:

```bash
./scripts/deploy-ui.sh dev zzip-to
```

## Step 5: Create a Cognito Admin User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId-from-stack-outputs> \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password 'TempPass123!' \
  --region us-east-1
```

The email **must** be in your `ALLOWED_EMAILS` list — the pre-auth Lambda rejects all others.

On first login at `https://admin.zzip.to`, you'll be prompted to set a permanent password.

## Step 6: Verify

1. Go to `https://admin.zzip.to` and log in
2. Add, view, and delete links through the UI
3. Test redirects at `https://zzip.to/<key>` — changes propagate automatically via DynamoDB Streams → KVS sync

## Things to Watch Out For

| Constraint | Details |
|---|---|
| **Region** | Must be `us-east-1` (CloudFront/WAF requirement) |
| **IAM capability** | Stack requires `CAPABILITY_NAMED_IAM` (handled by `deploy.sh`) |
| **DynamoDB retention** | Table has `DeletionPolicy: Retain` — survives stack deletion |
| **UI env vars** | Injected at **build time** via Vite (`VITE_*` prefixed), not at runtime |
| **CloudFront Function runtime** | Uses ES6 subset — no `const`/`let`, no arrow functions, no `export` |
| **KVS concurrency** | Uses ETag-based optimistic locking; the sync Lambda handles retries |

## Teardown

To destroy the stack and clean up resources:

```bash
./scripts/destroy.sh dev zzip-to
```

Note: The DynamoDB table is retained by design and must be deleted manually if desired.

## Estimated Cost

At ~1M requests/month: **~$8-10/month** (CloudFront, KVS, WAF, Route 53, S3, Lambda, DynamoDB on-demand).
