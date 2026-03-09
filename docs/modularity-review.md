# Modularity Review

**Scope**: Full codebase — CloudFront redirect function, CRUD Lambdas, KVS Sync Lambda, Pre-Auth Lambda, React Admin UI, CloudFormation infrastructure
**Date**: 2026-03-09

## Coupling Overview Table

| Integration | Strength | Distance | Volatility | Balanced? |
|---|---|---|---|---|
| `functions/redirect.js` ↔ `template.yaml` (inline FunctionCode) | Functional (duplicated code) | Low (same repo, same person) | Low | No — low strength needed, low distance = low cohesion risk. But the duplication itself is the hazard. |
| UI `AddLinkDialog` ↔ `CreateLink` Lambda (validation rules) | Functional (duplicated business rules) | High (separate deployable, different runtime) | Low | No — high strength + high distance, but neutralized by low volatility |
| Wildcard convention (`/*`) across CloudFront fn, CreateLink Lambda, UI | Functional (implicit shared knowledge) | High (3 components, 2 runtimes, edge + regional + browser) | Low | No — high strength + high distance, but neutralized by low volatility |
| KVS Sync Lambda → DynamoDB item schema | Model (shared `{key, value}` structure) | Medium (same service boundary, async via Streams) | Low | Yes — moderate strength, moderate distance |
| CRUD Lambdas → DynamoDB | Model (shared `{key, value}` structure) | Low (same CloudFormation stack, same IAM role) | Low | Yes |
| UI → API Gateway (REST) | Contract (HTTP REST endpoints, JSON) | High (separate deployable, browser ↔ cloud) | Low | Yes — low strength, high distance |
| Pre-Auth Lambda ↔ Cognito | Contract (event structure) | Low (same stack, Cognito trigger) | Low | Yes |
| CRUD Lambdas inline in CloudFormation | N/A (co-location) | Low (same file) | Low | See discussion below |

## Issue: Duplicated Redirect Function Code

**Integration**: `functions/redirect.js` ↔ `cloudformation/template.yaml` (lines 79–204)
**Severity**: Significant

### Knowledge Leakage

The entire redirect function — `validatePath`, `parsePath`, `buildQueryString`, `buildRedirectUrl`, `redirect301`, `notFound`, and `handler` — exists in two places:

1. `functions/redirect.js` — used by tests (via `tests/redirect.test.js`)
2. `cloudformation/template.yaml` FunctionCode — the actually deployed version

These are **independent copies** with no mechanism to ensure they stay in sync. The only difference is the KVS ID initialization (`'KVS_ARN_PLACEHOLDER'` vs `'${RedirectKVS.Id}'`). This is **functional coupling** in its most dangerous form: duplicated implementation with no explicit integration point. A developer who modifies `functions/redirect.js` may believe they've changed the redirect behavior, but the deployed code in `template.yaml` remains unchanged (and vice versa).

### Complexity Impact

When modifying redirect logic, a developer must remember to update both files manually. The tests exercise `functions/redirect.js`, not the CloudFormation inline code. This means tests can pass while the deployed function has a bug (or lacks the fix). The cause-and-effect relationship is hidden: "I changed the code and the tests pass, but production still behaves incorrectly."

### Cascading Changes

Every change to the redirect logic requires editing two files. Examples:
- Adding a new redirect type (e.g., temporary 302 redirects)
- Modifying path validation rules
- Changing cache headers
- Fixing a bug in wildcard URL construction

If either copy drifts, the test suite provides false confidence.

### Recommended Improvement

Extract the redirect function to a single source file and generate or inject it into the CloudFormation template during deployment. Options:

1. **Build step**: The `deploy.sh` script reads `functions/redirect.js`, substitutes the KVS placeholder with the CloudFormation `!Sub` reference, and injects it into the template before deployment. Tests continue to run against the source file.
2. **Template include**: Use a CloudFormation macro or pre-processor that `!Include`s the function code from the file.

**Trade-off**: Adds a build step to the deployment pipeline. Worth it because it eliminates a silent failure mode where tests and production diverge.

---

## Issue: Duplicated Validation Rules (Wildcard Convention)

**Integration**: UI `AddLinkDialog.tsx` ↔ `CreateLink` Lambda (inline in `template.yaml`) ↔ CloudFront redirect function
**Severity**: Minor

### Knowledge Leakage

Three components independently implement knowledge of the wildcard redirect convention (`/*` suffix) and the link validation rules:

