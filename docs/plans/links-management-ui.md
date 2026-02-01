# Links Management UI

## Overview
- Build a full-stack admin UI for managing zzip.to redirect links (CRUD operations)
- Backend: API Gateway REST API + Cognito auth (whitelisted emails only) + Lambda handlers + DynamoDB + KVS sync
- Frontend: React 19 + Vite + TypeScript + Radix UI primitives + CSS modules
- Replaces manual `data/redirects.json` editing and `populate-kvs.sh` script with a web interface

## Context (from discovery)
- Files/components involved: `cloudformation/template.yaml`, new `ui/` source tree, new Lambda handler code
- Current state: CloudFormation has redirect service only (CloudFront, KVS, WAF, Route 53). No API/auth resources exist.
- Git history shows a previous implementation (US-001 through US-013) that was removed — we'll use a similar architecture but build fresh
- DynamoDB `LinksTable` is NOT in the current template (needs to be added)
- The `ui/` directory has node_modules and a stale dist/ but no source code — start fresh
- Data model: `{ key: string, value: string }` where value may end with `/*` for wildcard redirects

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** — no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility with existing redirect service

## Testing Strategy
- **Unit tests**: Required for every task — Lambda handlers, React components, utility functions
- **Frontend tests**: Vitest + React Testing Library for component testing
- **Backend tests**: Node.js test runner (matching existing project convention in `tests/`)
- **E2E tests**: Not in scope for initial implementation

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Add Cognito User Pool to CloudFormation
- [x] Add `AllowedEmails` parameter (comma-separated list of whitelisted email addresses)
- [x] Add `CognitoUserPool` resource with email as username/alias, password policy, and self-signup disabled
- [x] Add `CognitoUserPoolClient` resource (no secret, explicit auth flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`)
- [x] Add `CognitoDomain` resource for hosted UI (`${Environment}-zzip-to`)
- [x] Add `PreAuthLambdaRole` IAM role with basic Lambda execution permissions
- [x] Add `PreAuthLambda` function (inline Node.js 20.x) that checks `event.request.userAttributes.email` against the whitelisted emails parameter
- [x] Add `PreAuthLambdaPermission` to allow Cognito to invoke the Lambda
- [x] Wire pre-auth Lambda as `PreAuthentication` trigger on the User Pool
- [x] Add outputs: `UserPoolId`, `UserPoolClientId`, `CognitoDomain`
- [x] Validate template with `aws cloudformation validate-template`
- [x] Write tests for pre-auth Lambda logic (allowed email passes, disallowed email rejected)
- [x] Run existing tests — must pass before next task

### Task 2: Add DynamoDB table and API Gateway to CloudFormation
- [x] Add `LinksTable` DynamoDB resource (PAY_PER_REQUEST, hash key `key` of type String)
- [x] Add `ApiGateway` REST API resource
- [x] Add `CognitoAuthorizer` on the API Gateway referencing the User Pool
- [x] Add API resources: `/links` and `/links/{key}`
- [x] Add `OPTIONS` methods on both resources with mock integration for CORS preflight
- [x] Add `AdminDomainName` parameter (default: `admin.zzip.to`) for CORS origin
- [x] Add `LambdaExecutionRole` IAM role with DynamoDB permissions (Scan, GetItem, PutItem, DeleteItem) and CloudWatch Logs
- [x] Add outputs: `ApiEndpoint`, `LinksTableName`
- [x] Validate template
- [x] Run existing tests — must pass before next task

### Task 3: Add Lambda CRUD handlers to CloudFormation
- [x] Add `ListLinksFunction` Lambda (GET /links) — scans DynamoDB, returns sorted JSON array
- [x] Add `CreateLinkFunction` Lambda (PUT /links/{key}) — validates input, puts item in DynamoDB
- [x] Add `DeleteLinkFunction` Lambda (DELETE /links/{key}) — deletes item from DynamoDB
- [x] Wire each Lambda to its API Gateway method with Cognito authorizer and proxy integration
- [x] Add Lambda permissions for API Gateway invocation
- [x] Add CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`) in all Lambda responses
- [x] Add `ApiDeployment` and `ApiStage` resources
- [x] Validate template
- [x] Write tests for each Lambda handler (success cases, error cases, input validation)
- [x] Run all tests — must pass before next task

