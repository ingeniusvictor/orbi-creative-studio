# QB-19 — Scene3D Governed Execution Review

Status: **IMPLEMENTATION CANDIDATE — DRY-RUN REVIEW REQUIRED**

## Dependency chain

QB-19 v3 is rebuilt cleanly on the certified QB-18 canonical head:

```text
da4fbb029440a2db4301b5f26b5b9f909f464756
```

It inherits the fully certified QB-12 → QB-18 chain.

## Purpose

QB-19 makes a successful reviewed dry-run a technical prerequisite for every Scene3D side effect.

Execution authority being ON is necessary but no longer sufficient.

Required sequence:

```text
execution authority ON
        ↓
dryRunRecipe
        ↓
main-owned one-shot review token
        ↓
explicit product confirmation
        ↓
executeRecipe with identical payload + token
        ↓
token consumed before sidecar execution
```

## Main-owned review registry

Implementation:

```text
electron/lib/scene3dExecutionReview.js
```

Properties:

- deterministic SHA-256 execution fingerprint,
- canonical JSON key ordering,
- rejects non-finite/non-JSON values,
- one-shot capability tokens,
- default 5-minute TTL,
- bounded outstanding review capacity,
- shutdown invalidates all outstanding tokens.

## Fingerprint

The reviewed fingerprint is derived from exactly:

```text
recipeId
parameters
```

Changing any execution parameter after dry-run invalidates the review.

The token itself is not sent to Python/QB-15.

## Dry-run issuance

A review token is issued only when the sanitized dry-run response proves:

```text
ok = true
data.execution = dry-run
data.providerCalled = false
```

The renderer-safe review contains:

- token,
- recipe id,
- execution fingerprint,
- recipe code SHA-256 when available,
- expiry,
- `oneShot=true`.

## Execution request contract

Every execution request requires:

```text
recipeId
parameters
confirmed: true
reviewToken
```

This applies to all side-effecting recipes, not only delete.

The review token is validated and consumed in Electron main before provider dispatch and is never forwarded to the sidecar.

## Fail-closed mismatch behavior

Payload mismatch returns:

```text
SCENE3D_REVIEW_MISMATCH
```

The token is consumed even on mismatch.

Expired/already-used/missing review returns a sanitized review error such as:

```text
SCENE3D_REVIEW_REQUIRED
SCENE3D_REVIEW_EXPIRED
```

## Pre-spawn enforcement

Validation order is:

1. pilot enabled,
2. execution authority enabled,
3. product request validation,
4. review token consume + fingerprint match,
5. only then create/use sidecar client,
6. only then send execute request.

Malformed object names and invalid dry-run recipe requests are rejected before sidecar startup.

## Inherited hardening

QB-19 v3 preserves the certified QB-16 → QB-18 protections:

- platform-deterministic native paths,
- lazy/injectable Electron dependencies,
- trusted WSL launcher,
- `shell:false`,
- child-environment allowlisting,
- provider-secret/PATH stripping,
- fail-closed sidecar protocol,
- renderer sanitization,
- read-only diagnostics,
- execution authority default OFF,
- pre-spawn execution denial,
- automatic R2 retry disabled.

## Renderer authority

The renderer may carry the opaque review token back to Electron main but cannot:

- mint valid review tokens,
- choose fingerprints,
- alter TTL,
- bypass confirmation,
- reuse consumed tokens,
- send review tokens to QB-15,
- enable execution authority,
- retry R2 automatically,
- mutate reconciliation state.

## Validation

Certified QB-18 accumulated gate:

```text
68 tests
```

QB-19 v3 accumulated declared gate:

```text
84 tests
```

Net QB-19 coverage increase:

```text
16 tests
```

Expected focused accumulated result:

```text
tests 84
pass 84
fail 0
```

## Production boundary

QB-19 adds no execution UI and does not:

- enable execution by default,
- add direct execute buttons,
- change recipe allowlist,
- authorize reconciliation mutation,
- change Compute Router authority,
- enable MHS actuation,
- authorize production cutover.

## Next phase

**QB-20 — Scene3D Execution Review UI**

Only after QB-19 certification may a renderer UI expose the controlled review flow.

## Rebuild note

The previous QB-19 v2 branch inherited a superseded QB-18 lineage. QB-19 v3 was rebuilt from the formally certified QB-18 canonical head and contains only the governed-review delta while preserving the final QB-16/QB-17/QB-18 hardening.

**QB-19 v3 status: IMPLEMENTATION CANDIDATE — review-bound execution enforced in Electron main.**
