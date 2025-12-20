# Task 4: Deployment Scripts, Testing, and Initial Data Population

## Goal

Create deployment automation scripts, implement a comprehensive test suite for the redirect function, and document the process for populating the KeyValueStore with initial redirect mappings. This task ensures the service can be reliably deployed, tested, and operated.

## Context

- Requirement: Enable CloudFront access logs and WAF logs for observability
- Requirement: Monitor request count, 4xx rate, WAF blocks, and top requested paths
- The infrastructure (Tasks 1-2) and function logic (Task 3) are complete
- Need deployment automation and testing before production use
- Need a way to populate KVS with initial redirect data

## Assumptions

- **Deployment Regions:** CloudFormation stack deploys to us-east-1 (required for CloudFront WAF and ACM certificates).
- **AWS CLI Profile:** Deployment scripts use the default AWS CLI profile unless `AWS_PROFILE` is set.
- **Test Framework:** Using Node.js built-in test runner (`node --test`) for simplicity. No additional dependencies required.
- **KVS Population:** Initial data will be populated via AWS CLI after stack deployment. A dedicated management API is out of scope per requirements.

## Work Breakdown

1. **Create deployment script**
   - File: `scripts/deploy.sh`
   ```bash
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
   ```

2. **Create KVS population script**
   - File: `scripts/populate-kvs.sh`
   ```bash
   #!/bin/bash
   set -euo pipefail

   KVS_ARN=${1:-}
   DATA_FILE=${2:-data/redirects.json}

   if [[ -z "$KVS_ARN" ]]; then
     echo "Usage: ./scripts/populate-kvs.sh <kvs-arn> [data-file]"
     exit 1
   fi

   echo "Populating KVS from $DATA_FILE..."

   # Get current ETag
   ETAG=$(aws cloudfront-keyvaluestore describe-key-value-store \
     --kvs-arn "$KVS_ARN" \
     --query 'ETag' \
     --output text)

   # Read JSON and update each key
   jq -c '.[]' "$DATA_FILE" | while read -r item; do
     KEY=$(echo "$item" | jq -r '.key')
     VALUE=$(echo "$item" | jq -r '.value')

     echo "Setting $KEY -> $VALUE"

     ETAG=$(aws cloudfront-keyvaluestore put-key \
       --kvs-arn "$KVS_ARN" \
       --key "$KEY" \
       --value "$VALUE" \
       --if-match "$ETAG" \
       --query 'ETag' \
       --output text)
   done

   echo "KVS population complete!"
   ```

3. **Create sample redirect data file**
   - File: `data/redirects.json`
   ```json
   [
     { "key": "gh", "value": "https://github.com/*" },
     { "key": "docs", "value": "https://docs.example.com" },
     { "key": "blog", "value": "https://blog.example.com/*" }
   ]
   ```

4. **Create unit test file for redirect function**
   - File: `tests/redirect.test.js`
   - Implement comprehensive tests covering all cases from Task 3

5. **Implement test mocking for KVS**
   ```javascript
   // tests/mocks/cloudfront.js
   const kvsData = new Map();

   function setKvsData(data) {
     kvsData.clear();
     Object.entries(data).forEach(([k, v]) => kvsData.set(k, v));
   }

   function kvs(id) {
     return {
       async get(key) {
         if (!kvsData.has(key)) {
           throw new Error('Key not found');
         }
         return kvsData.get(key);
       }
     };
   }

   module.exports = { kvs, setKvsData };
   ```

6. **Implement the test suite**
   ```javascript
   // tests/redirect.test.js
   const { describe, it, beforeEach } = require('node:test');
   const assert = require('node:assert');
   const { setKvsData } = require('./mocks/cloudfront');

   // Import handler after mocking
   // ... test implementations for all cases
   ```

7. **Create test runner script**
   - File: `scripts/test.sh`
   ```bash
   #!/bin/bash
   set -euo pipefail

   echo "Running unit tests..."
   node --test tests/*.test.js

   echo "All tests passed!"
   ```

8. **Create stack deletion script**
   - File: `scripts/destroy.sh`
   ```bash
   #!/bin/bash
   set -euo pipefail

   ENVIRONMENT=${1:-dev}
   STACK_NAME=${2:-zzip-to}

   echo "Deleting stack $STACK_NAME-$ENVIRONMENT..."

   # Empty logging bucket first (required for deletion)
   BUCKET=$(aws cloudformation describe-stack-resource \
     --stack-name "$STACK_NAME-$ENVIRONMENT" \
     --logical-resource-id LoggingBucket \
     --region us-east-1 \
     --query 'StackResourceDetail.PhysicalResourceId' \
     --output text 2>/dev/null || echo "")

   if [[ -n "$BUCKET" ]]; then
     echo "Emptying logging bucket $BUCKET..."
     aws s3 rm "s3://$BUCKET" --recursive || true
   fi

   aws cloudformation delete-stack \
     --stack-name "$STACK_NAME-$ENVIRONMENT" \
     --region us-east-1

   echo "Waiting for deletion..."
   aws cloudformation wait stack-delete-complete \
     --stack-name "$STACK_NAME-$ENVIRONMENT" \
     --region us-east-1

   echo "Stack deleted!"
   ```