### Task 4: Add KVS sync Lambda
- [x] Enable DynamoDB Streams on `LinksTable` (NEW_AND_OLD_IMAGES)
- [x] Add `KvsSyncRole` IAM role with DynamoDB Streams read + CloudFront KVS write permissions
- [x] Add `KvsSyncFunction` Lambda triggered by DynamoDB Stream — handles INSERT/MODIFY (put key in KVS) and REMOVE (delete key from KVS)
- [x] Add `EventSourceMapping` to wire DynamoDB Stream to Lambda
- [x] Validate template
- [x] Write tests for KVS sync Lambda logic (insert, update, delete events)
- [x] Run all tests — must pass before next task

### Task 5: Scaffold React UI project
- [x] Clean out existing `ui/` directory (remove stale dist/, node_modules/, keep nothing)
- [x] Initialize new Vite + React + TypeScript project in `ui/`
- [x] Install dependencies: `react`, `react-dom`, `react-router-dom`, `aws-amplify`, `@radix-ui/themes`, `zod`
- [x] Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `typescript`, `@types/react`, `@types/react-dom`
- [x] Configure `vite.config.ts` with React plugin
- [x] Configure `tsconfig.json`
- [x] Configure `vitest` in vite config (jsdom environment)
- [x] Create `src/main.tsx` entry point, `src/App.tsx` shell with React Router
- [x] Add `.env.example` with required vars: `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION`, `VITE_API_ENDPOINT`
- [x] Add `ui/` to project `.gitignore` node_modules, update as needed
- [x] Verify `npm run dev` starts and `npm run build` succeeds
- [x] Write a smoke test (App renders without crashing)
- [x] Run tests — must pass before next task

### Task 6: Implement authentication flow
- [x] Create `src/lib/amplify.ts` — configure Amplify with env vars (User Pool only, no Identity Pool)
- [x] Create `src/contexts/AuthContext.tsx` — React context providing `user`, `isAuthenticated`, `isLoading`, `signIn()`, `signOut()`
- [x] Create `src/components/LoginPage.tsx` — email/password form using Radix UI components (Dialog, TextField, Button)
- [x] Create `src/components/LoginPage.module.css` — styles for login page
- [x] Create `src/components/ProtectedRoute.tsx` — redirects to login if not authenticated
- [x] Wire auth context in `App.tsx`, protect main routes
- [x] Write tests for AuthContext (mock Amplify calls, test sign-in/sign-out state transitions)
- [x] Write tests for LoginPage (renders form, handles submission, shows errors)
- [x] Run tests — must pass before next task

### Task 7: Build redirect management UI
- [x] Create `src/lib/api.ts` — API client with auth token injection: `listLinks()`, `createLink(key, value)`, `deleteLink(key)`
- [x] Create `src/components/LinksPage.tsx` — main page with links table and add/delete actions
- [x] Create `src/components/LinksPage.module.css` — table and page layout styles
- [x] Create `src/components/AddLinkDialog.tsx` — Radix Dialog with form fields for key and target URL, Zod validation (key: alphanumeric + hyphens, value: valid URL)
- [x] Create `src/components/AddLinkDialog.module.css` — dialog styles
- [x] Create `src/components/DeleteConfirmDialog.tsx` — Radix AlertDialog for delete confirmation
- [x] Create `src/components/Layout.tsx` — app shell with header (showing user email, sign-out button) and main content area
- [x] Create `src/components/Layout.module.css` — layout styles
- [x] Wire routes in `App.tsx`: `/` → LinksPage (protected), `/login` → LoginPage
- [x] Write tests for api.ts (mock fetch, verify auth header, test error handling)
- [x] Write tests for LinksPage (renders table, add/delete flows)
- [x] Write tests for AddLinkDialog (validation, submission)
- [x] Run tests — must pass before next task

### Task 8: Add UI hosting to CloudFormation
- [x] Add `AdminBucket` S3 bucket for UI static files (block public access)
- [x] Add `AdminBucketPolicy` allowing CloudFront OAC to read from bucket
- [x] Add `AdminDistribution` CloudFront distribution for `admin.${DomainName}` with S3 origin, OAC, and SPA routing (custom error response 403→/index.html)
- [x] Add `AdminDNSRecordA` and `AdminDNSRecordAAAA` Route 53 records pointing to admin distribution
- [x] Add output: `AdminDistributionId`, `AdminBucketName`
- [x] Add `scripts/deploy-ui.sh` — builds UI and syncs to S3, invalidates CloudFront cache
- [x] Validate template
- [x] Run all tests — must pass before next task

