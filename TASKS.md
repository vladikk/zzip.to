# zzip.to Project Task Breakdown

## Overview
This document breaks down the zzip.to redirect service implementation into discrete tasks. Each task is self-contained with explicit instructions, deliverables, and acceptance criteria.

---

## Task 1: Project Structure and Configuration Setup

### Objective
Create the basic project structure and configuration files needed for the CloudFormation infrastructure.

### Prerequisites
- None (first task)

### Explicit Instructions

1. Create a `cloudformation/` directory in the project root
2. Create a `functions/` directory in the project root for CloudFront Functions
3. Create a `tests/` directory in the project root for test files
4. Create a `.gitignore` file with the following entries:
   ```
   .aws-sam/
   .DS_Store
   *.swp
   *~
   .vscode/
   .idea/
   node_modules/
   ```
5. Create a `README.md` file with:
   - Project title: "zzip.to - Edge-Based URL Redirect Service"
   - Brief description: "AWS CloudFront-based URL shortener using KeyValueStore"
   - Directory structure explanation
   - Placeholder sections for: Prerequisites, Deployment, Testing

### Deliverables

1. **Directory Structure** (verify with `tree` or `ls -R`):
   ```
   /
   ├── cloudformation/
   ├── functions/
   ├── tests/
   ├── .gitignore
   ├── README.md
   └── requirements.md (existing)
   ```

2. **Files Created**:
   - `.gitignore` (must contain all entries listed above)
   - `README.md` (must contain all sections listed above)

### Acceptance Criteria

- [ ] All three directories exist and are empty
- [ ] `.gitignore` file exists and contains exactly the entries specified
- [ ] `README.md` exists and contains all required sections
- [ ] Run `git status` - should show new directories and files as untracked
- [ ] No other files or directories created beyond what's specified

### Notes for Next Task
The next engineer will use `cloudformation/` directory to create the CloudFormation template.

---

## Task 2: CloudFormation Template - Parameters and Metadata

### Objective
Create the CloudFormation template file with parameters section that supports multi-environment deployments.

### Prerequisites
- Task 1 completed: `cloudformation/` directory exists

### Explicit Instructions

1. Create file: `cloudformation/redirect-service.yaml`
2. Set CloudFormation version to: `'2010-09-09'`
3. Add Description: `"zzip.to URL redirect service using CloudFront, WAF, and KeyValueStore"`
4. Create Parameters section with these EXACT parameters:

   **Environment Parameter:**
   - Logical ID: `Environment`
   - Type: `String`
   - Default: `dev`
   - AllowedValues: `[dev, test, prod]`
   - Description: `"Environment name (dev, test, or prod)"`

   **DomainName Parameter:**
   - Logical ID: `DomainName`
   - Type: `String`
   - Description: `"Domain name for the CloudFront distribution (e.g., zzip.to)"`
   - ConstraintDescription: `"Must be a valid domain name"`

   **CertificateArn Parameter:**
   - Logical ID: `CertificateArn`
   - Type: `String`
   - Description: `"ARN of ACM certificate in us-east-1 for the domain"`
   - AllowedPattern: `^arn:aws:acm:us-east-1:\d{12}:certificate/[a-f0-9-]+$`
   - ConstraintDescription: `"Must be a valid ACM certificate ARN in us-east-1"`

   **RateLimitPerIP Parameter:**
   - Logical ID: `RateLimitPerIP`
   - Type: `Number`
   - Default: `2000`
   - MinValue: `100`
   - MaxValue: `20000`
   - Description: `"Maximum requests per IP per 5 minutes"`

5. Add Metadata section with parameter grouping:
   ```yaml
   Metadata:
     AWS::CloudFormation::Interface:
       ParameterGroups:
         - Label:
             default: "Environment Configuration"
           Parameters:
             - Environment
         - Label:
             default: "Domain Configuration"
           Parameters:
             - DomainName
             - CertificateArn
         - Label:
             default: "Security Configuration"
           Parameters:
             - RateLimitPerIP
       ParameterLabels:
         Environment:
           default: "Deployment Environment"
         DomainName:
           default: "Domain Name"
         CertificateArn:
           default: "SSL Certificate ARN"
         RateLimitPerIP:
           default: "Rate Limit per IP"
   ```

6. Add empty `Resources:` section (just the key, no resources yet)
7. Add empty `Outputs:` section (just the key, no outputs yet)

### Deliverables

1. **File Created**: `cloudformation/redirect-service.yaml`
2. **File Structure**:
   - AWSTemplateFormatVersion present
   - Description present
   - Metadata section with parameter interface
   - Parameters section with all 4 parameters
   - Empty Resources section
   - Empty Outputs section

3. **Validation Command Output**:
   ```bash
   aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml
   ```
   Must return success (not an error)

### Acceptance Criteria

- [ ] File `cloudformation/redirect-service.yaml` exists
- [ ] Template validates successfully with AWS CLI
- [ ] Parameters section contains exactly 4 parameters with correct names
- [ ] All parameter constraints match specifications exactly
- [ ] Metadata section formats parameters into 3 groups
- [ ] Resources and Outputs sections exist but are empty
- [ ] File is valid YAML (no syntax errors)

### Testing Instructions

Run these commands:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('cloudformation/redirect-service.yaml'))"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml
```

Both must succeed without errors.

### Notes for Next Task
The next engineer will add the CloudFront KeyValueStore resource to the Resources section.

---

## Task 3: CloudFormation Template - KeyValueStore Resource

### Objective
Add the CloudFront KeyValueStore resource that will hold the redirect mappings.

### Prerequisites
- Task 2 completed: `cloudformation/redirect-service.yaml` exists with Parameters and empty Resources section

### Explicit Instructions

1. Open file: `cloudformation/redirect-service.yaml`
2. In the `Resources:` section, add a resource with logical ID: `RedirectKeyValueStore`
3. Resource type: `AWS::CloudFront::KeyValueStore`
4. Properties to configure:

   **Name property:**
   - Use `!Sub` function to create name: `"${Environment}-${AWS::StackName}-redirect-kvs"`
   - This creates names like: `dev-zzipto-redirect-kvs`

   **Comment property:**
   - Set to: `!Sub "KeyValueStore for ${Environment} environment redirect mappings"`

   **ImportSource property:**
   - **DO NOT SET THIS** - Leave it out entirely
   - Reason: KVS will be populated separately, not during stack creation

5. Add a DeletionPolicy: `Retain`
   - This prevents accidental data loss if stack is deleted

6. In the `Outputs:` section, add an output with logical ID: `KeyValueStoreId`
   - Value: `!Ref RedirectKeyValueStore`
   - Description: `"CloudFront KeyValueStore ID"`
   - Export Name: `!Sub "${AWS::StackName}-KVSId"`

7. Add another output with logical ID: `KeyValueStoreArn`
   - Value: `!GetAtt RedirectKeyValueStore.Arn`
   - Description: `"CloudFront KeyValueStore ARN"`
   - Export Name: `!Sub "${AWS::StackName}-KVSArn"`

### Deliverables

1. **Updated File**: `cloudformation/redirect-service.yaml`
2. **Resources Section** contains:
   - `RedirectKeyValueStore` resource with all specified properties
   - DeletionPolicy set to Retain

3. **Outputs Section** contains:
   - `KeyValueStoreId` output with export
   - `KeyValueStoreArn` output with export

4. **Validation Results**:
   - Template must validate successfully
   - No drift from previous task's parameters

### Acceptance Criteria

- [ ] `RedirectKeyValueStore` resource exists in Resources section
- [ ] Resource type is exactly `AWS::CloudFront::KeyValueStore`
- [ ] Name uses `!Sub` with correct format
- [ ] Comment uses `!Sub` with environment reference
- [ ] ImportSource property is NOT present
- [ ] DeletionPolicy is set to `Retain`
- [ ] Two outputs exist with correct logical IDs
- [ ] Both outputs have Export names
- [ ] Template validates successfully with AWS CLI
- [ ] YAML syntax is valid

### Testing Instructions

Run these commands:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('cloudformation/redirect-service.yaml'))"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml

# Check for KeyValueStore resource
grep -A 10 "RedirectKeyValueStore:" cloudformation/redirect-service.yaml

# Verify DeletionPolicy
grep "DeletionPolicy: Retain" cloudformation/redirect-service.yaml
```

All commands must succeed and show expected content.

### Notes for Next Task
The next engineer will add the CloudFront Function resource. They will need to reference the KeyValueStore ARN using: `!GetAtt RedirectKeyValueStore.Arn`

---

## Task 4: CloudFront Function - Code Implementation

### Objective
Implement the JavaScript code for the CloudFront Function that performs redirect logic.

### Prerequisites
- Task 1 completed: `functions/` directory exists
- Read and understand requirements.md sections:
  - "Redirect rules" (lines 98-173)
  - "Validation rules" (lines 176-186)
  - "HTTP status codes" (lines 190-194)

### Explicit Instructions

1. Create file: `functions/redirect-function.js`

2. Implement the function with this EXACT signature:
   ```javascript
   function handler(event) {
       // your code here
   }
   ```

3. **Input**: `event` object structure:
   ```javascript
   {
       request: {
           uri: string,        // e.g., "/gh/vladikk"
           querystring: {      // e.g., {tab: {value: "repos"}}
               paramName: { value: string }
           }
       },
       context: {
           kvs: {
               get: function(key)  // returns value string or null
           }
       }
   }
   ```

