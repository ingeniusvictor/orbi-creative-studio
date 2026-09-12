# ORBI Creative Studio — MuAPI Passive Health P1B.6

Status: readiness evidence only. No active health request and no routing authority.

## Why

P1B.4 intentionally leaves MuAPI transport health unknown because secure credential presence alone is not proof that the cloud transport is usable.

P1B.6 adds a conservative source of real evidence without adding a probe request, consuming credits, or changing the request payload.

## Passive observation

The existing trusted main-process MuAPI transport records only the result of traffic that the Studio already performs.

Fresh observations:

- successful 2xx response → `{ ok: true }`;
- 401 / 403 → `{ ok: false }`;
- 5xx → `{ ok: false }`;
- escaped network error → `{ ok: false }`.

Request-specific 4xx outcomes such as 400, 404, 422 and 429 do not prove transport failure, so they do not create negative evidence.

Local failures such as invalid paths, oversized bodies, missing credentials, secure-storage failures, or corrupt local credential storage are not classified as network health.

## Freshness

Evidence expires after five minutes. Once stale, readiness returns to unknown until existing Studio traffic supplies a new observation.

The renderer receives only:

```json
{ "ok": true }
```

or

```json
{ "ok": false }
```

No status code, timestamp, URL, error text, API key, secure-storage backend, or other transport metadata crosses the readiness bridge.

## Execution invariants

This change adds:

- no timer;
- no ping;
- no HEAD/GET health request;
- no new MuAPI endpoint;
- no retry;
- no generation call;
- no automatic cloud fallback.

The original authenticated request/upload still executes exactly once and returns the same result/error. Observation happens after that existing outcome.

## Router consequence

After a recent successful legacy MuAPI call, P1B.3 can truthfully compose `muapi-cloud.health = ready` for shadow parity.

Before any successful traffic, or after evidence expires, health remains `unknown` and the router continues to fail closed.
