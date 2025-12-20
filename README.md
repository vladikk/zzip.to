# zzip.to - Edge-Based URL Redirect Service

AWS CloudFront-based URL shortener using KeyValueStore for fast, global redirects with no servers or Lambda functions.

## Architecture

- **CloudFront Distribution**: Terminates HTTPS and routes requests
- **CloudFront Function**: Executes redirect logic at the edge
- **CloudFront KeyValueStore**: Stores redirect mappings
- **AWS WAF**: Rate limiting and security rules
- **S3**: Access logs storage

## Features

- Fast edge-based redirects (301 permanent)
- Wildcard/prefix redirect support
- Query string preservation
- Path validation and security checks
- Rate limiting per IP
- Global edge deployment
- No servers or Lambda (low cost, low latency)

## Prerequisites

1. **AWS Account** with appropriate permissions:
   - CloudFormation: Full access
   - CloudFront: Full access
   - WAF: Full access
   - S3: Create/manage buckets
   - IAM: Pass role (for CloudFormation)

2. **AWS CLI** installed and configured:
   ```bash
   aws --version
   aws configure
   ```

3. **ACM Certificate** in `us-east-1` region:
   - Certificate must be for your domain (e.g., `zzip.to` or `*.zzip.to`)
   - Must be in `us-east-1` (CloudFront requirement)
   - Note the certificate ARN (format: `arn:aws:acm:us-east-1:123456789012:certificate/...`)

   To create a certificate:
   ```bash
   aws acm request-certificate \
     --domain-name zzip.to \
     --validation-method DNS \
     --region us-east-1
   ```

4. **Domain DNS Access**:
   - Ability to create DNS records (Route 53 or external DNS provider)

5. **Python 3** (for validation scripts):
   ```bash
   python3 --version
   ```

## Project Structure

```
.
├── cloudformation/
│   └── redirect-service.yaml      # Main CloudFormation template
├── functions/
│   └── redirect-function.js       # CloudFront Function code
├── tests/
│   └── function-test-cases.md     # Test scenarios
├── README.md                       # This file
└── requirements.md                 # Architecture requirements
```

## Deployment

### Step 1: Validate Template

Before deploying, validate the CloudFormation template:

```bash
aws cloudformation validate-template \
  --template-body file://cloudformation/redirect-service.yaml
```

Should return template details without errors.

### Step 2: Deploy Stack

Deploy using CloudFormation CLI:

```bash
aws cloudformation create-stack \
  --stack-name zzipto-redirect \
  --template-body file://cloudformation/redirect-service.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=prod \
    ParameterKey=DomainName,ParameterValue=zzip.to \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:YOUR_ACCOUNT:certificate/YOUR_CERT_ID \
    ParameterKey=RateLimitPerIP,ParameterValue=2000 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM
```

**Parameter Descriptions:**

- `Environment`: Deployment environment (`dev`, `test`, or `prod`)
- `DomainName`: Your domain name (e.g., `zzip.to`)
- `CertificateArn`: ARN of ACM certificate in us-east-1
- `RateLimitPerIP`: Max requests per IP per 5 minutes (default: 2000)

**Important Notes:**
- Stack name will be used as prefix for all resources
- Must deploy to `us-east-1` region (CloudFront/WAF requirement)
- Deployment takes 15-30 minutes (CloudFront distribution creation)

### Step 3: Monitor Deployment

Check deployment status:

```bash
aws cloudformation describe-stacks \
  --stack-name zzipto-redirect \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'
```

Wait for status: `CREATE_COMPLETE`

Get stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name zzipto-redirect \
  --region us-east-1 \
  --query 'Stacks[0].Outputs'