4. **Implement these validation rules** (before KVS lookup):
   - Extract the full path from `event.request.uri`
   - Check path length: must be ≤ 256 characters → return 404 if longer
   - Check for invalid patterns (case-sensitive checks):
     - Contains `..` → return 404
     - Contains `//` → return 404
     - Contains `%2F` (encoded forward slash, case-insensitive) → return 404
     - Contains `%2f` (encoded forward slash, case-insensitive) → return 404
   - Check allowed characters: ONLY `A-Z`, `a-z`, `0-9`, `_`, `-`, `/` allowed
     - Use regex: `/^[A-Za-z0-9_\-\/]+$/`
     - If match fails → return 404

5. **Parse the path**:
   - Remove leading `/` if present
   - Split by `/` to get segments
   - First segment = `key`
   - Remaining segments joined with `/` = `rest` (empty string if none)
   - Example: `/gh/vladikk/repos` → key=`"gh"`, rest=`"vladikk/repos"`
   - Example: `/gh` → key=`"gh"`, rest=`""`

6. **KVS Lookup**:
   - Call: `var target = event.context.kvs.get(key);`
   - If `target === null` → return 404

7. **Build redirect URL**:
   - Check if `target` ends with `/*`:
     - If YES (wildcard redirect):
       - Remove `/*` from end of target
       - Append `/` + `rest` to target (even if rest is empty, append `/`)
       - Result: `finalUrl = target.slice(0, -2) + "/" + rest`
     - If NO (exact redirect):
       - If `rest` is not empty → return 404 (exact redirects don't allow extra path)
       - Use target as-is: `finalUrl = target`

8. **Append query string**:
   - If `event.request.querystring` exists and has properties:
     - Build query string from object
     - Format: `param1=value1&param2=value2`
     - Append to finalUrl: `finalUrl + "?" + queryString`
   - Use this helper logic:
     ```javascript
     var queryParams = event.request.querystring;
     var queryString = "";
     if (queryParams) {
         var params = [];
         for (var param in queryParams) {
             params.push(param + "=" + queryParams[param].value);
         }
         if (params.length > 0) {
             queryString = "?" + params.join("&");
         }
     }
     ```

9. **Return redirect response**:
   - Status code: `301` (permanent redirect)
   - Headers:
     ```javascript
     {
         location: { value: finalUrl }
     }
     ```
   - Full response format:
     ```javascript
     return {
         statusCode: 301,
         statusDescription: "Moved Permanently",
         headers: {
             location: { value: finalUrl }
         }
     };
     ```

10. **Return 404 response** (for all error cases):
    ```javascript
    return {
        statusCode: 404,
        statusDescription: "Not Found",
        headers: {
            "content-type": { value: "text/plain" }
        },
        body: "Not Found"
    };
    ```

11. **Code structure requirements**:
    - Use `var` (not `let` or `const`) - CloudFront Functions use ES5
    - No arrow functions - use `function` keyword
    - No template literals - use string concatenation with `+`
    - No external dependencies or imports
    - Maximum file size: 10KB
    - All logic must be in the `handler` function

### Deliverables

1. **File Created**: `functions/redirect-function.js`
2. **Function Contents**:
   - Handler function with correct signature
   - All validation rules implemented
   - Path parsing logic
   - KVS lookup
   - Wildcard vs exact redirect logic
   - Query string preservation
   - Proper response formats (301 and 404)

3. **Code Quality**:
   - Valid ES5 JavaScript syntax
   - No syntax errors
   - Comments explaining each major section
   - File size < 10KB

### Acceptance Criteria

- [ ] File `functions/redirect-function.js` exists
- [ ] Contains function named `handler` with `event` parameter
- [ ] Validation: Path length check (256 chars max)
- [ ] Validation: Rejects paths with `..`
- [ ] Validation: Rejects paths with `//`
- [ ] Validation: Rejects paths with `%2F` or `%2f`
- [ ] Validation: Checks allowed characters with regex
- [ ] Path parsing: Extracts key and rest correctly
- [ ] KVS lookup: Calls `event.context.kvs.get(key)`
- [ ] Handles null KVS result → 404
- [ ] Wildcard redirect: Removes `/*` and appends rest
- [ ] Exact redirect: Rejects if rest exists
- [ ] Query string: Preserves and appends correctly
- [ ] Returns 301 with Location header
- [ ] Returns 404 with proper format
- [ ] Uses only ES5 syntax (var, function, no arrows, no templates)
- [ ] File is valid JavaScript (no syntax errors)

### Testing Instructions

Run these commands:
```bash
# Check file exists and size
ls -lh functions/redirect-function.js

# Validate JavaScript syntax
node --check functions/redirect-function.js

# Check for ES6+ features that aren't allowed
! grep -E '(let |const |=>|`|\bclass\b)' functions/redirect-function.js || echo "ERROR: Found ES6+ syntax"

# Verify handler function exists
grep "function handler(event)" functions/redirect-function.js
```

All commands must succeed.

### Test Cases to Manually Verify

Create a test file `tests/function-test-cases.md` documenting these scenarios:

1. **Valid wildcard redirect**: `/gh/vladikk` with KVS `gh=https://github.com/*` → 301 to `https://github.com/vladikk`
2. **Valid exact redirect**: `/docs` with KVS `docs=https://docs.example.com` → 301 to `https://docs.example.com`
3. **Exact redirect with path**: `/docs/guide` with KVS `docs=https://docs.example.com` → 404
4. **Key not found**: `/unknown` → 404
5. **Path with ..**: `/gh/../etc` → 404
6. **Path with //**: `/gh//vladikk` → 404
7. **Path with encoded slash**: `/gh%2Fvladikk` → 404
8. **Path too long**: 257 character path → 404
9. **Query string preservation**: `/gh/vladikk?tab=repos` → 301 to `https://github.com/vladikk?tab=repos`
10. **Invalid characters**: `/gh/vlad@ikk` → 404

### Notes for Next Task
The next engineer will:
- Create the CloudFormation resource for this function
- Reference this file: `functions/redirect-function.js`
- Need to read the file contents and embed it in the CloudFormation template

---

## Task 5: CloudFormation Template - CloudFront Function Resource

### Objective
Add the CloudFront Function resource to the CloudFormation template, embedding the redirect function code.

### Prerequisites
- Task 2 completed: `cloudformation/redirect-service.yaml` exists
- Task 4 completed: `functions/redirect-function.js` exists
- Read the function code to understand what it does

### Explicit Instructions

1. Open file: `cloudformation/redirect-service.yaml`

2. In the `Resources:` section, add a resource with logical ID: `RedirectFunction`

3. Resource type: `AWS::CloudFront::Function`

4. Properties to configure:

   **Name property:**
   - Use `!Sub` function: `"${Environment}-${AWS::StackName}-redirect-fn"`

   **FunctionConfig property:**
   - Comment: `!Sub "Redirect function for ${Environment} environment"`
   - Runtime: `cloudfront-js-2.0` (MUST be this exact string)
   - KeyValueStoreAssociations:
     - Create a list with ONE association:
       - KeyValueStoreARN: `!GetAtt RedirectKeyValueStore.Arn`

   Full FunctionConfig structure:
   ```yaml
   FunctionConfig:
     Comment: !Sub "Redirect function for ${Environment} environment"
     Runtime: cloudfront-js-2.0
     KeyValueStoreAssociations:
       - KeyValueStoreARN: !GetAtt RedirectKeyValueStore.Arn
   ```

   **FunctionCode property:**
   - You MUST read the contents of `functions/redirect-function.js`
   - Embed the ENTIRE file contents as a multi-line string using YAML literal block scalar `|`
   - Format:
     ```yaml
     FunctionCode: |
       [entire contents of functions/redirect-function.js file here]
     ```
   - DO NOT modify the JavaScript code
   - DO NOT add or remove any lines
   - Preserve all whitespace and indentation from the original file

   **AutoPublish property:**
   - Set to: `true`
   - This automatically publishes the function on create/update

5. Add a `DependsOn` property to the resource:
   - Value: `RedirectKeyValueStore`
   - This ensures KVS is created before the function

6. In the `Outputs:` section, add these outputs:

   **Output 1 - FunctionArn:**
   - Logical ID: `RedirectFunctionArn`
   - Value: `!GetAtt RedirectFunction.FunctionARN`
   - Description: `"CloudFront Function ARN"`
   - Export: `!Sub "${AWS::StackName}-FunctionArn"`

   **Output 2 - FunctionStage:**
   - Logical ID: `RedirectFunctionStage`
   - Value: `!GetAtt RedirectFunction.Stage`
   - Description: `"CloudFront Function Stage (DEVELOPMENT or LIVE)"`

### Deliverables

1. **Updated File**: `cloudformation/redirect-service.yaml`

2. **Resources Section** now contains:
   - `RedirectKeyValueStore` (from Task 3)
   - `RedirectFunction` (new)

3. **RedirectFunction Resource** includes:
   - Correct resource type
   - Name with environment prefix
   - FunctionConfig with runtime and KVS association
   - FunctionCode with embedded JavaScript
   - AutoPublish set to true
   - DependsOn relationship

