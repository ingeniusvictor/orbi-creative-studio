# QB-22 — Scene3D Pilot Readiness Evidence Gate

Status: **IMPLEMENTATION CANDIDATE — EVIDENCE ONLY — NO ENABLE AUTHORITY**

## Purpose

QB-22 creates an offline, deterministic readiness gate for the complete Scene3D pilot chain.

It does not execute Scene3D, launch Electron, start a sidecar, mutate feature flags, or authorize a
production cutover.

## Required phases

The evidence model requires immutable commit evidence and phase-specific PASS gates for:

- QB-12 — durable ledger/restart safety
- QB-13 — durable recovery/reconciliation
- QB-14 — pilot integration contract
- QB-15 — local sidecar transport
- QB-16 — Electron pilot bridge
- QB-17 — read-only diagnostics
- QB-18 — execution authority gate
- QB-19 — governed dry-run review binding
- QB-20 — execution review UI
- QB-21 — governed end-to-end smoke

## Fail-closed output

Incomplete or inconsistent evidence returns:

```text
BLOCKED
```

Complete evidence returns only:

```text
EVIDENCE_COMPLETE_FOR_MANUAL_PILOT_REVIEW
```

Even a complete result explicitly keeps:

```text
featureEnableAuthorized = false
productionCutoverAuthorized = false
computeRouterAuthorityChanged = false
mhsActuationEnabled = false
```

Therefore QB-22 is a review-readiness gate, not an activation gate.

## Evidence integrity

Each phase record must contain:

- `status = PASS`
- full lowercase 40-character Git commit SHA
- all phase-specific boolean gates required by the schema

The complete evidence object receives a deterministic SHA-256 digest over canonical JSON.

Prototype-mutating/non-JSON values are rejected or normalized safely.

## Authority invariants

Required authority state:

```text
pilotDefaultOff = true
executionDefaultOff = true
automaticR2Retry = false
computeRouterAuthorityChanged = false
mhsActuationEnabled = false
productionCutoverAuthorized = false
featureEnableAuthorized = false
```

Any drift blocks readiness.

## Tooling

Library:

```text
scripts/lib/scene3dPilotReadinessEvidence.js
```

CLI:

```text
scripts/qb22-scene3d-pilot-readiness.js
```

Generate a blocked template:

```bash
node scripts/qb22-scene3d-pilot-readiness.js --template
```

Evaluate an evidence document:

```bash
node scripts/qb22-scene3d-pilot-readiness.js evidence.json
```

Exit codes:

- `0` — evidence complete for manual review only
- `2` — evidence structurally valid but blocked/incomplete
- `1` — invalid evidence/usage

## Runtime authority

The readiness tooling imports no Electron APIs and exposes no:

- IPC authority
- child process authority
- dry-run/execute call
- feature-enable mutation
- provider configuration
- reconciliation mutation
- Compute Router authority
- MHS authority

## Dependency

QB-22 v2 is built on QB-21 v2 and inherits the full QB-12 → QB-21 dependency chain.

No canonical branch is modified.

**QB-22 v2 status: IMPLEMENTATION CANDIDATE — evidence gate only.**
