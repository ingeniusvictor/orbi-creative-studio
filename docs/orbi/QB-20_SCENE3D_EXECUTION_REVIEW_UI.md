# QB-20 — Scene3D Execution Review UI

Status: **IMPLEMENTATION CANDIDATE — GOVERNED UI ONLY**

QB-20 inherits QB-19's prototype-safe canonical review fingerprinting (`__proto__` is treated as data, never as object prototype mutation).

## Dependency chain

QB-20 is stacked on QB-19 and inherits the full QB-12 → QB-19 dependency chain.

It must not be merged independently while those dependencies remain uncertified/unmerged.

## Purpose

QB-20 exposes governed Scene3D execution to the renderer without creating a generic command
surface.

The UI supports only the two certified recipes:

- `orbi.blender.create_cube.v1`
- `orbi.blender.delete_object.v1`

There is no raw JSON editor, Python editor, provider selector, path selector, retry control, or
reconciliation mutation control.

## Main authority prerequisite

The execution UI is rendered only when sanitized main-process status reports:

```text
executionEnabled = true
```

When execution authority is OFF, the diagnostics panel remains read-only.

## Required flow

The UI enforces:

```text
controlled inputs
    ↓
Review dry-run
    ↓
sanitized review evidence
    ↓
explicit confirmation checkbox
    ↓
Execute reviewed action
```

The Electron-main QB-19 gate independently enforces the same sequence, so renderer/UI compromise
cannot bypass the review requirement.

## Input controls

Create cube:

- governed object name pattern: `[A-Za-z0-9_.-]{1,64}`
- size: 0.01–1000
- x/y/z: -10000–10000

Delete object:

- governed object name only.

Invalid numeric values and names are rejected before IPC.

## Review invalidation

Any recipe/input change:

- clears the local review,
- unchecks confirmation,
- disables execute,
- requires a new dry-run.

This is defense-in-depth on top of the main-process fingerprint match.

## Review evidence

The renderer displays:

- recipe id,
- normalized parameters,
- execution fingerprint,
- compiled recipe code SHA-256,
- expiry,
- one-shot status,
- providerCalled,
- networkAllowed,
- filesystemScope.

The opaque review token is retained in closure state and is not rendered.

## Execution

Execution requires:

```text
confirmed: true
reviewToken: <opaque one-shot token>
```

The renderer never supplies an ORBI execution request id.

Immediately before awaiting IPC, the renderer clears its local review capability so:

- double click cannot reuse it,
- UI exception paths cannot retry it,
- uncertain execution response does not preserve a retry capability.

## Uncertain outcome

If the renderer-level call throws, the UI reports:

```text
Execution result is uncertain.
Inspect pending recoveries; do not retry automatically.
```

There is no automatic retry.

## Output safety

Dry-run evidence and execution responses use `textContent`, never provider-controlled
`innerHTML`.

Both execution evidence and execution results are bounded to **65,536 characters**. Larger values are truncated with an explicit marker. Formatting failures and non-serializable/empty results are converted to generic renderer-safe messages rather than raw exceptions.

The parent diagnostics host is also fail-closed: it clears any existing execution panel before evaluating each new status response. If status becomes unavailable, disabled, or loses execution authority, stale execution controls are removed immediately.

## Files

Implementation:

```text
src/components/Scene3DExecutionReviewPanel.js
src/components/Scene3DPilotDiagnosticsPanel.js
```

Tests:

```text
tests/scene3dExecutionReviewUI.test.js
```

New QB-20 tests: **14**.

## Production boundary

QB-20 still depends on feature flags that default OFF.

It does not:

- enable the Scene3D pilot by default,
- enable execution authority by default,
- expand the recipe allowlist,
- expose arbitrary Blender/Python,
- expose reconciliation mutation,
- change Compute Router authority,
- enable MHS actuation,
- authorize production cutover.

## Next recommended phase

**QB-21 — Governed Execution End-to-End Pilot Smoke**

Validate the complete real path:

```text
Creative Studio Node/Electron bridge
    ↓
dry-run
    ↓
main review token
    ↓
reviewed execute
    ↓
QB-15 sidecar
    ↓
ORBI durable ledger/policy
    ↓
Blender
    ↓
read-back + cleanup
```

The smoke should also prove payload mutation after review is rejected before provider execution.

**QB-20 status: IMPLEMENTATION CANDIDATE — governed review UI, all authority default OFF.**
