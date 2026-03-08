# zzip.to - CloudFront URL Redirect Service

A serverless URL redirect service built on AWS CloudFront Functions with KeyValueStore for redirect mappings. Provides fast, globally distributed redirects with an admin UI for managing links.

## Features

- **Fast Redirects**: CloudFront edge locations for global low-latency redirects
- **Wildcard Support**: Exact redirects and wildcard redirects with path preservation
- **Path Validation**: Strict path validation to prevent traversal attacks
- **Observability**: CloudFront access logs and CloudWatch metrics
- **Scalable**: KeyValueStore for dynamic redirect mappings without redeployment
- **Admin UI**: Web-based management interface for creating, viewing, and deleting redirects
- **Authenticated**: Cognito-based auth with email whitelist for admin access

## Architecture

- **CloudFront Distribution**: Global CDN with custom domain and HTTPS
- **CloudFront Function**: Lightweight edge function for redirect logic
- **KeyValueStore**: Fast key-value storage for redirect mappings
- **Route 53**: DNS alias records for domain routing
- **S3**: Logging bucket for access logs
- **Admin UI**: React SPA hosted on CloudFront (`admin.zzip.to`) for managing redirects
- **API Gateway**: REST API with Cognito authorization for CRUD operations
- **Cognito User Pool**: Authentication with email whitelist enforcement
- **DynamoDB**: Persistent storage for redirect mappings with stream-based KVS sync
- **DynamoDB Streams + Lambda**: Automatic sync from DynamoDB to CloudFront KVS on every change

### Data Flow

When redirects are managed through the admin UI, changes flow through the system as follows:

```
Admin UI -> API Gateway (Cognito auth) -> Lambda -> DynamoDB (write)
                                                       |
                                                  DynamoDB Stream
                                                       |
                                                  KVS Sync Lambda -> CloudFront KVS (update)
                                                       |
                                              Edge redirect function reads from KVS
```

- INSERT/MODIFY events in DynamoDB trigger a `PutKey` call to CloudFront KVS
- REMOVE events trigger a `DeleteKey` call to CloudFront KVS
- The sync is near-real-time (typically under a few seconds)

## Prerequisites

Before deploying, ensure you have:

1. **AWS CLI v2**: Installed and configured with appropriate credentials
2. **ACM Certificate**: SSL certificate in us-east-1 covering both `zzip.to` and `*.zzip.to`
3. **Route 53 Hosted Zone**: DNS hosted zone for your domain
4. **Node.js 20+**: For building the UI and running tests
5. **jq**: JSON processor (used by utility scripts)

## Deployment

### Option A: GitHub Actions (Recommended)

Pushes to `main` trigger automatic deployment via `.github/workflows/deploy.yml`. See `.github/SETUP.md` for configuring GitHub OIDC and required variables/secrets.

### Option B: Local Deployment

Create a local configuration file with your deployment parameters:

```bash
cp config/deploy-params.sh config/deploy-params.local.sh
# Edit with your values
vim config/deploy-params.local.sh
# Deploy
./scripts/deploy.sh
```

The `deploy-params.local.sh` file is gitignored for security.

The deployment will:
- Package and upload the KVS sync Lambda
- Create/update the CloudFormation stack in us-east-1
- Deploy CloudFront, KVS, Cognito, API Gateway, DynamoDB, and Lambda handlers
- Configure Route 53 DNS records for both `zzip.to` and `admin.zzip.to`

**Note:** Initial CloudFront deployment takes 5-10 minutes to propagate globally.

### Deploy the Admin UI

```bash
./scripts/deploy-ui.sh
```

This builds the React app with the correct Cognito/API config from stack outputs, syncs files to S3, and invalidates the CloudFront cache.

### Create an Admin User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true \
  --temporary-password 'TempPass123!' \
  --region us-east-1
```

The email must be in the `AllowedEmails` parameter passed during stack deployment. On first login, you'll be prompted to change the temporary password.

### Verify Deployment

```bash
# Test exact redirect
curl -I https://zzip.to/docs

# Test wildcard redirect
curl -I https://zzip.to/gh/vladikk

