# zzip.to - CloudFront URL Redirect Service

A serverless URL redirect service built on AWS CloudFront Functions with KeyValueStore for redirect mappings. Provides fast, globally distributed redirects with WAF protection and rate limiting.

## Features

- **Fast Redirects**: CloudFront edge locations for global low-latency redirects
- **Wildcard Support**: Exact redirects and wildcard redirects with path preservation
- **Security**: WAF protection with AWS Managed Rules and rate limiting (1000 req/5min per IP)
- **Path Validation**: Strict path validation to prevent traversal attacks
- **Observability**: CloudFront access logs, WAF logs, and CloudWatch metrics
- **Scalable**: KeyValueStore for dynamic redirect mappings without redeployment

## Architecture

- **CloudFront Distribution**: Global CDN with custom domain and HTTPS
- **CloudFront Function**: Lightweight edge function for redirect logic
- **KeyValueStore**: Fast key-value storage for redirect mappings
- **WAF**: Web Application Firewall with managed rule sets and rate limiting
- **Route 53**: DNS alias records for domain routing
- **S3**: Logging bucket for access logs

## Prerequisites

Before deploying, ensure you have:

1. **AWS CLI v2**: Installed and configured with appropriate credentials
   ```bash
   aws --version
   ```

2. **ACM Certificate**: SSL certificate in us-east-1 region
   - Must be validated and issued
   - Must cover your domain name (e.g., zzip.to)
   - Get the certificate ARN from ACM console

3. **Route 53 Hosted Zone**: DNS hosted zone for your domain
   - Get the hosted zone ID from Route 53 console

4. **jq**: JSON processor for KVS population script
   ```bash
   brew install jq  # macOS
   sudo apt-get install jq  # Linux
   ```

5. **Node.js 18+**: For running tests
   ```bash
   node --version
   ```

## Deployment

### 1. Validate CloudFormation Template

```bash
aws cloudformation validate-template \
  --template-body file://cloudformation/template.yaml \
  --region us-east-1
```

### 2. Deploy the Stack

#### Option A: Using Configuration File (Recommended)

Create a local configuration file with your deployment parameters:

```bash
# Copy the template
cp config/deploy-params.sh config/deploy-params.local.sh

# Edit with your values
vim config/deploy-params.local.sh

# Deploy using config file
./scripts/deploy.sh
```

The `deploy-params.local.sh` file is gitignored for security.

#### Option B: Using Command-Line Arguments

```bash
./scripts/deploy.sh <environment> <stack-name> <certificate-arn> <hosted-zone-id> [domain-name]
```

**Example:**
```bash
./scripts/deploy.sh dev zzip-to \
  arn:aws:acm:us-east-1:123456789012:certificate/abc-123 \
  Z1234EXAMPLE \
  zzip.to
```

**Parameters:**
- `environment`: Environment name (dev, test, or prod)
- `stack-name`: Base name for CloudFormation stack
- `certificate-arn`: ARN of ACM certificate (must be in us-east-1)
- `hosted-zone-id`: Route 53 hosted zone ID
- `domain-name`: Domain name (default: zzip.to)
- `rate-limit-threshold`: Max requests per 5min per IP (default: 1000)

**Note:** Command-line arguments override config file values.

The deployment will:
- Create CloudFormation stack in us-east-1
- Deploy WAF, CloudFront, KVS, and all resources
- Configure Route 53 DNS records
- Output stack details including KVS ARN

**Note:** Initial CloudFront deployment takes 5-10 minutes to propagate globally.

### 3. Populate KeyValueStore

After deployment, get the KVS ARN from the stack outputs and populate it with redirect mappings:

```bash
# Get KVS ARN from stack outputs
KVS_ARN=$(aws cloudformation describe-stacks \
  --stack-name zzip-to-dev \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KeyValueStoreArn`].OutputValue' \
  --output text)