### Task 9: Seed DynamoDB from existing redirects.json
- [x] Create `scripts/seed-dynamodb.sh` — reads `data/redirects.json` and batch-writes items to DynamoDB LinksTable
- [x] Document in script that this is a one-time migration from file-based to DB-based management
- [x] Write test for seed script logic (parse JSON, generate correct DynamoDB items)
- [x] Run all tests — must pass before next task

### Task 10: Verify acceptance criteria
- [x] Verify all CloudFormation resources are correctly defined and template validates
- [x] Verify CORS is correctly configured end-to-end (preflight + response headers)
- [x] Verify pre-auth Lambda rejects non-whitelisted emails
- [x] Verify KVS sync handles all DynamoDB stream event types (INSERT, MODIFY, REMOVE)
- [x] Run full backend test suite
- [x] Run full frontend test suite (`npm test` in ui/)
- [x] Run linter — all issues must be fixed
- [x] Verify all wildcard redirect patterns still work after migration

### Task 11: [Final] Update documentation
- [x] Update README.md with admin UI setup instructions (Cognito user creation, env vars, deployment)
- [x] Update IMPORTANT.md with new constraints discovered during implementation
- [x] Document the DynamoDB → KVS sync architecture

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`*

## Technical Details

### Data Model
```json
// DynamoDB LinksTable
{ "key": "gh", "value": "https://github.com/*" }
{ "key": "aws", "value": "https://console.aws.amazon.com" }
```
- `key` (String, hash key): short link slug (alphanumeric + hyphens)
- `value` (String): target URL, optionally ending with `/*` for wildcard redirects

### API Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /links | List all redirects | Cognito |
| PUT | /links/{key} | Create/update a redirect | Cognito |
| DELETE | /links/{key} | Delete a redirect | Cognito |
| OPTIONS | /links, /links/{key} | CORS preflight | None |

### KVS Sync Flow
```
UI → API Gateway → Lambda → DynamoDB (write)
                                ↓ (Stream)
                         KVS Sync Lambda → CloudFront KVS (update)
                                ↓
                         Edge redirect function reads from KVS
```

### Auth Flow
```
User → admin.zzip.to → Login form → Cognito (SRP auth)
                                        ↓
                                  Pre-auth Lambda validates email whitelist
                                        ↓
                                  JWT token → API Gateway (Cognito authorizer)
```

### Frontend Structure
```
ui/src/
├── main.tsx                    # Entry point, Amplify config
├── App.tsx                     # Router setup
├── lib/
│   ├── amplify.ts              # Amplify configuration
│   └── api.ts                  # API client (fetch + auth token)
├── contexts/
│   └── AuthContext.tsx          # Auth state management
└── components/
    ├── Layout.tsx + .module.css
    ├── LoginPage.tsx + .module.css
    ├── ProtectedRoute.tsx
    ├── LinksPage.tsx + .module.css
    ├── AddLinkDialog.tsx + .module.css
    └── DeleteConfirmDialog.tsx
```

## Post-Completion

**Manual verification:**
- Create a Cognito user via AWS CLI: `aws cognito-idp admin-create-user`
- Deploy full stack and verify login → list → add → delete flow
- Verify KVS sync by checking redirect works after adding via UI
- Test that non-whitelisted email is rejected at login

**Deployment steps:**
1. Deploy CloudFormation stack (adds Cognito, API Gateway, Lambda, DynamoDB)
2. Run `scripts/seed-dynamodb.sh` to migrate existing redirects from JSON to DynamoDB
3. Build and deploy UI: `scripts/deploy-ui.sh`
4. Create initial admin user in Cognito
5. Verify at `https://admin.zzip.to`

**CI/CD updates needed:**
- GitHub Actions workflow may need updating — currently pushes `data/redirects.json` to KVS directly; after migration, KVS is synced via DynamoDB Streams instead
- Consider adding UI build + deploy to CI/CD pipeline