| Rule | UI (`AddLinkDialog.tsx`) | CreateLink Lambda (`template.yaml:574`) | CloudFront Function (`redirect.js:102,204`) |
|---|---|---|---|
| Key pattern | `/^[a-zA-Z0-9_-]+$/` | `/^[a-zA-Z0-9_-]+$/` | N/A (path validation instead) |
| Key max length | 128 | 128 | N/A |
| URL pattern | `/^https?:\/\/[a-zA-Z0-9]...$/` | `/^https?:\/\/[a-zA-Z0-9]...$/` | N/A |
| URL max length | 1024 | 1024 | N/A |
| Wildcard strip | `value.endsWith('/*') ? value.slice(0, -2) : value` | `value.endsWith('/*') ? value.slice(0, -2) : value` | `target.endsWith('/*')` |

The wildcard convention (`/*` suffix means "append path") is **implicit shared knowledge**. It is not defined in a contract or schema — each component independently parses and interprets the `/*` suffix.

### Complexity Impact

If the wildcard convention changes (e.g., switching from `/*` to a separate `type` field in DynamoDB), three components across two runtimes must be updated simultaneously. The functional coupling is implicit: there's no import, no shared type, no contract that makes the dependency visible.

### Cascading Changes

- Changing the wildcard convention requires updating the CloudFront function, the CreateLink Lambda validation, and the UI form validation
- Adding a new redirect type (e.g., regex-based) would touch all three
- Changing validation rules (e.g., allowing query parameters in stored URLs) requires syncing the regex in both UI and Lambda

### Recommended Improvement

Given the low volatility of this personal tool, this is acceptable technical debt. If the redirect model were to evolve:

1. The **backend Lambda validation is authoritative** — the UI validation is a UX convenience. This asymmetry is fine and expected.
2. If new redirect types are added, consider storing the redirect type explicitly in DynamoDB (e.g., `{ key, value, type: "exact"|"wildcard" }`) rather than encoding it in the value string. This would make the convention explicit rather than implicit.

**Trade-off**: Adding explicit typing adds schema complexity for a convention that works today. Only worth doing if the redirect model actually needs to evolve.

---

## Issue: CRUD Lambda Code Inline in CloudFormation

**Integration**: Application logic (ListLinks, CreateLink, DeleteLink Lambdas) embedded in `cloudformation/template.yaml`
**Severity**: Minor

### Knowledge Leakage

Three Lambda functions containing application logic (validation, DynamoDB queries, error handling) are defined as inline `ZipFile` code within the CloudFormation infrastructure template. This co-locates application concerns with infrastructure concerns in a single 958-line file.

### Complexity Impact

The template.yaml file serves dual purposes: infrastructure definition and application code host. A developer modifying CORS headers must navigate the same file as someone modifying DynamoDB table settings. The cognitive load of the file increases because it mixes two distinct concerns.

Unlike the redirect function (which has a separate testable copy), the CRUD Lambda code exists **only** in the CloudFormation template. The test file (`tests/crud-lambdas.test.js`) extracts and evaluates this code, but the code itself isn't independently maintainable.

### Cascading Changes

- Adding a new API endpoint requires editing both the infrastructure (API Gateway resource, method, permission) and the application code (new Lambda) in the same file
- Modifying validation logic requires editing YAML-embedded JavaScript

### Recommended Improvement

For a project of this size and volatility, inline Lambdas are a pragmatic choice that avoids the overhead of separate packaging. This is **not urgent**. If the CRUD logic grows more complex, extract the Lambda code to separate files (like the KVS sync Lambda already is) and reference them via `S3Bucket`/`S3Key` or a local packaging step.

**Trade-off**: Extraction adds deployment complexity (packaging, S3 upload). The current approach is simpler. Only extract if the Lambda code grows beyond simple CRUD.

---

## Summary

This is a well-structured project for its scope. The system's overall low volatility (personal URL shortener, generic subdomain) means that the identified coupling imbalances are unlikely to cause active pain. The most actionable issue is the **duplicated redirect function code**, which creates a silent failure mode where tests and production can diverge — this is worth fixing regardless of volatility because it undermines test reliability.

The validation rule duplication and inline Lambda code are standard pragmatic trade-offs for a single-person, low-volatility project. They would become more significant if the system's scope expanded (e.g., multi-tenant, additional redirect types, team growth).