# Populate with sample data
./scripts/populate-kvs.sh "$KVS_ARN" data/redirects.json
```

**Custom redirect data:**

Edit `data/redirects.json` or create your own:

```json
[
  { "key": "gh", "value": "https://github.com/*" },
  { "key": "docs", "value": "https://docs.example.com" },
  { "key": "blog", "value": "https://blog.example.com/*" }
]
```

**Redirect types:**
- **Exact redirect**: `"value": "https://example.com"` - Only matches `/key` exactly
- **Wildcard redirect**: `"value": "https://example.com/*"` - Matches `/key` and `/key/path`

### 4. Verify Deployment

Test redirects:

```bash
# Test exact redirect
curl -I https://zzip.to/docs

# Test wildcard redirect
curl -I https://zzip.to/gh/vladikk

# Test 404 response
curl -I https://zzip.to/unknown
```

## Testing

### Run Unit Tests

```bash
./scripts/test.sh
```

This runs all test cases covering:
- Root path handling
- Exact and wildcard redirects
- Query string preservation
- Path validation (traversal, length, characters)
- Unknown key handling
- All helper functions

### Validate Scripts

```bash
# Validate bash syntax
bash -n scripts/deploy.sh
bash -n scripts/populate-kvs.sh
bash -n scripts/destroy.sh

# Validate CloudFormation template
aws cloudformation validate-template \
  --template-body file://cloudformation/template.yaml \
  --region us-east-1
```

## Operations

### Update Redirect Mappings

#### Option A: Using GitHub Actions (Recommended)

The repository includes a GitHub Actions workflow that automatically updates the KeyValueStore when you commit changes to `data/redirects.json`.

**Setup:**

1. Go to your GitHub repository Settings → Secrets and variables → Actions

2. Add the following **Secrets**:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key

3. Add the following **Variables**:
   - `KVS_ARN`: Your KeyValueStore ARN (from deployment outputs)

**Usage:**

Simply edit `data/redirects.json` and commit to the `main` branch:

```bash
# Edit redirects
vim data/redirects.json

# Commit and push
git add data/redirects.json
git commit -m "Update redirects"
git push origin main
```

The workflow will automatically populate the KVS with your changes.

You can also manually trigger the workflow from the Actions tab with a custom data file path.

#### Option B: Manual Update via CLI

```bash
# Add or update a single redirect
aws cloudfront-keyvaluestore put-key \
  --kvs-arn "$KVS_ARN" \
  --key "newkey" \
  --value "https://example.com/*" \
  --if-match "$(aws cloudfront-keyvaluestore describe-key-value-store \
    --kvs-arn "$KVS_ARN" \
    --query 'ETag' \
    --output text)"

# Or bulk update from JSON file
./scripts/populate-kvs.sh "$KVS_ARN" data/redirects.json
```

### Update Function Code

If you need to update the redirect logic:

1. Edit `functions/redirect.js`
2. Update the corresponding code in `cloudformation/template.yaml` (lines 104-227)
3. Redeploy the stack

```bash
./scripts/deploy.sh dev zzip-to <cert-arn> <zone-id>
```

Function updates typically propagate in under 1 minute.

### Monitor the Service

**CloudWatch Metrics:**
- Navigate to CloudWatch → Metrics → CloudFront
- Key metrics:
  - `Requests`: Total request count
  - `4xxErrorRate`: Client error rate (404s for unknown keys)
  - `5xxErrorRate`: Server error rate
  - `BytesDownloaded`: Data transfer

**WAF Metrics:**
- Navigate to CloudWatch → Metrics → WAF
- Key metrics:
  - `BlockedRequests`: Requests blocked by WAF
  - `AllowedRequests`: Requests allowed through
  - Rate limit triggers

**Access Logs:**
- Logs are stored in S3: `s3://<env>-<stack>-cf-logs-<account-id>/<env>/`
- Logs include: timestamp, edge location, status code, user agent, etc.

```bash
# List recent logs
aws s3 ls s3://dev-zzip-to-cf-logs-123456789012/dev/ --recursive | tail -20

# Download and analyze logs
aws s3 cp s3://dev-zzip-to-cf-logs-123456789012/dev/ . --recursive
```