9. **Create CloudWatch dashboard template**
   - Add to `cloudformation/template.yaml` or create separate file
   - Dashboard showing:
     - Request count over time
     - 4xx error rate
     - WAF blocked requests
     - Function execution time

10. **Update README with deployment instructions**
    - File: `README.md` (update existing or create section)
    - Include:
      - Prerequisites (AWS CLI, ACM cert, hosted zone)
      - Deployment steps
      - KVS population instructions
      - Testing instructions
      - Monitoring/troubleshooting

## Deliverables (Acceptance Criteria)

- [ ] File `scripts/deploy.sh` created and executable (`chmod +x`)
- [ ] File `scripts/destroy.sh` created and executable
- [ ] File `scripts/populate-kvs.sh` created and executable
- [ ] File `scripts/test.sh` created and executable
- [ ] File `data/redirects.json` created with sample redirect mappings
- [ ] File `tests/redirect.test.js` created with comprehensive test coverage
- [ ] File `tests/mocks/cloudfront.js` created for KVS mocking
- [ ] All test cases from Task 3 implemented and passing
- [ ] Deploy script successfully deploys stack to us-east-1
- [ ] KVS population script successfully adds entries
- [ ] README includes complete deployment and operation instructions

## Tests

**Test Types Required:**
- Unit tests for redirect function (all edge cases)
- Script functionality tests (dry-run mode)
- End-to-end smoke test after deployment

**Test Cases:**

All test cases from Task 3 plus:

1. **Test:** Deploy script validates required parameters
   - **Input:** `./scripts/deploy.sh dev test-stack`
   - **Expected Output:** Error message about missing certificate and hosted zone

2. **Test:** Populate script handles missing KVS ARN
   - **Input:** `./scripts/populate-kvs.sh`
   - **Expected Output:** Usage message

3. **Test:** Redirect function handles concurrent requests
   - **Input:** Multiple simultaneous requests to same key
   - **Expected Output:** All return correct redirect

**Running Tests:**
```bash
# Run all unit tests
./scripts/test.sh

# Validate deployment script (syntax only)
bash -n scripts/deploy.sh

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/template.yaml
```

## Observability / Ops

**CloudWatch Dashboard:**
Create dashboard `${Environment}-${StackName}-dashboard` with widgets:

1. **Request Metrics**
   - Metric: CloudFront `Requests` grouped by status code
   - Period: 1 minute

2. **Error Rate**
   - Metric: `4xxErrorRate` and `5xxErrorRate`
   - Period: 1 minute
   - Alarm threshold: 4xx > 10% for 5 minutes

3. **WAF Metrics**
   - Metric: `BlockedRequests` from WAF
   - Metric: Rate limit trigger count

4. **Function Performance**
   - Metric: `FunctionExecutionTime`
   - Metric: `FunctionThrottles`

**Alerts to Configure:**
- Alert: High 4xx rate (> 10% for 5 consecutive minutes)
- Alert: Any 5xx errors (immediate)
- Alert: WAF rate limit triggers (> 100/hour)
- Alert: Function throttles (any occurrence)

## Security / Privacy

**Script Security:**
- Scripts use `set -euo pipefail` for fail-fast behavior
- No hardcoded credentials (uses AWS CLI profile)
- Certificate ARN and hosted zone ID passed as parameters

**S3 Bucket Cleanup:**
- Destroy script empties buckets before deletion
- Prevents orphaned resources and unexpected charges

## Rollout / Migration Plan

**Deployment Process:**
1. Deploy to `dev` environment first
2. Populate KVS with test data
3. Run smoke tests against dev domain
4. Deploy to `prod` with production data
5. Monitor dashboard for anomalies

**Rollback Procedure:**
1. If function issues: update CloudFront Function code
2. If infrastructure issues: `./scripts/destroy.sh` and redeploy previous version
3. KVS data: no rollback needed (updates are atomic per key)

## Dependencies

**Internal:**
- Complete CloudFormation template from Tasks 1-2
- Function code from Task 3

**External:**
- AWS CLI v2 installed and configured
- `jq` installed (for JSON processing in scripts)
- Node.js 18+ (for running tests)

**Task Dependencies:**
- Depends on: Task 1 (`tasks/task-1.md`) - WAF configuration
- Depends on: Task 2 (`tasks/task-2.md`) - CloudFront and KVS resources
- Depends on: Task 3 (`tasks/task-3.md`) - Function code to test and deploy

## Notes

- The KVS ARN is output by CloudFormation and must be passed to the populate script
- CloudFront distribution changes can take 5-10 minutes to propagate globally
- Function updates are faster (usually < 1 minute)
- For production, consider using CloudFormation StackSets for multi-region deployment
- The dashboard can be extended with custom metrics using CloudWatch Logs Insights on access logs
- Consider implementing a CI/CD pipeline (GitHub Actions, AWS CodePipeline) for automated deployments
- Test data in `data/redirects.json` should be replaced with actual redirect mappings for production