4. **Outputs Section** includes:
   - Previous outputs from Task 3
   - `RedirectFunctionArn` (new)
   - `RedirectFunctionStage` (new)

### Acceptance Criteria

- [ ] `RedirectFunction` resource exists in Resources section
- [ ] Resource type is exactly `AWS::CloudFront::Function`
- [ ] Name uses environment and stack name
- [ ] Runtime is exactly `cloudfront-js-2.0`
- [ ] KeyValueStoreAssociations references RedirectKeyValueStore ARN
- [ ] FunctionCode contains complete JavaScript from redirect-function.js
- [ ] FunctionCode uses YAML literal block scalar `|`
- [ ] AutoPublish is set to `true`
- [ ] DependsOn is set to `RedirectKeyValueStore`
- [ ] Two new outputs added with correct properties
- [ ] Template validates successfully
- [ ] YAML syntax is valid

### Testing Instructions

Run these commands:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('cloudformation/redirect-service.yaml'))"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml

# Check RedirectFunction exists
grep -A 5 "RedirectFunction:" cloudformation/redirect-service.yaml

# Verify FunctionCode is embedded
grep -A 2 "FunctionCode: |" cloudformation/redirect-service.yaml

# Verify Runtime
grep "Runtime: cloudfront-js-2.0" cloudformation/redirect-service.yaml

# Verify DependsOn
grep -A 1 "DependsOn:" cloudformation/redirect-service.yaml | grep "RedirectKeyValueStore"

# Count resources (should be 2)
grep -E "^  [A-Z].*:$" cloudformation/redirect-service.yaml | grep -v "^  Resources:" | wc -l
```

All commands must succeed. The last command should output `2`.

### Notes for Next Task
The next engineer will add the AWS WAF WebACL resource. They DO NOT need to reference the RedirectFunction yet - that will happen later when creating the CloudFront distribution.

---

## Task 6: CloudFormation Template - AWS WAF WebACL Resource

### Objective
Add AWS WAF WebACL with rate limiting and managed rule groups for security.

### Prerequisites
- Task 5 completed: `cloudformation/redirect-service.yaml` exists with 2 resources
- Read requirements.md section "3. AWS WAF" (lines 57-66)

### Explicit Instructions

1. Open file: `cloudformation/redirect-service.yaml`

2. In the `Resources:` section, add a resource with logical ID: `RedirectWebACL`

3. Resource type: `AWS::WAFv2::WebACL`

4. Properties to configure:

   **Scope property:**
   - Value: `CLOUDFRONT` (MUST be this exact string)
   - Reason: CloudFront distributions require CLOUDFRONT scope
   - Note: CloudFront WAF resources MUST be in us-east-1 region

   **Name property:**
   - Value: `!Sub "${Environment}-${AWS::StackName}-waf"`

   **Description property:**
   - Value: `!Sub "WAF for ${Environment} environment redirect service"`

   **DefaultAction property:**
   - Allow: `{}` (empty object means allow by default)
   - Format:
     ```yaml
     DefaultAction:
       Allow: {}
     ```

   **VisibilityConfig property:**
   - SampledRequestsEnabled: `true`
   - CloudWatchMetricsEnabled: `true`
   - MetricName: `!Sub "${Environment}-${AWS::StackName}-waf-metrics"`

   **Rules property** (list of 2 rules):

   **Rule 1 - Rate Limiting:**
   - Name: `rate-limit-per-ip`
   - Priority: `0` (lower number = higher priority)
   - Statement:
     - RateBasedStatement:
       - Limit: `!Ref RateLimitPerIP` (references parameter from Task 2)
       - AggregateKeyType: `IP`
   - Action:
     - Block: `{}` (empty object)
   - VisibilityConfig:
     - SampledRequestsEnabled: `true`
     - CloudWatchMetricsEnabled: `true`
     - MetricName: `!Sub "${Environment}-rate-limit-rule"`

   Full Rule 1 structure:
   ```yaml
   - Name: rate-limit-per-ip
     Priority: 0
     Statement:
       RateBasedStatement:
         Limit: !Ref RateLimitPerIP
         AggregateKeyType: IP
     Action:
       Block: {}
     VisibilityConfig:
       SampledRequestsEnabled: true
       CloudWatchMetricsEnabled: true
       MetricName: !Sub "${Environment}-rate-limit-rule"
   ```

   **Rule 2 - AWS Managed Core Rule Set:**
   - Name: `aws-managed-core-rules`
   - Priority: `1`
   - Statement:
     - ManagedRuleGroupStatement:
       - VendorName: `AWS`
       - Name: `AWSManagedRulesCommonRuleSet`
   - OverrideAction:
     - None: `{}` (for managed rules, use OverrideAction not Action)
   - VisibilityConfig:
     - SampledRequestsEnabled: `true`
     - CloudWatchMetricsEnabled: `true`
     - MetricName: `!Sub "${Environment}-aws-core-rules"`

   Full Rule 2 structure:
   ```yaml
   - Name: aws-managed-core-rules
     Priority: 1
     Statement:
       ManagedRuleGroupStatement:
         VendorName: AWS
         Name: AWSManagedRulesCommonRuleSet
     OverrideAction:
       None: {}
     VisibilityConfig:
       SampledRequestsEnabled: true
       CloudWatchMetricsEnabled: true
       MetricName: !Sub "${Environment}-aws-core-rules"
   ```

5. In the `Outputs:` section, add these outputs:

   **Output 1 - WebACLId:**
   - Logical ID: `WebACLId`
   - Value: `!GetAtt RedirectWebACL.Id`
   - Description: `"WAF WebACL ID"`
   - Export: `!Sub "${AWS::StackName}-WebACLId"`

   **Output 2 - WebACLArn:**
   - Logical ID: `WebACLArn`
   - Value: `!GetAtt RedirectWebACL.Arn`
   - Description: `"WAF WebACL ARN"`
   - Export: `!Sub "${AWS::StackName}-WebACLArn"`

### Deliverables

1. **Updated File**: `cloudformation/redirect-service.yaml`

2. **Resources Section** now contains:
   - `RedirectKeyValueStore` (from Task 3)
   - `RedirectFunction` (from Task 5)
   - `RedirectWebACL` (new)

3. **RedirectWebACL Resource** includes:
   - Scope set to CLOUDFRONT
   - DefaultAction Allow
   - Two rules: rate limiting and AWS managed rules
   - VisibilityConfig for metrics
   - Proper priority ordering (0, 1)

4. **Outputs Section** includes:
   - Previous outputs from Tasks 3 and 5
   - `WebACLId` (new)
   - `WebACLArn` (new)

### Acceptance Criteria

- [ ] `RedirectWebACL` resource exists in Resources section
- [ ] Resource type is exactly `AWS::WAFv2::WebACL`
- [ ] Scope is `CLOUDFRONT`
- [ ] Name uses environment and stack name
- [ ] DefaultAction is Allow with empty object
- [ ] Rules list contains exactly 2 rules
- [ ] Rule 1: Priority 0, RateBasedStatement, references RateLimitPerIP parameter
- [ ] Rule 1: Uses Action.Block
- [ ] Rule 2: Priority 1, ManagedRuleGroupStatement, VendorName AWS
- [ ] Rule 2: Uses OverrideAction.None (not Action)
- [ ] Both rules have VisibilityConfig
- [ ] Two new outputs added
- [ ] Template validates successfully
- [ ] YAML syntax is valid

### Testing Instructions

Run these commands:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('cloudformation/redirect-service.yaml'))"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml

# Check RedirectWebACL exists
grep "RedirectWebACL:" cloudformation/redirect-service.yaml

# Verify Scope
grep "Scope: CLOUDFRONT" cloudformation/redirect-service.yaml

# Verify both rules exist
grep "rate-limit-per-ip" cloudformation/redirect-service.yaml
grep "aws-managed-core-rules" cloudformation/redirect-service.yaml

# Verify priorities
grep "Priority: 0" cloudformation/redirect-service.yaml
grep "Priority: 1" cloudformation/redirect-service.yaml

# Count resources (should be 3)
grep -E "^  [A-Z][A-Za-z0-9]*:$" cloudformation/redirect-service.yaml | wc -l
```

All commands must succeed. The last command should show `3` resources.

### Notes for Next Task
The next engineer will create the CloudFront Distribution resource. They will need to:
- Associate this WebACL using: `!GetAtt RedirectWebACL.Arn`
- Associate the RedirectFunction
- Configure the distribution for HTTPS with the certificate parameter

---

## Task 7: CloudFormation Template - CloudFront Distribution Resource

### Objective
Add the CloudFront Distribution resource with viewer request function association, WAF, and HTTPS configuration.

### Prerequisites
- Task 6 completed: `cloudformation/redirect-service.yaml` exists with 3 resources (KVS, Function, WebACL)
- Read requirements.md section "2. CloudFront Distribution" (lines 50-54)
- Understand that CloudFront will serve redirects without an origin for successful requests

### Explicit Instructions

1. Open file: `cloudformation/redirect-service.yaml`

2. In the `Resources:` section, add a resource with logical ID: `RedirectDistribution`

3. Resource type: `AWS::CloudFront::Distribution`

4. Add `DependsOn` property (list):
   ```yaml
   DependsOn:
     - RedirectFunction
     - RedirectWebACL
   ```