### Troubleshooting

**404 responses for valid keys:**
1. Verify key exists in KVS:
   ```bash
   aws cloudfront-keyvaluestore list-keys --kvs-arn "$KVS_ARN"
   ```
2. Check key spelling and case sensitivity
3. Wait for KVS updates to propagate (usually instant)

**502/503 errors:**
1. Check CloudFront function execution errors in CloudWatch Logs
2. Validate function code syntax
3. Verify KVS is associated with function

**DNS not resolving:**
1. Verify Route 53 records created
2. Check domain registrar nameservers point to Route 53
3. Wait for DNS propagation (up to 48 hours)

**WAF blocking legitimate traffic:**
1. Check WAF logs in CloudWatch
2. Review blocked requests in WAF console
3. Adjust rate limit threshold if needed:
   ```bash
   aws cloudformation deploy \
     --template-file cloudformation/template.yaml \
     --stack-name zzip-to-dev \
     --parameter-overrides RateLimitThreshold=2000 \
     --region us-east-1
   ```

## Stack Deletion

To delete the entire stack and all resources:

```bash
./scripts/destroy.sh <environment> <stack-name>
```

**Example:**
```bash
./scripts/destroy.sh dev zzip-to
```

This will:
1. Empty the S3 logging bucket
2. Delete the CloudFormation stack
3. Remove all resources (CloudFront, KVS, WAF, etc.)
4. Delete Route 53 records

**Note:** CloudFront distribution deletion can take 15-30 minutes.

## Configuration

### Rate Limiting

Adjust rate limit threshold in CloudFormation parameters:
- Default: 1000 requests per 5 minutes per IP
- Modify: Update `RateLimitThreshold` parameter during deployment

### Path Validation Rules

The redirect function enforces strict path validation:
- **Max length**: 256 characters
- **Allowed characters**: `A-Z a-z 0-9 _ - /`
- **Blocked patterns**:
  - `..` (path traversal)
  - `//` (empty segments)
  - `%2F` and `%2f` (encoded slashes)

To modify validation rules, edit `validatePath()` in `functions/redirect.js` and update the CloudFormation template.

### Cache Settings

Redirects are cached at CloudFront edges:
- **Cache-Control**: `public, max-age=86400` (24 hours)
- To invalidate cache after redirect changes:
  ```bash
  aws cloudfront create-invalidation \
    --distribution-id <distribution-id> \
    --paths "/*"
  ```

## Security

- **HTTPS Only**: All HTTP requests redirected to HTTPS
- **TLS 1.2+**: Modern TLS protocols only
- **WAF Protection**: AWS Managed Rules for common threats
- **Rate Limiting**: Per-IP rate limiting prevents abuse
- **No Credentials in Code**: All AWS access via IAM roles
- **Private S3 Buckets**: All S3 buckets block public access
- **Input Validation**: Strict path validation prevents injection attacks

## Cost Estimate

Approximate monthly costs (us-east-1, assuming 1M requests):
- CloudFront: $1.00 (requests) + $0.85 (data transfer)
- CloudFront Function: $0.10 (1M invocations)
- KeyValueStore: $0.25 (storage) + $0.20 (reads)
- WAF: $5.00 (WebACL) + $1.00 (rules)
- Route 53: $0.50 (hosted zone) + $0.40 (queries)
- S3: $0.02 (logs storage)

**Total: ~$8-10/month for 1M requests**

Costs scale linearly with request volume.

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
- **Secure**: No public access, IAM controlled

### Why us-east-1?

- **CloudFront WAF**: Must be deployed in us-east-1
- **ACM Certificates**: CloudFront requires certs in us-east-1
- **Global Scope**: Resources are global despite region

## Contributing

This is a production redirect service. Changes should:
1. Pass all tests: `./scripts/test.sh`
2. Validate CloudFormation syntax
3. Be tested in dev environment before production

## License

Copyright 2024. All rights reserved.
