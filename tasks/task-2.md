# Task 2: CloudFront Distribution, KeyValueStore, and Route 53 Configuration

## Goal

Create the CloudFront distribution that serves as the entry point for all redirect requests, along with the KeyValueStore for redirect mappings and Route 53 DNS configuration. This establishes the complete edge infrastructure for serving redirects.

## Context

- Requirement: CloudFront terminates HTTPS and is the entry point for all requests
- Requirement: No origin is required for successful redirects (CloudFront Function handles responses)
- Requirement: KeyValueStore holds redirect mappings with key-value pairs
- Requirement: Route 53 DNS record points zzip.to to CloudFront
- Requirement: Enable CloudFront access logs for observability
- Depends on Task 1 for WAF WebACL ARN

## Assumptions

- **SSL Certificate:** An ACM certificate for the domain already exists in us-east-1 and will be referenced via parameter. Creating certificates requires manual DNS validation which is out of scope.
- **Hosted Zone:** Route 53 hosted zone for the domain already exists and will be referenced via parameter.
- **S3 Logging Bucket:** A logging bucket will be created as part of this template for CloudFront access logs.
- **Default Origin:** A minimal S3 origin is required by CloudFront even though it won't be used for redirects. The CloudFront Function will intercept requests before they reach the origin.
- **Cache Policy:** No caching for redirects since responses are generated dynamically by the CloudFront Function.

## Work Breakdown

1. **Add new parameters to `cloudformation/template.yaml`**
   ```yaml
   CertificateArn:
     Type: String
     Description: ARN of ACM certificate for the domain (must be in us-east-1)

   HostedZoneId:
     Type: String
     Description: Route 53 Hosted Zone ID for the domain
   ```

2. **Create S3 bucket for CloudFront access logs**
   - Resource: `LoggingBucket`
   - Bucket name: `${Environment}-${AWS::StackName}-cf-logs-${AWS::AccountId}`
   - Enable bucket ownership controls for CloudFront logging
   - Configure lifecycle policy: expire logs after 90 days

3. **Create CloudFront KeyValueStore**
   ```yaml
   RedirectKVS:
     Type: AWS::CloudFront::KeyValueStore
     Properties:
       Name: !Sub "${Environment}-${AWS::StackName}-redirects"
       Comment: "Stores redirect mappings for zzip.to service"
   ```

4. **Create CloudFront Function resource (placeholder)**
   - Resource: `RedirectFunction`
   - Runtime: `cloudfront-js-2.0`
   - Function code will be a minimal placeholder (actual logic in Task 3)
   - Associate with KeyValueStore
   ```yaml
   RedirectFunction:
     Type: AWS::CloudFront::Function
     Properties:
       Name: !Sub "${Environment}-${AWS::StackName}-redirect"
       AutoPublish: true
       FunctionConfig:
         Comment: "Redirect handler for zzip.to"
         Runtime: cloudfront-js-2.0
         KeyValueStoreAssociations:
           - KeyValueStoreARN: !GetAtt RedirectKVS.Arn
       FunctionCode: |
         function handler(event) {
           return {
             statusCode: 503,
             statusDescription: 'Service Unavailable',
             headers: { 'content-type': { value: 'text/plain' } },
             body: 'Service initializing'
           };
         }
   ```

5. **Create S3 bucket for dummy origin**
   - Resource: `DummyOriginBucket`
   - Bucket name: `${Environment}-${AWS::StackName}-origin-${AWS::AccountId}`
   - Private bucket, no public access
   - This bucket will never be accessed (Function intercepts all requests)

6. **Create Origin Access Control for S3**
   ```yaml
   OriginAccessControl:
     Type: AWS::CloudFront::OriginAccessControl
     Properties:
       OriginAccessControlConfig:
         Name: !Sub "${Environment}-${AWS::StackName}-oac"
         OriginAccessControlOriginType: s3
         SigningBehavior: always
         SigningProtocol: sigv4
   ```

7. **Create CloudFront Distribution**
   ```yaml
   Distribution:
     Type: AWS::CloudFront::Distribution
     Properties:
       DistributionConfig:
         Enabled: true
         Comment: !Sub "${Environment} zzip.to redirect service"
         Aliases:
           - !Ref DomainName
         ViewerCertificate:
           AcmCertificateArn: !Ref CertificateArn
           SslSupportMethod: sni-only
           MinimumProtocolVersion: TLSv1.2_2021
         WebACLId: !GetAtt WebACL.Arn
         DefaultCacheBehavior:
           TargetOriginId: dummy-origin
           ViewerProtocolPolicy: redirect-to-https
           CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
           FunctionAssociations:
             - EventType: viewer-request
               FunctionARN: !GetAtt RedirectFunction.FunctionARN
         Origins:
           - Id: dummy-origin
             DomainName: !GetAtt DummyOriginBucket.RegionalDomainName
             S3OriginConfig:
               OriginAccessIdentity: ""
             OriginAccessControlId: !GetAtt OriginAccessControl.Id
         Logging:
           Bucket: !GetAtt LoggingBucket.RegionalDomainName
           Prefix: !Sub "${Environment}/"
         HttpVersion: http2and3
         IPV6Enabled: true
         PriceClass: PriceClass_All
   ```

