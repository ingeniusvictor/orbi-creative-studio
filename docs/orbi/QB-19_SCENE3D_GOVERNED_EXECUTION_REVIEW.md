# QB-19 — Scene3D Governed Execution Review

Status: **IMPLEMENTATION CANDIDATE — DRY-RUN REVIEW REQUIRED**

## Dependency chain

QB-19 v2 is rebuilt on QB-18 v2 and inherits the QB-12 → QB-18 dependency chain.

It must not be merged independently while those dependencies remain uncertified/unmerged.

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

The returned renderer-safe review contains:

- token,
- recipe id,
- execution fingerprint,
- recipe code SHA-256 when available,
- expiry,
- oneShot=true.

## Execution request contract

Every execution request now requires:

```text
recipeId
parameters
confirmed: true
reviewToken
```

This applies to all side-effecting recipes, not only delete.

The review token is:

- validated in Electron main,
- consumed before provider dispatch,
- never forwarded to the sidecar,
- unusable a second time.

## Fail-closed mismatch behavior

If the reviewed payload and requested execution differ:

```text
SCENE3D_REVIEW_MISMATCH
```

The token is consumed even on mismatch.

This prevents probing/mutation attempts from preserving a capability for later reuse.

Expired/already-used/missing review:

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

Invalid object names and invalid dry-run recipe requests are also rejected before sidecar startup.

## Renderer authority

Renderer may carry the opaque review token back to Electron main but cannot:

- generate valid review tokens,
- choose fingerprints,
- change TTL,
- bypass confirmation,
- reuse consumed tokens,
- send token to QB-15 directly,
- retry R2 automatically.

## Tests

New/updated tests cover:

- deterministic review fingerprint,
- payload-change fingerprint divergence,
- JSON canonicalization restrictions,
- successful provider-free dry-run requirement,
- bounded token issuance,
- TTL expiry,
- one-shot consumption,
- mismatch consumption,
- review capacity,
- invalidate-all,
- execution policy requiring confirmation + review token,
- dry-run response issuing review,
- review token never forwarded to sidecar,
- missing/mismatched review preventing dispatch,
- real registry dry-run→execute binding,
- malformed requests rejected before sidecar startup,
- shutdown invalidating review capabilities.

## Production boundary

QB-19 adds no execution UI.

It does not:

- enable execution by default,
- add direct execute buttons,
- change recipe allowlist,
- authorize reconciliation mutation,
- change Compute Router authority,
- enable MHS actuation,
- authorize production cutover.

## Next recommended phase

**QB-20 — Scene3D Execution Review UI**

The UI may then expose a controlled form that:

- produces a dry-run first,
- displays recipe/fingerprint/code-hash evidence,
- invalidates local review state on input changes,
- requires explicit confirmation,
- executes only with the main-issued review token,
- clears the token after every execution attempt,
- directs uncertain outcomes to recovery inspection rather than retry.

**QB-19 v2 status: IMPLEMENTATION CANDIDATE — review-bound execution enforced in Electron main.**


## Rebuild note

The earlier QB-19 branch was based on the superseded QB-18 lineage. This v2 branch starts from
QB-18 v2 so all current Scene3D launch, environment, renderer-sanitization, diagnostics, and
execution-authority hardening is inherited before adding review-bound execution.

No canonical branch is modified by this candidate.
