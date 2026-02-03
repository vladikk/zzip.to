# IMPORTANT - Shared Knowledge Base

This file contains critical constraints and non-obvious information discovered during task implementation.

## Task 1 - CloudFormation Foundation and WAF Configuration

[CONSTRAINT] WAF WebACL for CloudFront must be deployed in us-east-1 region - CloudFront-scoped WAF resources are global and can only be created in us-east-1 regardless of where other stack resources are deployed.

[EXPORT] WebACL ARN is exported as `${Environment}-${AWS::StackName}-webacl-arn` for use by CloudFront distribution in Task 2.

[EXPORT] WebACL ID is exported as `${Environment}-${AWS::StackName}-webacl-id` for reference.

[NAMING] All resources follow the pattern `${Environment}-${AWS::StackName}-<resource>` as specified in requirements.

## Task 2 - CloudFront Distribution, KeyValueStore, and Route 53 Configuration

[CONSTANT] CloudFront hosted zone ID `Z2FDTNDATAQYW2` is a global constant for ALL CloudFront distributions - see DNSRecordA and DNSRecordAAAA resources.

[CONSTANT] Cache policy ID `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` is the AWS managed "CachingDisabled" policy - used because redirects are generated dynamically.

[ARCHITECTURE] DummyOriginBucket is required by CloudFront (must have at least one origin) but never accessed - RedirectFunction intercepts all requests at viewer-request stage.

[EXPORT] New outputs export Distribution ID, KVS ARN/ID, and Function ARN without Environment prefix (unlike WebACL exports) - see lines 203, 215, 221, 227 in template.yaml.

[PLACEHOLDER] RedirectFunction contains placeholder code returning 503 - actual redirect logic will be implemented in Task 3.

## Task 3 - CloudFront Function Redirect Logic Implementation

[IMPLEMENTATION] Function code is embedded inline in CloudFormation template using !Sub to inject KVS ARN at deployment time - see RedirectFunction.FunctionCode in template.yaml lines 104-227.

[SYNTAX] CloudFormation !Sub intrinsic function requires escaping - avoided template literals with ${} inside function code, using string concatenation instead (e.g., key + '=' + value instead of `${key}=${value}`).

[SOURCE] Source file functions/redirect.js maintained as reference but template contains the deployable code - any updates must be made to both files for consistency.

## Task 4 - Deployment Scripts, Testing, and Initial Data Population

[TESTING] Node.js test runner does not support mock.module() in versions prior to v22 - tests replicate function code inline for testing rather than using module mocking.

[QUERYSTRING] buildQueryString() treats empty string values as falsy - query parameters with empty values (e.g., `debug: { value: '' }`) output as `?debug` not `?debug=` in redirect URLs.

[SCRIPTS] All deployment scripts use `set -euo pipefail` for fail-fast behavior and require us-east-1 region due to CloudFront/WAF constraints.

[KVS-POPULATION] populate-kvs.sh requires jq for JSON parsing and updates KVS entries sequentially, fetching/updating ETag between each operation to handle optimistic concurrency.

[LOGGING-BUCKET] destroy.sh must empty S3 logging bucket before stack deletion - CloudFormation cannot delete non-empty S3 buckets.

## CloudFront Functions Runtime Compatibility

[RUNTIME] CloudFront Functions runtime (cloudfront-js-2.0) has LIMITED ES6 support - avoid modern JavaScript syntax:
- NO `export` keyword - use plain `async function handler(event)` without export
- NO ES6 object shorthand - use `{ key: key, rest: rest }` instead of `{ key, rest }`
- NO ES6 destructuring - use `var parsed = parsePath(uri); var key = parsed.key;` instead of `const { key, rest } = parsePath(uri)`
- NO `const` or `let` - use `var` for all variable declarations
- NO arrow functions in loops - use `function(item) { }` instead of `item => { }`
- NO template literals - use string concatenation like `k + '=' + mv.value` instead of `${k}=${mv.value}`