5. Properties → DistributionConfig:

   **Comment:**
   - Value: `!Sub "Redirect distribution for ${Environment} environment"`

   **Enabled:**
   - Value: `true`

   **HttpVersion:**
   - Value: `http2and3`

   **IPV6Enabled:**
   - Value: `true`

   **PriceClass:**
   - Value: `PriceClass_All`
   - This means: all edge locations globally

   **Aliases:**
   - List with one entry: `!Ref DomainName`
   - Format:
     ```yaml
     Aliases:
       - !Ref DomainName
     ```

   **ViewerCertificate:**
   - AcmCertificateArn: `!Ref CertificateArn`
   - MinimumProtocolVersion: `TLSv1.2_2021`
   - SslSupportMethod: `sni-only`
   - Format:
     ```yaml
     ViewerCertificate:
       AcmCertificateArn: !Ref CertificateArn
       MinimumProtocolVersion: TLSv1.2_2021
       SslSupportMethod: sni-only
     ```

   **Origins:**
   - List with ONE origin (required even though we redirect before reaching it):
     - Id: `dummy-origin`
     - DomainName: `example.com`
     - CustomOriginConfig:
       - HTTPPort: `80`
       - HTTPSPort: `443`
       - OriginProtocolPolicy: `https-only`
   - Note: This origin will rarely be hit because the function returns redirects
   - Format:
     ```yaml
     Origins:
       - Id: dummy-origin
         DomainName: example.com
         CustomOriginConfig:
           HTTPPort: 80
           HTTPSPort: 443
           OriginProtocolPolicy: https-only
     ```

   **DefaultCacheBehavior:**
   - TargetOriginId: `dummy-origin` (matches origin Id above)
   - ViewerProtocolPolicy: `redirect-to-https`
   - AllowedMethods: `[GET, HEAD, OPTIONS]`
   - CachedMethods: `[GET, HEAD]`
   - Compress: `true`
   - CachePolicyId: `658327ea-f89d-4fab-a63d-7e88639e58f6`
     - This is the Managed-CachingOptimized policy ID
     - DO NOT use !Ref or !Sub - use this exact string value
   - FunctionAssociations:
     - List with ONE association:
       - EventType: `viewer-request`
       - FunctionARN: `!GetAtt RedirectFunction.FunctionARN`

   Full DefaultCacheBehavior structure:
   ```yaml
   DefaultCacheBehavior:
     TargetOriginId: dummy-origin
     ViewerProtocolPolicy: redirect-to-https
     AllowedMethods:
       - GET
       - HEAD
       - OPTIONS
     CachedMethods:
       - GET
       - HEAD
     Compress: true
     CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6
     FunctionAssociations:
       - EventType: viewer-request
         FunctionARN: !GetAtt RedirectFunction.FunctionARN
   ```

   **WebACLId:**
   - Value: `!GetAtt RedirectWebACL.Arn`
   - This associates the WAF with CloudFront

   **Logging** (for observability):
   - Create a Logging section:
     - Bucket: `!Sub "${AWS::StackName}-logs.s3.amazonaws.com"`
     - Prefix: `!Sub "cloudfront/${Environment}/"`
     - IncludeCookies: `false`
   - Note: The actual S3 bucket for logs will be created in a later task
   - Format:
     ```yaml
     Logging:
       Bucket: !Sub "${AWS::StackName}-logs.s3.amazonaws.com"
       Prefix: !Sub "cloudfront/${Environment}/"
       IncludeCookies: false
     ```

6. In the `Outputs:` section, add these outputs:

   **Output 1 - DistributionId:**
   - Logical ID: `DistributionId`
   - Value: `!Ref RedirectDistribution`
   - Description: `"CloudFront Distribution ID"`
   - Export: `!Sub "${AWS::StackName}-DistributionId"`

   **Output 2 - DistributionDomainName:**
   - Logical ID: `DistributionDomainName`
   - Value: `!GetAtt RedirectDistribution.DomainName`
   - Description: `"CloudFront Distribution domain name (e.g., d1234.cloudfront.net)"`
   - Export: `!Sub "${AWS::StackName}-DistributionDomain"`

   **Output 3 - DistributionUrl:**
   - Logical ID: `DistributionUrl`
   - Value: `!Sub "https://${RedirectDistribution.DomainName}"`
   - Description: `"Full CloudFront Distribution URL"`

### Deliverables

1. **Updated File**: `cloudformation/redirect-service.yaml`

2. **Resources Section** now contains:
   - `RedirectKeyValueStore` (from Task 3)
   - `RedirectFunction` (from Task 5)
   - `RedirectWebACL` (from Task 6)
   - `RedirectDistribution` (new)

3. **RedirectDistribution Resource** includes:
   - DependsOn list
   - Complete DistributionConfig
   - ViewerCertificate with ACM certificate
   - Dummy origin
   - DefaultCacheBehavior with function association
   - WebACL association
   - Logging configuration

4. **Outputs Section** includes:
   - Previous outputs from Tasks 3, 5, and 6
   - `DistributionId` (new)
   - `DistributionDomainName` (new)
   - `DistributionUrl` (new)

### Acceptance Criteria

- [ ] `RedirectDistribution` resource exists in Resources section
- [ ] Resource type is exactly `AWS::CloudFront::Distribution`
- [ ] DependsOn includes RedirectFunction and RedirectWebACL
- [ ] DistributionConfig.Enabled is `true`
- [ ] HttpVersion is `http2and3`
- [ ] IPV6Enabled is `true`
- [ ] Aliases references DomainName parameter
- [ ] ViewerCertificate references CertificateArn parameter
- [ ] MinimumProtocolVersion is `TLSv1.2_2021`
- [ ] Origins list has one origin with Id `dummy-origin`
- [ ] DefaultCacheBehavior.TargetOriginId is `dummy-origin`
- [ ] ViewerProtocolPolicy is `redirect-to-https`
- [ ] CachePolicyId is the exact managed policy ID
- [ ] FunctionAssociations has EventType `viewer-request`
- [ ] FunctionAssociations references RedirectFunction ARN
- [ ] WebACLId references RedirectWebACL ARN
- [ ] Logging section exists with Bucket and Prefix
- [ ] Three new outputs added
- [ ] Template validates successfully
- [ ] YAML syntax is valid

### Testing Instructions

Run these commands:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('cloudformation/redirect-service.yaml'))"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml

# Check RedirectDistribution exists
grep "RedirectDistribution:" cloudformation/redirect-service.yaml

# Verify DependsOn
grep -A 2 "DependsOn:" cloudformation/redirect-service.yaml | grep "RedirectFunction"

# Verify ViewerProtocolPolicy
grep "ViewerProtocolPolicy: redirect-to-https" cloudformation/redirect-service.yaml

# Verify FunctionAssociations
grep -A 2 "FunctionAssociations:" cloudformation/redirect-service.yaml

# Verify WebACL association
grep "WebACLId:" cloudformation/redirect-service.yaml