8. **Create Route 53 A Record (IPv4)**
   ```yaml
   DNSRecordA:
     Type: AWS::Route53::RecordSet
     Properties:
       HostedZoneId: !Ref HostedZoneId
       Name: !Ref DomainName
       Type: A
       AliasTarget:
         DNSName: !GetAtt Distribution.DomainName
         HostedZoneId: Z2FDTNDATAQYW2  # CloudFront hosted zone ID (constant)
   ```

9. **Create Route 53 AAAA Record (IPv6)**
   ```yaml
   DNSRecordAAAA:
     Type: AWS::Route53::RecordSet
     Properties:
       HostedZoneId: !Ref HostedZoneId
       Name: !Ref DomainName
       Type: AAAA
       AliasTarget:
         DNSName: !GetAtt Distribution.DomainName
         HostedZoneId: Z2FDTNDATAQYW2
   ```

10. **Update Outputs section**
    ```yaml
    DistributionId:
      Value: !Ref Distribution
      Export:
        Name: !Sub "${AWS::StackName}-DistributionId"

    DistributionDomainName:
      Value: !GetAtt Distribution.DomainName
      Export:
        Name: !Sub "${AWS::StackName}-DistributionDomain"

    KeyValueStoreArn:
      Value: !GetAtt RedirectKVS.Arn
      Export:
        Name: !Sub "${AWS::StackName}-KVSArn"

    KeyValueStoreId:
      Value: !GetAtt RedirectKVS.Id
      Export:
        Name: !Sub "${AWS::StackName}-KVSId"

    RedirectFunctionArn:
      Value: !GetAtt RedirectFunction.FunctionARN
      Export:
        Name: !Sub "${AWS::StackName}-FunctionArn"
    ```

## Deliverables (Acceptance Criteria)

- [ ] CloudFront KeyValueStore resource created with proper naming
- [ ] CloudFront Function resource created with placeholder code and KVS association
- [ ] S3 logging bucket created with lifecycle policy
- [ ] S3 dummy origin bucket created (private)
- [ ] Origin Access Control configured for S3 origin
- [ ] CloudFront Distribution created with:
  - Custom domain alias
  - ACM certificate
  - WAF WebACL association
  - CloudFront Function association on viewer-request
  - Access logging enabled
  - TLS 1.2 minimum
  - HTTP/2 and HTTP/3 enabled
  - IPv6 enabled
- [ ] Route 53 A and AAAA records pointing to CloudFront
- [ ] Template validates: `aws cloudformation validate-template --template-body file://cloudformation/template.yaml`
- [ ] Outputs export Distribution ID, Domain, KVS ARN, and Function ARN

## Tests

**Test Types Required:**
- Template validation
- Resource configuration verification

**Test Cases:**

1. **Test:** Template syntax validation
   - **Input:** `cloudformation/template.yaml`
   - **Expected Output:** Valid template, no errors
   - **Command:** `aws cloudformation validate-template --template-body file://cloudformation/template.yaml`

2. **Test:** Verify WAF association
   - **Verification:** Distribution resource has `WebACLId: !GetAtt WebACL.Arn`

3. **Test:** Verify Function association
   - **Verification:** DefaultCacheBehavior has FunctionAssociations with viewer-request event type

4. **Test:** Verify logging configuration
   - **Verification:** Distribution has Logging configuration pointing to LoggingBucket

**Running Tests:**
```bash
# Validate template
aws cloudformation validate-template --template-body file://cloudformation/template.yaml

# Lint template
cfn-lint cloudformation/template.yaml
```

## Observability / Ops

**CloudFront Access Logs:**
- Stored in `${Environment}-${AWS::StackName}-cf-logs-${AWS::AccountId}` bucket
- Prefix: `${Environment}/`
- Retention: 90 days via lifecycle policy
- Contains: request time, edge location, status code, bytes, path, etc.

**Key Metrics to Monitor (via CloudWatch):**
- `Requests` - Total request count
- `4xxErrorRate` - Client error rate (including 404s for unknown keys)
- `5xxErrorRate` - Server error rate (should be near zero)
- `BytesDownloaded` - Response size (minimal for redirects)

## Security / Privacy

**TLS Configuration:**
- Minimum TLS 1.2 (TLSv1.2_2021 policy)
- SNI-only for certificate selection
- HTTPS enforced (redirect-to-https policy)

**Origin Security:**
- S3 origin uses Origin Access Control (OAC)
- Bucket is private, no public access
- Origin is only for CloudFront's requirement - never actually accessed

**WAF Integration:**
- Distribution associated with WAF WebACL from Task 1
- Rate limiting and managed rules active

## Dependencies

**Internal:**
- WAF WebACL ARN from Task 1 resources

**External:**
- ACM certificate must exist in us-east-1 (passed as parameter)
- Route 53 hosted zone must exist (passed as parameter)
- AWS account with permissions for CloudFront, S3, Route 53

**Task Dependencies:**
- Depends on: Task 1 (`tasks/task-1.md`) - WebACL must exist for distribution
- Blocks: Task 3 (`tasks/task-3.md`) - Function code needs KVS association

## Notes

- CloudFront hosted zone ID `Z2FDTNDATAQYW2` is a constant for all CloudFront distributions - not a typo
- Cache policy `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` is the AWS managed "CachingDisabled" policy
- The dummy origin is required because CloudFront requires at least one origin, even though our Function handles all responses
- Function code is a placeholder returning 503 - actual redirect logic is implemented in Task 3
- IPv6 is enabled for modern client support
- HTTP/3 (QUIC) is enabled for improved performance on supported clients
