# ORBI Creative Studio — Phase 1B.6 MuAPI Readiness Health

Status: stacked on P1B.5. Readiness-only network probe; no generation cutover.

## Purpose

Provide explicit MuAPI transport/service evidence so Compute Router does not infer cloud readiness from the mere presence of a stored API key.

MuAPI's documented account endpoint is used as a bounded authenticated readiness probe:

`GET https://api.muapi.ai/api/v1/account/balance`

This endpoint is non-generative. ORBI does not consume or expose the returned account body for routing.

## Main-process boundary

`electron/lib/muapiHealthProbe.js`:

- reads the MuAPI key only through the existing secure provider secret store;
- sends the key only in the documented `x-api-key` header;
- uses a fixed origin and fixed path;
- uses GET only;
- has a 5 second timeout;
- caches readiness evidence for 30 seconds;
- coalesces concurrent probes;
- discards/cancels the response body;
- returns only `{ ok, status }`;
- never returns the API key, balance, response body, or transport error detail.

## Probe eligibility

The readiness bridge probes MuAPI only when credential readiness says:

- secure storage is available;
- backend is accepted as secure;
- a secret exists;
- the store is not corrupt.

Otherwise MuAPI transport health remains absent and no readiness network request is made.

## Health mapping

- successful authenticated response → `ready`;
- HTTP 401/403 → `misconfigured` (credential is present but rejected);
- network/transport failure → `offline`;
- no probe evidence → `unknown`.

Credential presence remains a separate fact from transport health.

## Snapshot privacy

P1B.6 extends the P1B.4 snapshot with only:

```json
{
  "muapi": {
    "transportHealth": {
      "ok": true,
      "status": 200
    }
  }
}
```

Fields such as balance, raw body, API key, ciphertext, secure-storage backend, or error text are not included.

## Studio behavior

This phase still does not change generation dispatch:

- no change to ImageStudio generation calls;
- no change to VideoStudio generation calls;
- no automatic provider fallback;
- no generation is used as a health check.

P1B.5 shadow parity can consume this signal and report `muapi-cloud` readiness without becoming the executor.

## Merge gate

Keep stacked until P1B.3–P1B.5 are certified and merged.

Do not merge while GitHub Actions is terminating before runner assignment without steps/logs.