# Count resources (should be 4)
grep -E "^  [A-Z][A-Za-z0-9]*:$" cloudformation/redirect-service.yaml | wc -l
```

All commands must succeed. The last command should show `4` resources.

### Notes for Next Task
The next engineer will create the S3 bucket resource for CloudFront access logs. They need to:
- Create bucket with name matching the Logging.Bucket format
- Configure bucket policy to allow CloudFront to write logs
- Set lifecycle policy to manage log retention

---

## Task 8: CloudFormation Template - S3 Logging Bucket Resource

### Objective
Add S3 bucket for CloudFront access logs with proper permissions and lifecycle management.

### Prerequisites
- Task 7 completed: `cloudformation/redirect-service.yaml` exists with RedirectDistribution configured with Logging
- Read requirements.md section "Observability" (lines 207-218)

### Explicit Instructions

1. Open file: `cloudformation/redirect-service.yaml`

2. In the `Resources:` section, add a resource with logical ID: `LogsBucket`

3. Resource type: `AWS::S3::Bucket`

4. Properties to configure:

   **BucketName:**
   - Value: `!Sub "${AWS::StackName}-logs"`
   - This matches the bucket referenced in RedirectDistribution Logging config

   **BucketEncryption:**
   - ServerSideEncryptionConfiguration:
     - List with one rule:
       - ServerSideEncryptionByDefault:
         - SSEAlgorithm: `AES256`
   - Format:
     ```yaml
     BucketEncryption:
       ServerSideEncryptionConfiguration:
         - ServerSideEncryptionByDefault:
             SSEAlgorithm: AES256
     ```

   **PublicAccessBlockConfiguration:**
   - BlockPublicAcls: `true`
   - BlockPublicPolicy: `true`
   - IgnorePublicAcls: `true`
   - RestrictPublicBuckets: `true`
   - Format:
     ```yaml
     PublicAccessBlockConfiguration:
       BlockPublicAcls: true
       BlockPublicPolicy: true
       IgnorePublicAcls: true
       RestrictPublicBuckets: true
     ```

   **LifecycleConfiguration:**
   - Rules list with ONE rule:
     - Id: `delete-old-logs`
     - Status: `Enabled`
     - ExpirationInDays: `90` (delete logs after 90 days)
   - Format:
     ```yaml
     LifecycleConfiguration:
       Rules:
         - Id: delete-old-logs
           Status: Enabled
           ExpirationInDays: 90
     ```

   **OwnershipControls:**
   - Rules:
     - ObjectOwnership: `BucketOwnerPreferred`
   - Required for CloudFront to write logs
   - Format:
     ```yaml
     OwnershipControls:
       Rules:
         - ObjectOwnership: BucketOwnerPreferred
     ```

5. Add a resource with logical ID: `LogsBucketPolicy`

6. Resource type: `AWS::S3::BucketPolicy`

7. Properties for LogsBucketPolicy:

   **Bucket:**
   - Value: `!Ref LogsBucket`

   **PolicyDocument:**
   - Version: `"2012-10-17"`
   - Statement (list with ONE statement):
     - Sid: `AllowCloudFrontLogs`
     - Effect: `Allow`
     - Principal:
       - Service: `cloudfront.amazonaws.com`
     - Action: `s3:PutObject`
     - Resource: `!Sub "${LogsBucket.Arn}/*"`
     - Condition:
       - StringEquals:
         - `AWS:SourceArn`: `!Sub "arn:aws:cloudfront::${AWS::AccountId}:distribution/${RedirectDistribution}"`

   Full PolicyDocument structure:
   ```yaml
   PolicyDocument:
     Version: "2012-10-17"
     Statement:
       - Sid: AllowCloudFrontLogs
         Effect: Allow
         Principal:
           Service: cloudfront.amazonaws.com
         Action: s3:PutObject
         Resource: !Sub "${LogsBucket.Arn}/*"
         Condition:
           StringEquals:
             AWS:SourceArn: !Sub "arn:aws:cloudfront::${AWS::AccountId}:distribution/${RedirectDistribution}"
   ```

8. Add `DependsOn` to LogsBucketPolicy:
   - Value: `LogsBucket`

9. Modify the `RedirectDistribution` resource:
   - Add `DependsOn` entry for `LogsBucket` (in addition to existing dependencies)
   - Updated DependsOn should be:
     ```yaml
     DependsOn:
       - RedirectFunction
       - RedirectWebACL
       - LogsBucket
     ```

10. In the `Outputs:` section, add this output:

    **Output - LogsBucketName:**
    - Logical ID: `LogsBucketName`
    - Value: `!Ref LogsBucket`
    - Description: `"S3 bucket name for CloudFront access logs"`
    - Export: `!Sub "${AWS::StackName}-LogsBucket"`

### Deliverables

1. **Updated File**: `cloudformation/redirect-service.yaml`

2. **Resources Section** now contains:
   - Previous 4 resources
   - `LogsBucket` (new)
   - `LogsBucketPolicy` (new)
   - Total: 6 resources

3. **LogsBucket Resource** includes:
   - BucketName matching distribution logging config
   - Encryption configuration
   - Public access block (all true)
   - Lifecycle rule (90 days)
   - Ownership controls

4. **LogsBucketPolicy Resource** includes:
   - Bucket reference
   - Policy allowing CloudFront to write logs
   - Condition restricting to specific distribution
   - DependsOn LogsBucket

5. **RedirectDistribution** updated:
   - DependsOn includes LogsBucket

6. **Outputs Section** includes:
   - Previous outputs
   - `LogsBucketName` (new)

### Acceptance Criteria

- [ ] `LogsBucket` resource exists in Resources section
- [ ] Resource type is exactly `AWS::S3::Bucket`
- [ ] BucketName uses StackName with `-logs` suffix
- [ ] BucketEncryption uses AES256
- [ ] PublicAccessBlockConfiguration: all 4 settings are `true`
- [ ] LifecycleConfiguration has rule with 90 day expiration
- [ ] OwnershipControls sets ObjectOwnership to BucketOwnerPreferred
- [ ] `LogsBucketPolicy` resource exists
- [ ] Resource type is exactly `AWS::S3::BucketPolicy`
- [ ] Policy allows s3:PutObject from cloudfront.amazonaws.com
- [ ] Policy has Condition with AWS:SourceArn
- [ ] LogsBucketPolicy has DependsOn LogsBucket
- [ ] RedirectDistribution DependsOn includes LogsBucket
- [ ] One new output added
- [ ] Template validates successfully
- [ ] YAML syntax is valid

### Testing Instructions

Run these commands:
```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('cloudformation/redirect-service.yaml'))"

# Validate CloudFormation template
aws cloudformation validate-template --template-body file://cloudformation/redirect-service.yaml

# Check LogsBucket exists
grep "LogsBucket:" cloudformation/redirect-service.yaml

# Verify encryption
grep "SSEAlgorithm: AES256" cloudformation/redirect-service.yaml

# Verify public access block
grep "BlockPublicAcls: true" cloudformation/redirect-service.yaml

# Verify lifecycle rule
grep "ExpirationInDays: 90" cloudformation/redirect-service.yaml

# Check LogsBucketPolicy exists
grep "LogsBucketPolicy:" cloudformation/redirect-service.yaml

# Verify CloudFront can write logs
grep "Service: cloudfront.amazonaws.com" cloudformation/redirect-service.yaml

# Count resources (should be 6)
grep -E "^  [A-Z][A-Za-z0-9]*:$" cloudformation/redirect-service.yaml | wc -l
```

All commands must succeed. The last command should show `6` resources.

### Notes for Next Task
The next engineer will update the README.md file with deployment instructions. They need to:
- Document prerequisites (AWS CLI, ACM certificate)
- Provide deployment commands
- Explain parameter values
- Document how to update KVS with redirect mappings

---

## Task 9: Documentation - Deployment Instructions in README

### Objective
Update README.md with complete deployment instructions, prerequisites, and usage examples.

### Prerequisites
- Task 8 completed: All CloudFormation resources defined
- Task 1 completed: README.md exists with placeholder sections

### Explicit Instructions

1. Open file: `README.md`

2. Replace the entire contents with the following structure:

---

**Section 1: Header and Description**

```markdown
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
```

---

**Section 2: Prerequisites**

```markdown
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
```

---

**Section 3: Project Structure**

```markdown
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
```

---

**Section 4: Deployment**

```markdown
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
```

---

**Section 5: Usage Examples**

```markdown
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
```

---

**Section 6: Updating and Management**

```markdown
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
```

---

**Section 7: Monitoring and Troubleshooting**

```markdown
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
```

---

**Section 8: Costs and Cleanup**

```markdown
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
```

---

**Section 9: Footer**

```markdown
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
```

---

3. Save the file.

### Deliverables

1. **Updated File**: `README.md`

2. **File Contents** includes:
   - Complete header and description
   - Prerequisites section with all requirements
   - Project structure explanation
   - Deployment instructions (5 steps)
   - Usage examples
   - Update instructions
   - Monitoring and troubleshooting guide
   - Cost information
   - Cleanup instructions
   - Security considerations
   - Limitations

3. **Validation**:
   - All AWS CLI commands are syntactically correct
   - All code blocks are properly formatted
   - All placeholder values clearly marked (YOUR_*, etc.)

### Acceptance Criteria

- [ ] README.md file exists
- [ ] Contains all 9 sections specified above
- [ ] Prerequisites section lists all requirements
- [ ] Deployment section has 5 complete steps
- [ ] All AWS CLI commands use correct syntax
- [ ] Code blocks use proper markdown formatting (```)
- [ ] Usage examples demonstrate wildcard and exact redirects
- [ ] Monitoring section includes CloudWatch commands
- [ ] Troubleshooting section covers common issues
- [ ] Cleanup section includes deletion commands
- [ ] File is valid markdown (no syntax errors)

### Testing Instructions

Run these commands:
```bash
# Check file exists
ls -lh README.md

# Count sections (should have ## headers)
grep "^## " README.md | wc -l

# Verify code blocks are closed
python3 -c "
content = open('README.md').read()
count = content.count('\`\`\`')
assert count % 2 == 0, 'Unclosed code blocks'
print(f'Code blocks: {count // 2}')
"

# Check for placeholder guidance
grep -i "YOUR_" README.md | head -5
```

All commands must succeed.

### Notes for Next Task
The next engineer will create a deployment script to automate the deployment process. They will use the README.md commands as a reference.

---

## Task 10: Deployment Script - Automated Stack Deployment

### Objective
Create a bash script to automate the CloudFormation stack deployment with validation and error handling.

### Prerequisites
- Task 2-8 completed: CloudFormation template fully defined
- Task 9 completed: README.md with deployment instructions

### Explicit Instructions

1. Create file: `deploy.sh` in project root

