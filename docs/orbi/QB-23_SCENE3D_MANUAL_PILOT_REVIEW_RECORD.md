# QB-23 — Scene3D Manual Pilot Review Record

Status: **IMPLEMENTATION CANDIDATE — REVIEW RECORD ONLY**

## Purpose

QB-23 records an explicit human review decision against the deterministic QB-22 readiness evidence.

It is intentionally non-authoritative.

An approval means only:

```text
manualPilotReviewApproved = true
```

It never means:

```text
featureEnableAuthorized = true
productionCutoverAuthorized = true
```

Both remain false by construction.

## Input

A review record must include:

- schema `orbi.scene3d-manual-pilot-review/v1`
- decision
- reviewer
- rationale
- QB-22 readiness evidence SHA-256
- readiness state = `EVIDENCE_COMPLETE_FOR_MANUAL_PILOT_REVIEW`
- exact reviewed Git commit SHA

Supported decisions:

- `APPROVE_MANUAL_PILOT_REVIEW`
- `REJECT_MANUAL_PILOT_REVIEW`

No enable/cutover decision string is accepted.

## Output

Validated review result includes:

- deterministic review SHA-256
- immutable normalized record
- manual review approved/rejected state
- `featureEnableAuthorized=false`
- `productionCutoverAuthorized=false`
- `computeRouterAuthorityChanged=false`
- `mhsActuationEnabled=false`

## Tooling

Library:

```text
scripts/lib/scene3dManualPilotReview.js
```

CLI:

```text
scripts/qb23-scene3d-manual-pilot-review.js
```

Usage:

```bash
node scripts/qb23-scene3d-manual-pilot-review.js review.json
```

## Security/authority boundary

QB-23 imports no Electron APIs and exposes no:

- feature mutation
- execution IPC
- child process control
- sidecar/provider control
- reconciliation mutation
- Compute Router authority
- MHS authority
- production cutover authority

## Dependency

QB-23 is built on QB-22 v2 and therefore inherits the complete QB-12 → QB-22 dependency chain.

No canonical branch is modified.

**QB-23 status: IMPLEMENTATION CANDIDATE — manual review record only, no activation authority.**