```

Note these output values:
- `DistributionId`: CloudFront distribution ID
- `DistributionDomainName`: CloudFront domain (e.g., `d1234567890.cloudfront.net`)
- `KeyValueStoreId`: KVS ID for adding redirect mappings

### Step 4: Configure DNS

Create a CNAME or ALIAS record pointing your domain to the CloudFront distribution:

**Option A: Using Route 53 (ALIAS record - recommended):**

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "zzip.to",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234567890.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

Note: `Z2FDTNDATAQYW2` is the hosted zone ID for ALL CloudFront distributions.

**Option B: Using external DNS (CNAME record):**

Create CNAME record:
- Name: `zzip.to`
- Value: `d1234567890.cloudfront.net` (from DistributionDomainName output)
- TTL: 300

### Step 5: Add Redirect Mappings to KeyValueStore

The KeyValueStore is empty after deployment. Add redirect mappings using AWS CLI:

**Format:**
- Key: First path segment (e.g., `gh`)
- Value: Target URL
  - Exact redirect: `https://example.com` (no trailing /*)
  - Wildcard redirect: `https://example.com/*` (with trailing /*)

**Example: Add wildcard redirect for GitHub:**

```bash
aws cloudfront-keyvaluestore put-key \
  --kvs-arn arn:aws:cloudfront::YOUR_ACCOUNT:key-value-store/YOUR_KVS_ID \
  --key gh \
  --value "https://github.com/*" \
  --region us-east-1
```

**Example: Add exact redirect:**

```bash
aws cloudfront-keyvaluestore put-key \
  --kvs-arn arn:aws:cloudfront::YOUR_ACCOUNT:key-value-store/YOUR_KVS_ID \
  --key docs \
  --value "https://docs.example.com" \
  --region us-east-1
```

**List all mappings:**

```bash
aws cloudfront-keyvaluestore list-keys \
  --kvs-arn arn:aws:cloudfront::YOUR_ACCOUNT:key-value-store/YOUR_KVS_ID \
  --region us-east-1
```

**Delete a mapping:**

```bash
aws cloudfront-keyvaluestore delete-key \
  --kvs-arn arn:aws:cloudfront::YOUR_ACCOUNT:key-value-store/YOUR_KVS_ID \
  --key gh \
  --region us-east-1
```

**Important:** Changes to KeyValueStore propagate to edge locations within seconds to minutes (eventual consistency).

## Usage Examples

After deployment and adding mappings to KeyValueStore:

### Example 1: Wildcard Redirect

**KVS Mapping:**
```
Key: gh
Value: https://github.com/*
```

**Requests:**
- `https://zzip.to/gh` → `https://github.com/`
- `https://zzip.to/gh/vladikk` → `https://github.com/vladikk`
- `https://zzip.to/gh/vladikk/repos` → `https://github.com/vladikk/repos`
- `https://zzip.to/gh/vladikk?tab=repos` → `https://github.com/vladikk?tab=repos`

### Example 2: Exact Redirect

**KVS Mapping:**
```
Key: docs
Value: https://docs.example.com
```

**Requests:**
- `https://zzip.to/docs` → `https://docs.example.com`
- `https://zzip.to/docs/guide` → `404 Not Found` (exact redirect doesn't allow extra path)

### Example 3: Multiple Redirects

```bash
# Add multiple mappings
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key gh --value "https://github.com/*"
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key tw --value "https://twitter.com/*"
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key home --value "https://example.com"
```

Test:
- `https://zzip.to/gh/username`
- `https://zzip.to/tw/username`
- `https://zzip.to/home`

## Updating the Stack

### Update CloudFormation Stack

To update parameters or configuration:

```bash
aws cloudformation update-stack \
  --stack-name zzipto-redirect \
  --template-body file://cloudformation/redirect-service.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=prod \
    ParameterKey=DomainName,UsePreviousValue=true \
    ParameterKey=CertificateArn,UsePreviousValue=true \
    ParameterKey=RateLimitPerIP,ParameterValue=5000 \
  --region us-east-1 \
  --capabilities CAPABILITY_IAM
```

### Update CloudFront Function Code

If you modify `functions/redirect-function.js`:

1. Update the function code in the CloudFormation template (re-embed the file)
2. Run `update-stack` command above
3. CloudFormation will automatically update and publish the function

**Note:** Changes to CloudFront Functions propagate immediately.

## Monitoring

### CloudWatch Metrics

View metrics in CloudWatch console or CLI:

```bash
# CloudFront requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=YOUR_DISTRIBUTION_ID \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# WAF blocked requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=WebACL,Value=YOUR_WEBACL_NAME Name=Region,Value=us-east-1 \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region us-east-1
```

### Access Logs

CloudFront access logs are stored in the S3 bucket: `YOUR_STACK_NAME-logs`

Download and analyze logs:

```bash
# List log files
aws s3 ls s3://zzipto-redirect-logs/cloudfront/prod/

# Download logs
aws s3 cp s3://zzipto-redirect-logs/cloudfront/prod/ ./logs/ --recursive

# Analyze common paths (requires logs downloaded)
grep -o '/[^[:space:]]*' logs/*.gz | sort | uniq -c | sort -rn | head -20
```

### WAF Logs

WAF logs (if enabled separately) help identify blocked traffic and attack patterns.

## Troubleshooting

### Issue: 404 Not Found

**Possible Causes:**
1. Key not in KeyValueStore
   - Solution: Add mapping using `put-key` command
   - Verify: `list-keys` to see all mappings

2. Invalid path characters
   - Only allowed: `A-Z a-z 0-9 _ - /`
   - Solution: Use valid characters only

3. Path validation failure
   - Path contains `..`, `//`, or `%2F`
   - Solution: Use clean paths

4. Exact redirect with extra path
   - Example: `/docs/guide` when `docs` is exact redirect
   - Solution: Either use wildcard (`/*`) or don't add extra path

### Issue: 403 Forbidden

**Possible Causes:**
1. WAF rate limiting triggered
   - Solution: Wait or increase `RateLimitPerIP` parameter

2. WAF managed rules blocking request
   - Solution: Check WAF logs, add rule exceptions if needed

### Issue: Certificate Error

**Possible Causes:**
1. Certificate not in us-east-1
   - Solution: Create/import certificate in us-east-1

2. Certificate doesn't match domain
   - Solution: Certificate must cover your domain name

3. DNS not propagated
   - Solution: Wait for DNS propagation (up to 48 hours)

### Issue: Slow Redirect

**Possible Causes:**
1. First request after deployment
   - CloudFront cold start (one-time)
   - Solution: Warm up by making test requests

2. KeyValueStore propagation delay
   - New mappings take seconds to minutes
   - Solution: Wait a few minutes after adding keys

### Debugging Commands

```bash
# Test redirect from command line
curl -I https://zzip.to/gh/vladikk

# Should show:
# HTTP/2 301
# location: https://github.com/vladikk

# Check DNS resolution
dig zzip.to
nslookup zzip.to

# Test CloudFront distribution directly (before DNS)
curl -I -H "Host: zzip.to" https://d1234567890.cloudfront.net/gh/vladikk

# Verify certificate
openssl s_client -connect zzip.to:443 -servername zzip.to
```

## Cost Considerations

Estimated monthly costs (varies by traffic):

- **CloudFront**: $0.085 per GB data transfer (first 10 TB)
- **CloudFront Requests**: $0.0075 per 10,000 HTTP requests
- **CloudFront Function**: $0.10 per 1 million invocations
- **KeyValueStore**: $0.25 per GB-month (read operations free)
- **WAF**: $5.00 per month + $1.00 per million requests
- **S3 Logs**: $0.023 per GB-month

**Example:**
- 1 million redirects/month
- Minimal data transfer (redirects are small)
- Estimated cost: ~$10-15/month

**Cost Optimization:**
- Logs auto-delete after 90 days
- No servers or Lambda to manage
- Pay only for actual usage

## Cleanup

### Delete Stack

**WARNING:** This will delete all resources EXCEPT the KeyValueStore (DeletionPolicy: Retain).

```bash
aws cloudformation delete-stack \
  --stack-name zzipto-redirect \
  --region us-east-1
```

Monitor deletion:

```bash
aws cloudformation describe-stacks \
  --stack-name zzipto-redirect \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'
```

Wait for status: `DELETE_COMPLETE`

### Manually Delete KeyValueStore

KeyValueStore is retained to prevent accidental data loss. Delete manually if needed:

```bash
aws cloudfront delete-key-value-store \
  --id YOUR_KVS_ID \
  --region us-east-1
```

### Delete S3 Logs Bucket

Empty bucket first:

```bash
aws s3 rm s3://zzipto-redirect-logs --recursive

aws s3 rb s3://zzipto-redirect-logs
```

## Security Considerations

- WAF protects against common attacks and rate limiting
- Path validation prevents directory traversal and injection
- HTTPS enforced (redirect-to-https)
- S3 bucket has public access blocked
- CloudFront Function validated before deployment
- Logs encrypted at rest (S3 AES256)

## Limitations

- Maximum path length: 256 characters
- KeyValueStore size: No hard limit, but consider using <100k keys for best performance
- CloudFront Function execution time: <1ms typical
- Eventual consistency: KVS updates propagate within seconds to minutes

## License

This project is provided as-is for educational and production use.

## Support

For issues or questions:
- Review `requirements.md` for architecture details
- Check `tests/function-test-cases.md` for test scenarios
- Review CloudWatch logs for errors
- Check WAF logs for blocked requests