2. Add shebang and set bash options:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   ```
   - `-e`: Exit on error
   - `-u`: Exit on undefined variable
   - `-o pipefail`: Exit on pipe failure

3. Add script header comment:
   ```bash
   # deploy.sh - Automated deployment script for zzip.to redirect service
   # Usage: ./deploy.sh <stack-name> <environment> <domain-name> <certificate-arn> [rate-limit]
   ```

4. Define color codes for output (makes errors/success visible):
   ```bash
   RED='\033[0;31m'
   GREEN='\033[0;32m'
   YELLOW='\033[1;33m'
   NC='\033[0m' # No Color
   ```

5. Create logging functions:
   ```bash
   log_info() {
       echo -e "${GREEN}[INFO]${NC} $1"
   }

   log_warn() {
       echo -e "${YELLOW}[WARN]${NC} $1"
   }

   log_error() {
       echo -e "${RED}[ERROR]${NC} $1"
   }
   ```

6. Parse command line arguments:
   ```bash
   # Check minimum required arguments
   if [ $# -lt 4 ]; then
       log_error "Insufficient arguments"
       echo "Usage: $0 <stack-name> <environment> <domain-name> <certificate-arn> [rate-limit]"
       echo ""
       echo "Arguments:"
       echo "  stack-name       : CloudFormation stack name (e.g., zzipto-redirect)"
       echo "  environment      : Environment (dev, test, or prod)"
       echo "  domain-name      : Domain name (e.g., zzip.to)"
       echo "  certificate-arn  : ACM certificate ARN in us-east-1"
       echo "  rate-limit       : Optional. Requests per IP per 5 min (default: 2000)"
       echo ""
       echo "Example:"
       echo "  $0 zzipto-redirect prod zzip.to arn:aws:acm:us-east-1:123456789012:certificate/abc-123 2000"
       exit 1
   fi

   STACK_NAME="$1"
   ENVIRONMENT="$2"
   DOMAIN_NAME="$3"
   CERTIFICATE_ARN="$4"
   RATE_LIMIT="${5:-2000}"  # Default to 2000 if not provided

   # Validate environment
   if [[ ! "$ENVIRONMENT" =~ ^(dev|test|prod)$ ]]; then
       log_error "Invalid environment: $ENVIRONMENT"
       log_error "Must be one of: dev, test, prod"
       exit 1
   fi
   ```

7. Define AWS region constant:
   ```bash
   AWS_REGION="us-east-1"
   log_info "Using AWS region: $AWS_REGION"
   ```

8. Validate prerequisites:
   ```bash
   # Check AWS CLI is installed
   if ! command -v aws &> /dev/null; then
       log_error "AWS CLI not found. Please install it first."
       exit 1
   fi

   # Check Python 3 is installed (for template validation)
   if ! command -v python3 &> /dev/null; then
       log_error "Python 3 not found. Please install it first."
       exit 1
   fi

   # Check template file exists
   TEMPLATE_FILE="cloudformation/redirect-service.yaml"
   if [ ! -f "$TEMPLATE_FILE" ]; then
       log_error "Template file not found: $TEMPLATE_FILE"
       exit 1
   fi

   log_info "Prerequisites check passed"
   ```

9. Validate AWS credentials:
   ```bash
   log_info "Validating AWS credentials..."
   if ! aws sts get-caller-identity --region "$AWS_REGION" &> /dev/null; then
       log_error "AWS credentials not configured or invalid"
       log_error "Run: aws configure"
       exit 1
   fi

   AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$AWS_REGION")
   log_info "Using AWS Account: $AWS_ACCOUNT_ID"
   ```

10. Validate CloudFormation template:
    ```bash
    log_info "Validating CloudFormation template..."

    # Validate YAML syntax
    if ! python3 -c "import yaml; yaml.safe_load(open('$TEMPLATE_FILE'))" 2>/dev/null; then
        log_error "Template has invalid YAML syntax"
        exit 1
    fi

    # Validate with CloudFormation
    if ! aws cloudformation validate-template \
        --template-body "file://$TEMPLATE_FILE" \
        --region "$AWS_REGION" &> /dev/null; then
        log_error "Template validation failed"
        aws cloudformation validate-template \
            --template-body "file://$TEMPLATE_FILE" \
            --region "$AWS_REGION"
        exit 1
    fi

    log_info "Template validation passed"
    ```

11. Check if stack already exists:
    ```bash
    log_info "Checking if stack exists: $STACK_NAME"

    STACK_EXISTS=false
    if aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" &> /dev/null; then
        STACK_EXISTS=true
        STACK_STATUS=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION" \
            --query 'Stacks[0].StackStatus' \
            --output text)
        log_warn "Stack already exists with status: $STACK_STATUS"
    else
        log_info "Stack does not exist. Will create new stack."
    fi
    ```

12. Prompt for confirmation:
    ```bash
    echo ""
    log_info "=== Deployment Configuration ==="
    echo "Stack Name:       $STACK_NAME"
    echo "Environment:      $ENVIRONMENT"
    echo "Domain Name:      $DOMAIN_NAME"
    echo "Certificate ARN:  $CERTIFICATE_ARN"
    echo "Rate Limit:       $RATE_LIMIT requests per IP per 5 min"
    echo "AWS Region:       $AWS_REGION"
    echo "AWS Account:      $AWS_ACCOUNT_ID"
    if [ "$STACK_EXISTS" = true ]; then
        echo "Action:           UPDATE EXISTING STACK"
    else
        echo "Action:           CREATE NEW STACK"
    fi
    echo ""

    read -p "Continue with deployment? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_warn "Deployment cancelled by user"
        exit 0
    fi
    ```

13. Deploy or update stack:
    ```bash
    if [ "$STACK_EXISTS" = true ]; then
        log_info "Updating stack: $STACK_NAME"

        aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body "file://$TEMPLATE_FILE" \
            --parameters \
                ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
                ParameterKey=DomainName,ParameterValue="$DOMAIN_NAME" \
                ParameterKey=CertificateArn,ParameterValue="$CERTIFICATE_ARN" \
                ParameterKey=RateLimitPerIP,ParameterValue="$RATE_LIMIT" \
            --region "$AWS_REGION" \
            --capabilities CAPABILITY_IAM

        OPERATION="update"
        WAIT_CONDITION="stack-update-complete"
    else
        log_info "Creating stack: $STACK_NAME"

        aws cloudformation create-stack \
            --stack-name "$STACK_NAME" \
            --template-body "file://$TEMPLATE_FILE" \
            --parameters \
                ParameterKey=Environment,ParameterValue="$ENVIRONMENT" \
                ParameterKey=DomainName,ParameterValue="$DOMAIN_NAME" \
                ParameterKey=CertificateArn,ParameterValue="$CERTIFICATE_ARN" \
                ParameterKey=RateLimitPerIP,ParameterValue="$RATE_LIMIT" \
            --region "$AWS_REGION" \
            --capabilities CAPABILITY_IAM

        OPERATION="create"
        WAIT_CONDITION="stack-create-complete"
    fi
    ```

14. Wait for stack operation to complete:
    ```bash
    log_info "Waiting for stack ${OPERATION} to complete..."
    log_warn "This may take 15-30 minutes (CloudFront distribution provisioning)"

    if ! aws cloudformation wait "$WAIT_CONDITION" \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"; then
        log_error "Stack ${OPERATION} failed"

        # Show recent stack events for debugging
        log_error "Recent stack events:"
        aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION" \
            --max-items 10 \
            --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[ResourceType, ResourceStatus, ResourceStatusReason]' \
            --output table

        exit 1
    fi

    log_info "Stack ${OPERATION} completed successfully!"
    ```

15. Retrieve and display stack outputs:
    ```bash
    log_info "Retrieving stack outputs..."
    echo ""
    log_info "=== Stack Outputs ==="

    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table

    # Get specific outputs for instructions
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
        --output text)

    DISTRIBUTION_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
        --output text)

    KVS_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`KeyValueStoreArn`].OutputValue' \
        --output text)
    ```

16. Display next steps:
    ```bash
    echo ""
    log_info "=== Next Steps ==="
    echo ""
    echo "1. Configure DNS:"
    echo "   Point $DOMAIN_NAME to: $DISTRIBUTION_DOMAIN"
    echo "   (Use ALIAS record in Route 53 or CNAME with external DNS)"
    echo ""
    echo "2. Add redirect mappings to KeyValueStore:"
    echo "   Example (wildcard redirect):"
    echo "   aws cloudfront-keyvaluestore put-key \\"
    echo "     --kvs-arn $KVS_ARN \\"
    echo "     --key gh \\"
    echo "     --value 'https://github.com/*' \\"
    echo "     --region $AWS_REGION"
    echo ""
    echo "   Example (exact redirect):"
    echo "   aws cloudfront-keyvaluestore put-key \\"
    echo "     --kvs-arn $KVS_ARN \\"
    echo "     --key docs \\"
    echo "     --value 'https://docs.example.com' \\"
    echo "     --region $AWS_REGION"
    echo ""
    echo "3. Test the redirect:"
    echo "   curl -I https://$DOMAIN_NAME/gh/test"
    echo ""
    log_info "Deployment complete!"
    ```

17. Make script executable (instruction for next task):
    - After creating the file, run: `chmod +x deploy.sh`

### Deliverables

1. **File Created**: `deploy.sh` in project root

2. **Script Contents**:
   - Shebang and bash options
   - Color-coded logging functions
   - Argument parsing and validation
   - Environment validation
   - Prerequisites checking
   - AWS credentials validation
   - Template validation
   - Stack existence checking
   - User confirmation prompt
   - Stack create/update logic
   - Wait for completion with timeout
   - Output display
   - Next steps instructions

3. **Script Features**:
   - Handles both create and update operations
   - Validates all inputs
   - Shows clear error messages
   - Displays deployment progress
   - Shows stack outputs
   - Provides next steps

### Acceptance Criteria

- [ ] File `deploy.sh` exists in project root
- [ ] Shebang is `#!/usr/bin/env bash`
- [ ] Uses `set -euo pipefail`
- [ ] Has color-coded output (RED, GREEN, YELLOW)
- [ ] Validates minimum 4 arguments
- [ ] Validates environment is dev/test/prod
- [ ] Checks for AWS CLI and Python 3
- [ ] Checks template file exists
- [ ] Validates AWS credentials with STS
- [ ] Validates template YAML syntax
- [ ] Validates template with CloudFormation
- [ ] Checks if stack exists
- [ ] Shows deployment configuration
- [ ] Prompts for user confirmation
- [ ] Handles both create-stack and update-stack
- [ ] Waits for stack completion
- [ ] Shows error events on failure
- [ ] Displays stack outputs on success
- [ ] Shows next steps with examples
- [ ] Script is valid bash (no syntax errors)

