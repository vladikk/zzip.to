# GitHub Actions Setup Guide

This guide explains how to configure GitHub Actions for automatic KeyValueStore updates.

## Overview

The `populate-kvs.yml` workflow automatically updates your CloudFront KeyValueStore when you commit changes to `data/redirects.json` on the `main` branch.

## Prerequisites

1. AWS account with deployed zzip.to stack
2. IAM user or role with the following permissions:
   - `cloudfront-keyvaluestore:DescribeKeyValueStore`
   - `cloudfront-keyvaluestore:PutKey`

## Setup Steps

### 1. Create IAM User (if needed)

Create a dedicated IAM user for GitHub Actions with minimal permissions:

```json
{
  "Version": "2012-01-01",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront-keyvaluestore:DescribeKeyValueStore",
        "cloudfront-keyvaluestore:PutKey"
      ],
      "Resource": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:key-value-store/*"
    }
  ]
}
```

Generate access keys for this user.

### 2. Configure GitHub Repository Secrets

Go to: **Repository Settings → Secrets and variables → Actions → Secrets**

Add the following repository **Secrets**:
- `AWS_ACCESS_KEY_ID`: Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key

### 3. Configure GitHub Repository Variables

Go to: **Repository Settings → Secrets and variables → Actions → Variables**

Add the following repository **Variable**:
- `KVS_ARN`: Your KeyValueStore ARN

**To get your KVS ARN:**
```bash
aws cloudformation describe-stacks \
  --stack-name zziptodev-dev \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KeyValueStoreArn`].OutputValue' \
  --output text
```

## Usage

### Automatic Trigger

Simply edit and commit `data/redirects.json` to the `main` branch:

```bash
# Edit the redirects file
vim data/redirects.json

# Commit and push
git add data/redirects.json
git commit -m "Add new redirect for blog"
git push origin main
```

The workflow will automatically run and update the KeyValueStore.

### Manual Trigger

You can also manually trigger the workflow from the GitHub Actions tab:

1. Go to **Actions** → **Populate CloudFront KeyValueStore**
2. Click **Run workflow**
3. Optionally specify a custom data file path
4. Click **Run workflow**

## Monitoring

View workflow runs in the **Actions** tab:
- Green checkmark: Successful update
- Red X: Failed (check logs for errors)
- Yellow dot: In progress

Click on any run to see detailed logs of each step.

## Troubleshooting

### Error: "The request could not be satisfied"
- Verify `KVS_ARN` variable is set correctly
- Check that AWS credentials have permission to access the KeyValueStore

### Error: "aws: command not found"
- AWS CLI should be pre-installed on GitHub Actions runners (ubuntu-latest)
- If issue persists, add installation step to workflow

### Error: "jq: command not found"
- The workflow installs jq automatically
- Check the "Install jq" step logs for installation issues

### Error: "Invalid JSON"
- Validate your JSON file locally: `jq empty data/redirects.json`
- Ensure proper JSON syntax (commas, brackets, quotes)

## Security Best Practices

1. **Use IAM roles with minimal permissions** - only grant access to the specific KeyValueStore
2. **Rotate access keys regularly** - update GitHub secrets with new keys
3. **Monitor CloudTrail logs** - track all API calls from GitHub Actions
4. **Use environment-specific workflows** - separate workflows for dev/staging/prod
5. **Never commit secrets** - always use GitHub Secrets, never hardcode credentials

## Advanced Configuration

### Multiple Environments

To support multiple environments (dev, staging, prod), you can:

1. Create separate workflow files for each environment
2. Use GitHub Environments with protection rules
3. Store separate `KVS_ARN` variables per environment

### Custom Data Files

The workflow supports custom data file paths via manual trigger:
- Default: `data/redirects.json`
- Custom: Any path in the repository (e.g., `data/prod-redirects.json`)

### Notifications

Add notification steps to the workflow for Slack, Discord, or email alerts on success/failure.
