# QB-17 — Scene3D Pilot Diagnostics Surface Certification

Status: **CERTIFIED**

## Certified candidate

Branch:

```text
feature/qb-17-scene3d-pilot-diagnostics-surface
```

Implementation candidate:

```text
3a9c2e1df1c4bfea532f8e6ba9ca3b3d35fa9810
```

Certified predecessor:

```text
QB-16 certification head = f9c00d0d24831ea9f6e450c5da469271225a00b3
```

## Certification evidence

### Local accumulated gate

Observed on the certified QB-17 candidate:

```text
tests 59
pass 59
fail 0
```

This gate contains the certified QB-16 test set plus the QB-17 read-only diagnostics tests.

### Remote CI

GitHub Actions on the exact implementation candidate:

```text
ORBI Pull Request integrated gate = SUCCESS
ORBI P1C64 Hardware Pilot Export UI = SUCCESS
```

### Repository lineage

Verified before certification:

```text
integration/orbi-foundation base = f9c00d0d24831ea9f6e450c5da469271225a00b3
candidate = 3a9c2e1df1c4bfea532f8e6ba9ca3b3d35fa9810
ahead = 18
behind = 0
```

The QB-17 branch therefore contains the complete certified QB-16 base and is not missing canonical predecessor commits.

## Certified scope

QB-17 adds a renderer-visible Scene3D diagnostics surface that remains strictly read-only.

The certified surface:

- is exposed only in the Electron desktop environment,
- performs only `getStatus()` automatically,
- does not start the sidecar merely by opening diagnostics,
- requires explicit user action for provider-touching reads,
- exposes scene info,
- exposes object info,
- exposes pending recovery inspection,
- exposes reconciliation history,
- consumes the already-sanitized QB-16 renderer surface,
- renders diagnostic payloads through text-safe output,
- bounds formatted diagnostic output to 65,536 characters.

## Certified authority boundaries

QB-17 does not expose or invoke:

```text
executeRecipe
dryRunRecipe
retryExecution
releaseReservation
reconcilePending
executeBlenderCode
executePython
```

It also does not expose renderer control over:

- provider identity,
- Python executable,
- WSL repository path,
- sidecar path,
- SQLite ledger path,
- execution request identity,
- automatic retries,
- reconciliation mutation.

The following remain unchanged:

```text
pilotDefaultOff = true
executionDefaultOff = true
automaticR2Retry = false
computeRouterAuthorityChanged = false
mhsActuationEnabled = false
productionCutoverAuthorized = false
```

## Live execution scope

QB-17 is a read-only diagnostics phase. The governed Windows -> WSL -> QB-15 -> Blender execution path was already live-certified in QB-16. QB-17 introduces no new execution authority, so certification does not require repeating destructive/create-delete Blender smoke solely for this diagnostics surface.

## Certification result

```text
QB-17 SCENE3D PILOT DIAGNOSTICS SURFACE: CERTIFIED
local accumulated gate = 59/59 PASS
integrated CI = SUCCESS
P1C64 UI CI = SUCCESS
candidate = 3a9c2e1df1c4bfea532f8e6ba9ca3b3d35fa9810
predecessor QB-16 = CERTIFIED
```

**QB-17: CERTIFIED.**
