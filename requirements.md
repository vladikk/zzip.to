zzip.to Redirect Service — Serving Architecture (v2)

Audience: Junior backend / cloud developer
Scope: Request serving only (redirect resolution at runtime)
Out of scope: Link creation, admin APIs, source-of-truth database, sync jobs

⸻

Goal

Serve short links like:
	•	https://zzip.to/gh
	•	https://zzip.to/gh/vladikk

and respond with a fast HTTP redirect (301 or 307), using edge infrastructure only:
	•	no servers
	•	no Lambda
	•	no API Gateway

⸻

High-level architecture

Client
  ↓
CloudFront (zzip.to)
  ↓
AWS WAF
  ↓
CloudFront Function
  ↓
CloudFront KeyValueStore
  ↓
HTTP Redirect (301 / 307)


⸻

0. Infrastructure as code
Use AWS Cloudformation written in YAML to generate the resources.
The cloudformation should include a variable for environment (prod, test, dev) and prefix the resources both with environment type and name of the stack.

Components

1. Route 53
	•	DNS record zzip.to points to CloudFront.

⸻

2. CloudFront Distribution
	•	Terminates HTTPS.
	•	Entry point for all requests.
	•	No origin is required for successful redirects.

⸻

3. AWS WAF (attached to CloudFront)

Purpose:
	•	Protect against abusive traffic.
	•	Limit cost during DDoS or bot attacks.

Minimum rules:
	•	Rate limiting per IP.
	•	AWS managed common rules.

⸻

4. CloudFront KeyValueStore (KVS)
	•	Global, read-optimized key → value store.
	•	Used only for lookup, not writes.

Data model (serving side):

Key	Value
gh	https://github.com/*
docs	https://docs.example.com

Notes:
	•	Value ending with /* means wildcard (prefix) redirect
	•	Value without /* means exact redirect

⸻

5. CloudFront Function (Viewer Request)
	•	JavaScript executed at the edge.
	•	Very small and fast.

Responsibilities:
	•	Parse request path.
	•	Extract key and optional rest.
	•	Fetch redirect target from KVS.
	•	Build final redirect URL.
	•	Return HTTP redirect response.

⸻

Redirect rules

Path parsing

Request path format:

/{key}
/{key}/{rest...}

Examples:
	•	/gh
	•	/gh/vladikk
	•	/gh/vladikk/repos

key is always the first path segment.

⸻

Redirect behavior

Case 1: Exact redirect
KVS:

docs → https://docs.example.com

Requests:
	•	/docs → https://docs.example.com
	•	/docs/a/b → 404 (recommended)

⸻

Case 2: Wildcard (prefix) redirect
KVS:

gh → https://github.com/*

Requests:
	•	/gh → https://github.com/
	•	/gh/vladikk → https://github.com/vladikk
	•	/gh/vladikk/repos → https://github.com/vladikk/repos

Rule:
	•	Remove /* from value.
	•	Append everything after /{key}.
	•	Preserve original query string.

⸻

Query strings

Always preserved.

Example:

/gh/vladikk?tab=repos
→ https://github.com/vladikk?tab=repos


⸻

Serving algorithm (simplified)
	1.	Read request path.
	2.	Split path:
	•	key
	•	optional rest
	3.	target = kvs.get(key)
	•	if not found → return 404
	4.	If target ends with /*:
	•	remove /*
	•	append rest (if present)
	5.	Else:
	•	use target as-is
	•	if rest exists → return 404
	6.	Append query string (if any).
	7.	Return 301 or 307 with Location header.

⸻

Validation rules (important)

Apply before KVS lookup:
	•	Allowed characters: A–Z a–z 0–9 _ - /
	•	Max path length (example): 256 chars
	•	Reject paths containing:
	•	..
	•	encoded slashes
	•	empty segments like //

Invalid requests → 404

⸻

HTTP status codes
	•	301 – permanent redirect (default)
	•	307 – temporary redirect (method-preserving)

Do not use 302.

⸻

Failure behavior
	•	Key not found → 404
	•	Invalid path → 404
	•	KVS update delay → temporary 404s possible (eventual consistency)

This is acceptable for a redirect service.

⸻

Observability

Enable:
	•	CloudFront access logs
	•	WAF logs

Monitor:
	•	Request count
	•	4xx rate
	•	WAF blocks / rate limits
	•	Top requested paths

⸻

Summary
	•	CloudFront + Function + KVS serves redirects at the edge.
	•	Wildcard support is controlled by /* in the stored value.
	•	No origin, no Lambda, low latency, low cost.
	•	Strict rules keep behavior predictable and safe.

⸻

Next step (separate document): link management and syncing into KeyValueStore.