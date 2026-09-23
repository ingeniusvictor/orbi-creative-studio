# QB-17 — Scene3D Pilot Diagnostics Surface

Status: **IMPLEMENTATION CANDIDATE — READ-ONLY — DEFAULT-OFF DEPENDENCY**

## Dependency chain

QB-17 is stacked on QB-16 at:

```text
276671e6353b75f787ed6d0c55db03b62e9c6030
```

QB-16 itself remains unmerged and depends on certification of the lab chain QB-12 → QB-15.

QB-17 must not be merged independently of those dependencies.

## Purpose

QB-17 adds the first renderer-visible Scene3D surface to ORBI Creative Studio, but keeps it
strictly diagnostic and read-only.

It does **not** expose governed execution.

## Settings integration

A new `Scene3D` Settings tab is added only when:

```text
window.orbiScene3D?.isElectron === true
```

Therefore the surface is desktop/Electron-only.

## Automatic behavior

Creating the diagnostics panel performs exactly one automatic operation:

```text
getStatus()
```

QB-16 guarantees that `getStatus()` is local and does not start the sidecar.

The panel does not automatically:

- start Blender,
- read scene state,
- inspect objects,
- inspect recovery state,
- execute any recipe.

## User-initiated read operations

When the pilot is enabled, the user may explicitly request:

- scene info,
- object info,
- pending recovery inspection,
- reconciliation history.

All data reaches the renderer through the QB-16 sanitizer.

## Explicitly absent authority

The diagnostics component contains no calls to:

```text
executeRecipe
dryRunRecipe
retryExecution
releaseReservation
reconcilePending
executeBlenderCode
executePython
```

It also contains no provider/Qwen, Python, SQLite, sidecar-path, WSL-repo, or ledger-path
knowledge.

## Output safety

Diagnostic results are rendered through `textContent` into a `pre` element.

Provider data is never inserted with `innerHTML`; the status container is cleared with `replaceChildren()`.

Formatted diagnostic output is capped at **65,536 characters** before rendering. Larger results are truncated with an explicit marker to protect renderer responsiveness/memory.

The component consumes only the already-sanitized QB-16 renderer surface.

## Compute Router / MHS isolation

QB-17 does not reference:

- `orbiComputeRouter`
- `orbiBenchmark`
- MHS

No generation routing, benchmark, or hardware authority changes.

## Files

Implementation:

```text
src/components/Scene3DPilotDiagnosticsPanel.js
src/components/SettingsModal.js
```

Tests:

```text
tests/scene3dPilotDiagnosticsSurface.test.js
```

New QB-17 tests: **7**.

## Validation

Focused gate:

```bash
node --test tests/scene3dPilotDiagnosticsSurface.test.js
```

Then run the repository canonical integrated gate.

## Production boundary

QB-17 remains a pilot diagnostics surface.

It does not:

- enable QB-16 by default,
- add recipe execution UI,
- reconcile pending executions,
- package the Python/Qwen lab,
- authorize production cutover.

**QB-17 status: IMPLEMENTATION CANDIDATE — read-only diagnostics only.**