### Testing Instructions

Run these commands:
```bash
# Check file exists
ls -l deploy.sh

# Validate bash syntax
bash -n deploy.sh

# Check shebang
head -1 deploy.sh | grep "#!/usr/bin/env bash"

# Check for required functions
grep "log_info()" deploy.sh
grep "log_error()" deploy.sh
grep "log_warn()" deploy.sh

# Make executable
chmod +x deploy.sh

# Test help message (should show usage and exit 1)
./deploy.sh || echo "Exit code: $?"

# Should show usage message
./deploy.sh 2>&1 | grep "Usage:"
```

All commands must succeed.

### Manual Test (Optional)

To test the full script (only if you have real AWS credentials and certificate):

```bash
./deploy.sh test-stack dev dev.zzip.to arn:aws:acm:us-east-1:123456789012:certificate/test-123 1000
```

Should prompt for confirmation before deploying.

### Notes for Next Task
The next engineer will create test documentation for the CloudFront Function. They will document test cases and expected behaviors for validation.

---

## Task 11: Testing Documentation - Function Test Cases

### Objective
Create comprehensive test case documentation for the CloudFront Function redirect logic.

### Prerequisites
- Task 4 completed: `functions/redirect-function.js` exists
- Read requirements.md sections on redirect rules and validation (lines 98-186)

### Explicit Instructions

1. File already mentioned in Task 4 but not created: `tests/function-test-cases.md`

2. Create this file with the following complete test case documentation:

---

```markdown
# CloudFront Function Test Cases

This document defines test cases for the redirect function logic.

## Test Environment Setup

To test the function, you need:
- CloudFront distribution deployed
- KeyValueStore with test mappings
- Ability to make HTTP requests (curl, browser, etc.)

## Key Value Store Test Data

Before running tests, populate KVS with these mappings:

```bash
# Wildcard redirects
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key gh --value "https://github.com/*"
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key tw --value "https://twitter.com/*"

# Exact redirects
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key docs --value "https://docs.example.com"
aws cloudfront-keyvaluestore put-key --kvs-arn YOUR_KVS_ARN --key home --value "https://example.com/home"
```

Wait 1-2 minutes for KVS propagation to edge locations.

---

## Test Categories

### Category 1: Wildcard Redirects

#### Test 1.1: Wildcard redirect - root path
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/`

**Test Command:**
```bash
curl -I https://zzip.to/gh
```

**Expected Output:**
```
HTTP/2 301
location: https://github.com/
```

**Pass Criteria:** Location header is exactly `https://github.com/`

---

#### Test 1.2: Wildcard redirect - single path segment
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk`

**Test Command:**
```bash
curl -I https://zzip.to/gh/vladikk
```

**Pass Criteria:** Location header is exactly `https://github.com/vladikk`

---

#### Test 1.3: Wildcard redirect - multiple path segments
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk/repos/awesome-project`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk/repos/awesome-project`

**Test Command:**
```bash
curl -I https://zzip.to/gh/vladikk/repos/awesome-project
```

**Pass Criteria:** All path segments after `/gh/` are appended

---

#### Test 1.4: Wildcard redirect - with query string
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk?tab=repositories&sort=stars`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk?tab=repositories&sort=stars`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vladikk?tab=repositories&sort=stars'
```

**Pass Criteria:** Query string is preserved exactly

---

#### Test 1.5: Wildcard redirect - path with query string
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk/repos?type=public`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk/repos?type=public`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vladikk/repos?type=public'
```

**Pass Criteria:** Both path and query string preserved

---

### Category 2: Exact Redirects

#### Test 2.1: Exact redirect - valid
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://docs.example.com`

**Test Command:**
```bash
curl -I https://zzip.to/docs
```

**Pass Criteria:** Redirects to exact URL, no trailing slash added

---

#### Test 2.2: Exact redirect - with query string
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs?search=api`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://docs.example.com?search=api`

**Test Command:**
```bash
curl -I 'https://zzip.to/docs?search=api'
```

**Pass Criteria:** Query string appended to exact URL

---

#### Test 2.3: Exact redirect - with extra path (should fail)
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs/guide/intro`

**Expected Response:**
- Status: `404 Not Found`
- Body: `Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/docs/guide/intro
```

**Pass Criteria:** Returns 404 (exact redirects don't allow extra path)

**Reason:** Exact redirects must match the key exactly. Any additional path segments result in 404.

---

#### Test 2.4: Exact redirect - with trailing slash (should fail)
**Setup:** KVS `docs = https://docs.example.com`

**Request:** `GET /docs/`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/docs/
```

**Pass Criteria:** Returns 404

**Reason:** `/docs/` has an extra empty segment, treated as extra path

---

### Category 3: Key Not Found

#### Test 3.1: Unknown key
**Setup:** Key `unknown` does not exist in KVS

**Request:** `GET /unknown`

**Expected Response:**
- Status: `404 Not Found`
- Header: `content-type: text/plain`
- Body: `Not Found`

**Test Command:**
```bash
curl -i https://zzip.to/unknown
```

**Pass Criteria:** 404 response with body

---

#### Test 3.2: Unknown key with path
**Setup:** Key `notfound` does not exist in KVS

**Request:** `GET /notfound/some/path`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/notfound/some/path
```

**Pass Criteria:** 404 response

---

### Category 4: Path Validation - Security

#### Test 4.1: Path with double dots (directory traversal attempt)
**Request:** `GET /gh/../etc/passwd`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh/../etc/passwd
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `..` which is blocked for security

---

#### Test 4.2: Path with double slashes
**Request:** `GET /gh//vladikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh//vladikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `//` which is blocked

---

#### Test 4.3: Path with encoded slash (lowercase)
**Request:** `GET /gh%2fvladikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh%2fvladikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `%2f` (URL-encoded `/`)

---

#### Test 4.4: Path with encoded slash (uppercase)
**Request:** `GET /gh%2Fvladikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh%2Fvladikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path contains `%2F` (URL-encoded `/`)

---

#### Test 4.5: Path with invalid characters
**Request:** `GET /gh/vlad@ikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh/vlad@ikk
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** `@` is not in allowed characters set

---

#### Test 4.6: Path with space
**Request:** `GET /gh/vlad ikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vlad ikk'
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Space is not an allowed character

---

#### Test 4.7: Path with special characters
**Request:** `GET /gh/vlad$ikk`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vlad$ikk'
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** `$` is not an allowed character

---

### Category 5: Path Length Validation

#### Test 5.1: Maximum valid path (256 characters)
**Setup:** KVS `test = https://example.com/*`

**Request:** `GET /test/` + 251 characters of `a`

**Expected Response:**
- Status: `301 Moved Permanently`

**Test Command:**
```bash
# Generate 251 'a' characters (total path = 256 including /test/)
PATH_256=$(printf '/test/%0.s' {1..251} | sed 's/.$/a/g')
curl -I "https://zzip.to${PATH_256:0:256}"
```

**Pass Criteria:** Redirects successfully

**Reason:** 256 is the maximum allowed length

---

#### Test 5.2: Path too long (257 characters)
**Request:** `GET /test/` + 252 characters

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
# Generate 252 'a' characters (total path = 257)
PATH_257=$(printf 'a%.0s' {1..252})
curl -I "https://zzip.to/test/${PATH_257}"
```

**Pass Criteria:** 404 before KVS lookup

**Reason:** Path exceeds 256 character limit

---

### Category 6: Edge Cases

#### Test 6.1: Root path only
**Request:** `GET /`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/
```

**Pass Criteria:** 404 response

**Reason:** No key extracted from path

---

#### Test 6.2: Empty path after normalization
**Request:** `GET //`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to//
```

**Pass Criteria:** 404 response

**Reason:** Path contains `//`

---

#### Test 6.3: Query string only (no path)
**Request:** `GET /?param=value`

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I 'https://zzip.to/?param=value'
```

**Pass Criteria:** 404 response

**Reason:** No key in path

---

#### Test 6.4: Key with underscore
**Setup:** KVS `test_key = https://example.com`

**Request:** `GET /test_key`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://example.com`

**Test Command:**
```bash
curl -I https://zzip.to/test_key
```

**Pass Criteria:** Redirects successfully

**Reason:** Underscore is allowed character

---

#### Test 6.5: Key with hyphen
**Setup:** KVS `test-key = https://example.com`

**Request:** `GET /test-key`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://example.com`

**Test Command:**
```bash
curl -I https://zzip.to/test-key
```

**Pass Criteria:** Redirects successfully

**Reason:** Hyphen is allowed character

---

#### Test 6.6: Key with numbers
**Setup:** KVS `key123 = https://example.com`

**Request:** `GET /key123`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://example.com`