# Test 404 response
curl -I https://zzip.to/unknown
```

## Testing

### Backend Tests

```bash
./scripts/test.sh
```

Covers CloudFront redirect function, Lambda CRUD handlers, KVS sync Lambda, and pre-auth Lambda.

### Frontend Tests

```bash
cd ui && npm test
```

Covers authentication flow, links management, API client, and form validation.

## Operations

### Managing Redirects

Redirects are managed through the admin UI at `https://admin.zzip.to`. Log in with a whitelisted Cognito user to add, update, or delete redirect links. Changes are automatically synced to CloudFront KeyValueStore via DynamoDB Streams.

**Redirect types:**
- **Exact redirect**: `https://example.com` — Only matches `/key` exactly
- **Wildcard redirect**: `https://example.com/*` — Matches `/key` and `/key/path`

### Bulk Loading (Fallback)

The `populate-kvs.sh` script and GitHub Actions workflow can bulk-load redirects from a JSON file if needed:

```bash
./scripts/populate-kvs.sh "$KVS_ARN" redirects.json
```

### Monitor the Service

**CloudWatch Metrics:**
- Navigate to CloudWatch > Metrics > CloudFront
- Key metrics: `Requests`, `4xxErrorRate`, `5xxErrorRate`, `BytesDownloaded`

**Access Logs:**
- Stored in S3: `s3://<env>-<stack>-cf-logs-<account-id>/<env>/`

### Troubleshooting

**404 responses for valid keys:**
1. Verify key exists in KVS: `aws cloudfront-keyvaluestore list-keys --kvs-arn "$KVS_ARN"`
2. Check key spelling and case sensitivity
3. Check KVS sync Lambda logs in CloudWatch for sync errors

**502/503 errors:**
1. Check CloudFront function execution errors in CloudWatch Logs
2. Validate function code syntax
3. Verify KVS is associated with function

**DNS not resolving:**
1. Verify Route 53 records created
2. Check domain registrar nameservers point to Route 53
3. Wait for DNS propagation (up to 48 hours)

## Local Development

```bash
cd ui
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. Ensure the `.env` file is configured with valid stack outputs.

## Stack Deletion

```bash
./scripts/destroy.sh <environment> <stack-name>
```

This empties S3 buckets, deletes the CloudFormation stack, and removes all resources. CloudFront distribution deletion can take 15-30 minutes.

## Configuration

### Path Validation Rules

The redirect function enforces strict path validation:
- **Max length**: 256 characters
- **Allowed characters**: `A-Z a-z 0-9 _ - /`
- **Blocked patterns**: `..` (path traversal), `//` (empty segments), `%2F` (encoded slashes)

### Cache Settings

Redirects are cached at CloudFront edges with `Cache-Control: public, max-age=86400` (24 hours). To invalidate:

```bash
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

## Security

- **HTTPS Only**: All HTTP requests redirected to HTTPS
- **TLS 1.2+**: Modern TLS protocols only
- **No Credentials in Code**: All AWS access via IAM roles
- **Private S3 Buckets**: All S3 buckets block public access
- **Input Validation**: Strict path validation prevents injection attacks

## Cost Estimate

Approximate monthly costs (us-east-1, assuming 1M requests):
- CloudFront: ~$1.85 (requests + data transfer)
- CloudFront Function: $0.10 (invocations)
- KeyValueStore: ~$0.45 (storage + reads)
- Route 53: ~$0.90 (hosted zone + queries)
- S3: ~$0.02 (logs storage)
- DynamoDB, Lambda, API Gateway, Cognito: free tier for low usage

**Total: ~$3-4/month for 1M requests**

## Architecture Decisions

### Why CloudFront Functions?

- **Performance**: < 1ms execution at edge locations
- **Cost**: $0.10 per million invocations
- **Global**: Runs at all CloudFront edge locations
- **Lightweight**: No cold starts, instant execution

### Why KeyValueStore?

- **Speed**: Ultra-low latency reads from edge
- **Dynamic**: Update redirects without redeployment
- **Simple**: Key-value pairs, no database management

### Why us-east-1?

- **ACM Certificates**: CloudFront requires certificates in us-east-1
- **Global Scope**: CloudFront resources are global despite the region

## License

Copyright 2024. All rights reserved.