[KVS-REFERENCE] CloudFront Functions `cf.kvs()` requires KeyValueStore ID, NOT ARN - use `${RedirectKVS.Id}` in !Sub, not `${RedirectKVS.Arn}`.

[AWS-CLI] AWS CLI minimum version 2.15.2+ required for `cloudfront-keyvaluestore` service commands - earlier versions (like 2.13.3) don't support KVS operations.

## CI/CD and Automation

[GITHUB-ACTIONS] `.github/workflows/populate-kvs.yml` automatically updates KVS when `data/redirects.json` is pushed to main branch.

[SECRETS] GitHub Actions requires AWS credentials as repository secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) and KVS_ARN as a repository variable.

[CONFIG] `config/deploy-params.local.sh` contains deployment parameters and is gitignored - never commit this file as it may contain ARNs and account IDs.

## Admin UI - Cognito Authentication

[AUTH] Cognito User Pool uses `ALLOW_USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` flows only - no client secret is generated. Self-signup is disabled; users must be created by an admin via AWS CLI.

[AUTH] Pre-authentication Lambda trigger checks the user's email against the `AllowedEmails` CloudFormation parameter (comma-separated list). Non-whitelisted emails are rejected before authentication completes.

[AUTH] The admin UI uses AWS Amplify (Gen 2 API) for Cognito integration - `signIn`, `signOut`, `getCurrentUser`, and `fetchAuthSession` from `aws-amplify/auth`.

## Admin UI - API Gateway and CORS

[CORS] API Gateway has both mock OPTIONS methods for CORS preflight and `Access-Control-Allow-*` headers in all Lambda responses. The allowed origin is set to `https://${AdminDomainName}` (defaults to `https://admin.zzip.to`).

[API] API Gateway uses a Cognito Authorizer - the frontend must include the JWT ID token in the `Authorization` header for all API calls.

[API] Lambda handlers use proxy integration (`AWS_PROXY`) - the Lambda is responsible for returning the full HTTP response including status code, headers, and body.

## Admin UI - DynamoDB and KVS Sync

[DYNAMO] `LinksTable` uses PAY_PER_REQUEST billing and a simple hash key (`key` of type String). DynamoDB Streams are enabled with `NEW_AND_OLD_IMAGES` stream view type.

[KVS-SYNC] The KVS sync Lambda processes DynamoDB Stream events: INSERT and MODIFY events call `PutKey` on CloudFront KVS, REMOVE events call `DeleteKey`. The Lambda handles ETag-based optimistic concurrency by fetching the current ETag before each write.

[KVS-SYNC] The sync Lambda requires both `dynamodb:GetRecords`/`dynamodb:GetShardIterator`/`dynamodb:DescribeStream`/`dynamodb:ListStreams` permissions and `cloudfront-keyvaluestore:PutKey`/`DeleteKey`/`DescribeKeyValueStore` permissions.

## Admin UI - Frontend

[UI] The React UI is built with Vite + React 19 + TypeScript + Radix UI primitives + CSS modules. It is hosted on a separate CloudFront distribution (`admin.zzip.to`) backed by an S3 bucket.

[UI] Environment variables are injected at build time via Vite's `import.meta.env` - the `.env` file must be configured before building.

[UI] The admin CloudFront distribution uses a custom error response mapping 403 to `/index.html` with 200 status code, enabling SPA client-side routing.

[DEPLOY] `scripts/deploy-ui.sh` builds the UI, syncs to S3, and creates a CloudFront invalidation for `/*`. It reads the S3 bucket name and distribution ID from CloudFormation stack outputs.

[SEED] `scripts/seed-dynamodb.sh` is a one-time migration script that reads `data/redirects.json` and batch-writes items to DynamoDB. After migration, redirects are managed exclusively through the admin UI.

[DYNAMO] `LinksTable` has `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain` - the table survives stack deletion and must be manually deleted if cleanup is desired.

[DEPLOY] CloudFormation deployment requires `CAPABILITY_NAMED_IAM` (not just `CAPABILITY_IAM`) because IAM roles use explicit `RoleName` properties with `!Sub` expressions.