**Test Command:**
```bash
curl -I https://zzip.to/key123
```

**Pass Criteria:** Redirects successfully

**Reason:** Numbers are allowed

---

#### Test 6.7: Case sensitivity
**Setup:** KVS `GH = https://github.com/*` (uppercase)

**Request:** `GET /gh` (lowercase)

**Expected Response:**
- Status: `404 Not Found`

**Test Command:**
```bash
curl -I https://zzip.to/gh
```

**Pass Criteria:** 404 response

**Reason:** Keys are case-sensitive. `GH` ≠ `gh`

---

### Category 7: Multiple Query Parameters

#### Test 7.1: Multiple query parameters
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/search?q=test&type=repositories&sort=stars`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/search?q=test&type=repositories&sort=stars`

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/search?q=test&type=repositories&sort=stars'
```

**Pass Criteria:** All query parameters preserved

---

#### Test 7.2: Query parameter with special characters
**Setup:** KVS `gh = https://github.com/*`

**Request:** `GET /gh/vladikk?q=hello+world&filter=stars>100`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: Location with encoded query string

**Test Command:**
```bash
curl -I 'https://zzip.to/gh/vladikk?q=hello+world&filter=stars>100'
```

**Pass Criteria:** Query string preserved (may be URL-encoded by CloudFront)

---

### Category 8: HTTP Methods

#### Test 8.1: HEAD request
**Setup:** KVS `gh = https://github.com/*`

**Request:** `HEAD /gh/vladikk`

**Expected Response:**
- Status: `301 Moved Permanently`
- Header: `Location: https://github.com/vladikk`
- No body

**Test Command:**
```bash
curl -I -X HEAD https://zzip.to/gh/vladikk
```

**Pass Criteria:** Same redirect response as GET

---

#### Test 8.2: OPTIONS request
**Setup:** KVS `gh = https://github.com/*`

**Request:** `OPTIONS /gh/vladikk`

**Expected Response:**
- Status: `301 Moved Permanently` or handled by CloudFront

**Test Command:**
```bash
curl -I -X OPTIONS https://zzip.to/gh/vladikk
```

**Pass Criteria:** Request is processed (may be handled by CloudFront before function)

---

## Test Execution Checklist

Run tests in order:

- [ ] Setup: Deploy CloudFormation stack
- [ ] Setup: Populate KVS with test data
- [ ] Setup: Wait 2 minutes for propagation
- [ ] Category 1: All wildcard redirect tests (1.1 - 1.5)
- [ ] Category 2: All exact redirect tests (2.1 - 2.4)
- [ ] Category 3: All key not found tests (3.1 - 3.2)
- [ ] Category 4: All security validation tests (4.1 - 4.7)
- [ ] Category 5: All path length tests (5.1 - 5.2)
- [ ] Category 6: All edge case tests (6.1 - 6.7)
- [ ] Category 7: All query parameter tests (7.1 - 7.2)
- [ ] Category 8: All HTTP method tests (8.1 - 8.2)

## Automated Testing Script

Create `tests/run-tests.sh` for automated testing:

```bash
#!/usr/bin/env bash
# Run all test cases and report results

DOMAIN="zzip.to"
PASSED=0
FAILED=0

test_redirect() {
    local name="$1"
    local path="$2"
    local expected_code="$3"
    local expected_location="$4"

    response=$(curl -s -I "https://${DOMAIN}${path}")
    code=$(echo "$response" | grep -i "^HTTP" | awk '{print $2}')
    location=$(echo "$response" | grep -i "^location:" | cut -d' ' -f2- | tr -d '\r')

    if [ "$code" = "$expected_code" ]; then
        if [ -z "$expected_location" ] || [ "$location" = "$expected_location" ]; then
            echo "✓ $name"
            ((PASSED++))
            return 0
        fi
    fi

    echo "✗ $name (got: $code $location)"
    ((FAILED++))
    return 1
}

echo "Running CloudFront Function Tests..."
echo ""

# Category 1: Wildcard redirects
test_redirect "1.1 Wildcard root" "/gh" "301" "https://github.com/"
test_redirect "1.2 Wildcard single path" "/gh/vladikk" "301" "https://github.com/vladikk"
test_redirect "1.3 Wildcard multiple paths" "/gh/vladikk/repos" "301" "https://github.com/vladikk/repos"

# Category 2: Exact redirects
test_redirect "2.1 Exact redirect" "/docs" "301" "https://docs.example.com"
test_redirect "2.3 Exact with extra path" "/docs/guide" "404" ""

# Category 3: Not found
test_redirect "3.1 Unknown key" "/unknown" "404" ""

# Category 4: Security
test_redirect "4.1 Path with .." "/gh/../etc" "404" ""
test_redirect "4.2 Path with //" "/gh//vladikk" "404" ""
test_redirect "4.5 Invalid characters" "/gh/vlad@ikk" "404" ""

echo ""
echo "Results: $PASSED passed, $FAILED failed"

if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
```

Make executable: `chmod +x tests/run-tests.sh`

## Success Criteria

All tests must pass for the function to be considered correct.

**Critical Tests (must pass):**
- All Category 1 tests (wildcard redirects)
- All Category 2 tests (exact redirects)
- All Category 4 tests (security validation)
- Test 5.2 (path length limit)

**Important Tests (should pass):**
- All other categories

## Troubleshooting Test Failures

**If wildcard redirects fail:**
- Check KVS value ends with `/*`
- Verify KVS propagation (wait 2-5 minutes)
- Check function code wildcard handling

**If exact redirects fail:**
- Check KVS value does NOT end with `/*`
- Verify exact match logic in function

**If validation fails:**
- Check regex pattern for allowed characters
- Verify path length check (≤ 256)
- Check for `..`, `//`, `%2F` patterns

**If 404s are returned unexpectedly:**
- Verify KVS key exists: `aws cloudfront-keyvaluestore list-keys`
- Check key case sensitivity
- Wait for KVS propagation

**If redirects go to wrong location:**
- Check target URL in KVS
- Verify path concatenation logic
- Check query string handling
```

---

3. Save the file.

4. Create the automated test script file: `tests/run-tests.sh` (content is included in the markdown above)

5. Make the test script executable (instruction for acceptance):
   - Run: `chmod +x tests/run-tests.sh`

### Deliverables

1. **File Created**: `tests/function-test-cases.md`
2. **File Created**: `tests/run-tests.sh`

3. **Test Documentation Contents**:
   - Setup instructions
   - KVS test data
   - 8 test categories
   - 30+ individual test cases
   - Each test has: description, setup, request, expected response, test command, pass criteria
   - Test execution checklist
   - Automated testing script
   - Troubleshooting guide

4. **Test Script Contents**:
   - Bash script for automated testing
   - Tests key scenarios
   - Reports pass/fail results
   - Exit code 0 for success, 1 for failure

### Acceptance Criteria

- [ ] File `tests/function-test-cases.md` exists
- [ ] Contains setup instructions
- [ ] Contains KVS test data setup
- [ ] Has 8 test categories
- [ ] Category 1: 5+ wildcard tests
- [ ] Category 2: 4+ exact redirect tests
- [ ] Category 3: 2+ not found tests
- [ ] Category 4: 7+ security validation tests
- [ ] Category 5: 2+ path length tests
- [ ] Category 6: 7+ edge case tests
- [ ] Category 7: 2+ query parameter tests
- [ ] Category 8: 2+ HTTP method tests
- [ ] Each test has all required fields
- [ ] All curl commands are syntactically correct
- [ ] Test execution checklist present
- [ ] Automated test script included in documentation
- [ ] File `tests/run-tests.sh` exists
- [ ] Test script is executable
- [ ] Test script is valid bash
- [ ] File is valid markdown

### Testing Instructions

Run these commands:
```bash
# Check files exist
ls -l tests/function-test-cases.md
ls -l tests/run-tests.sh

# Count test cases (should be 30+)
grep "^#### Test" tests/function-test-cases.md | wc -l

# Verify test script is executable
test -x tests/run-tests.sh && echo "Executable" || echo "Not executable"

# Validate bash syntax of test script
bash -n tests/run-tests.sh

# Verify each test has curl command
grep -c "curl -I" tests/function-test-cases.md

# Check markdown structure
grep "^##" tests/function-test-cases.md | head -10
```

All commands must succeed.

### Notes for Next Task
This is the final task. The project is complete with:
- CloudFormation template
- CloudFront Function code
- Deployment script
- Complete documentation
- Comprehensive test cases

The next step for any engineer would be to:
1. Run the deployment script
2. Configure DNS
3. Populate KVS with redirects
4. Run the test cases to verify functionality

---

## Summary

These 11 tasks completely implement the zzip.to redirect service:

1. **Task 1**: Project structure setup
2. **Task 2**: CloudFormation parameters
3. **Task 3**: KeyValueStore resource
4. **Task 4**: CloudFront Function code
5. **Task 5**: CloudFront Function resource
6. **Task 6**: AWS WAF resource
7. **Task 7**: CloudFront Distribution resource
8. **Task 8**: S3 logging bucket resource
9. **Task 9**: README documentation
10. **Task 10**: Deployment automation script
11. **Task 11**: Test cases documentation

Each task is explicit, self-contained, and provides everything needed for a junior engineer to complete it successfully without making assumptions.