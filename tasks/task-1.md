# Task 1: CloudFormation Foundation and WAF Configuration

## Goal

Establish the foundational CloudFormation infrastructure including the WAF WebACL with rate limiting and managed rules. This task creates the security layer that will protect the redirect service from abuse and DDoS attacks.

## Context

- Requirement: Use AWS CloudFormation in YAML with environment variable support (prod, test, dev)
- Requirement: Resources must be prefixed with environment type and stack name
- Requirement: WAF must include rate limiting per IP and AWS managed common rules
- This is the first task - no dependencies on other tasks
- WAF must be created in us-east-1 region for CloudFront association (global scope)

## Assumptions

- **Rate Limit Threshold:** 100 requests per 5-minute window per IP. This is a reasonable default that prevents abuse while allowing legitimate traffic bursts.
- **AWS Managed Rules:** Using AWSManagedRulesCommonRuleSet which covers common vulnerabilities (SQLi, XSS, etc.) - appropriate for a redirect service that processes URL paths.
- **WAF Action:** Rate limit violations result in BLOCK action with 403 response.

## Work Breakdown

1. **Create the main CloudFormation template file**
   - File: `cloudformation/template.yaml`
   - Define AWSTemplateFormatVersion and Description

2. **Define Parameters section**
   - `Environment` parameter with allowed values: `prod`, `test`, `dev`
   - `DomainName` parameter for the service domain (default: `zzip.to`)
   - `RateLimitThreshold` parameter (default: 1000)

3. **Create WAF WebACL resource**
   - Resource name: `WebACL`
   - Logical ID pattern: `${Environment}-${AWS::StackName}-webacl`
   - Scope: `CLOUDFRONT` (requires deployment in us-east-1)
   - Default action: ALLOW
   - Rules:
     - Priority 1: AWS Managed Common Rule Set
     - Priority 2: Rate-based rule limiting requests per IP

4. **Configure Rate-Based Rule**
   ```yaml
   Name: !Sub "${Environment}-${AWS::StackName}-rate-limit"
   Priority: 2
   Action:
     Block: {}
   Statement:
     RateBasedStatement:
       Limit: !Ref RateLimitThreshold
       AggregateKeyType: IP
   VisibilityConfig:
     SampledRequestsEnabled: true
     CloudWatchMetricsEnabled: true
     MetricName: !Sub "${Environment}-${AWS::StackName}-rate-limit"
   ```

5. **Configure AWS Managed Common Rule Set**
   ```yaml
   Name: !Sub "${Environment}-${AWS::StackName}-common-rules"
   Priority: 1
   OverrideAction:
     None: {}
   Statement:
     ManagedRuleGroupStatement:
       VendorName: AWS
       Name: AWSManagedRulesCommonRuleSet
   VisibilityConfig:
     SampledRequestsEnabled: true
     CloudWatchMetricsEnabled: true
     MetricName: !Sub "${Environment}-${AWS::StackName}-common-rules"
   ```

6. **Add Outputs section**
   - Export WebACL ARN for use by CloudFront distribution (Task 2)
   - Export WebACL ID for reference

## Deliverables (Acceptance Criteria)

- [ ] File `cloudformation/template.yaml` exists with valid YAML syntax
- [ ] Template validates successfully: `aws cloudformation validate-template --template-body file://cloudformation/template.yaml`
- [ ] Parameters section includes `Environment` with allowed values `prod`, `test`, `dev`
- [ ] WAF WebACL resource defined with CLOUDFRONT scope
- [ ] Rate-based rule configured with IP aggregation
- [ ] AWS Managed Common Rule Set included
- [ ] All resource names follow pattern `${Environment}-${AWS::StackName}-<resource>`
- [ ] Outputs export WebACL ARN

## Tests

**Test Types Required:**
- Template validation (syntax and structure)
- CloudFormation linting

**Test Cases:**

1. **Test:** Template syntax validation
   - **Input:** `cloudformation/template.yaml`
   - **Expected Output:** Valid YAML, no syntax errors
   - **Command:** `aws cloudformation validate-template --template-body file://cloudformation/template.yaml`

2. **Test:** CloudFormation linting
   - **Input:** `cloudformation/template.yaml`
   - **Expected Output:** No errors, warnings acceptable
   - **Command:** `cfn-lint cloudformation/template.yaml` (if cfn-lint installed)

3. **Test:** Environment parameter validation
   - **Input:** Deploy with `Environment=staging`
   - **Expected Output:** Deployment fails with parameter validation error
   - **Verification:** Only `prod`, `test`, `dev` are accepted

**Running Tests:**
```bash
# Validate template syntax
aws cloudformation validate-template --template-body file://cloudformation/template.yaml

# Optional: Run cfn-lint if available
cfn-lint cloudformation/template.yaml
```

## Observability / Ops

**CloudWatch Metrics (automatically enabled via VisibilityConfig):**
- Metric: `${Environment}-${AWS::StackName}-rate-limit` - tracks rate limit rule matches
- Metric: `${Environment}-${AWS::StackName}-common-rules` - tracks common rule matches

**WAF Logging:**
- WAF logging will be configured in Task 3 (CloudFront Distribution task) along with CloudFront access logs

## Security / Privacy

**Rate Limiting:**
- Protects against DDoS and bot attacks
- 1000 requests per 5 minutes per IP is permissive enough for legitimate users
- Can be adjusted via parameter without template modification

**Managed Rules:**
- AWSManagedRulesCommonRuleSet provides baseline protection
- Rules are automatically updated by AWS

## Dependencies

**External:**
- AWS CLI configured with appropriate credentials
- AWS account with permissions to create WAF resources
- Deployment must target us-east-1 region (required for CloudFront-scoped WAF)

**Task Dependencies:**
- None - this is the first task
- Blocks: Task 2 (`tasks/task-2.md`) - CloudFront needs WebACL ARN

## Notes

- WAF WebACL for CloudFront MUST be created in us-east-1 region regardless of where other resources are deployed
- The WebACL ARN is exported to allow the CloudFront distribution (Task 2) to reference it
- Rate limit of 1000/5min can be adjusted per environment by overriding the parameter during deployment
- VisibilityConfig enables CloudWatch metrics and request sampling for debugging
