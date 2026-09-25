# QB-18 — Scene3D Execution Authority Gate Certification

Status: **CERTIFIED**

## Certified candidate

Branch:

```text
feature/qb-18-scene3d-execution-authority-gate-v3
```

Implementation candidate:

```text
cddde649ae37eba4a5c03474c17ce7b85b7cc8b8
```

Certified predecessor:

```text
QB-17 certification head = c7aebf1df06be5e2deb82054e7d68e56c39c9535
```

## Certification evidence

### Local accumulated gate

Observed on the exact QB-18 implementation candidate:

```text
tests 68
pass 68
fail 0
```

This consists of the certified 59-test QB-17 accumulated gate plus 9 QB-18 execution-authority tests.

### Remote integrated CI

Validation PR:

```text
#164 — QB-18 v3 — Scene3D execution authority gate
```

GitHub Actions run:

```text
ORBI Pull Request integrated gate
run id = 36099810549
result = SUCCESS
```

The exact implementation candidate passed:

- exact dependency installation,
- Electron source syntax gate,
- deterministic lint gate,
- root tests,
- workspace builds,
- Next application build,
- Electron renderer build,
- production dependency security gate.

### Repository lineage

Verified before certification:

```text
integration/orbi-foundation base = c7aebf1df06be5e2deb82054e7d68e56c39c9535
candidate = cddde649ae37eba4a5c03474c17ce7b85b7cc8b8
ahead = 7
behind = 0
```

QB-18 v3 was rebuilt cleanly on the corrected certified QB-17 canonical head after the previous v2 branch was found divergent.

## Certified authority model

QB-18 separates read/diagnostic authority from governed execution authority.

Read/diagnostic pilot:

```text
ORBI_SCENE3D_PILOT_ENABLED
```

Governed execution authority:

```text
ORBI_SCENE3D_EXECUTION_ENABLED
```

Certified invariants:

- both controls default OFF,
- execution is true only when the pilot is enabled and the execution flag is explicitly enabled,
- pilot enablement alone does not grant execution authority,
- renderer cannot set either authority flag,
- renderer cannot smuggle `executionEnabled` through request arguments,
- renderer receives only sanitized boolean execution state,
- no provider, Python, WSL, sidecar or ledger paths are exposed.

## Read-only mode

With:

```text
ORBI_SCENE3D_PILOT_ENABLED=1
ORBI_SCENE3D_EXECUTION_ENABLED=0
```

read operations remain available:

- status,
- scene info,
- object info,
- pending recoveries,
- reconciliation history.

The following remain denied:

- dry-run recipe,
- execute recipe.

The denial code is:

```text
SCENE3D_EXECUTION_DISABLED
```

## Pre-spawn execution denial

Execution authorization is checked before sidecar client creation.

When execution is disabled, a dry-run or execute attempt therefore does not:

- create the sidecar client,
- spawn Python,
- launch WSL,
- create a provider request,
- allocate a sidecar R2 execution request.

This is a certified defense-in-depth boundary.

## Inherited certified hardening

QB-18 preserves the QB-16/QB-17 security model, including:

- platform-deterministic native path handling,
- lazy/injectable Electron dependencies for pure Node validation,
- absolute native Python executable requirement,
- trusted `SystemRoot\System32\wsl.exe`,
- `shell:false`,
- child-environment allowlisting,
- PATH/provider-secret stripping,
- fail-closed sidecar protocol handling,
- renderer sanitization,
- raw reconciliation evidence kept main-only,
- read-only diagnostics behavior,
- automatic R2 retry disabled.

## Renderer mutation boundary

No public renderer API exists for:

```text
setExecutionEnabled
setPilotEnabled
setProvider
setLedgerPath
retryExecution
releaseReservation
reconcilePending
executeBlenderCode
executePython
```

The QB-17 diagnostics panel may display `executionEnabled` but cannot mutate it.

## Authority state after certification

```text
pilotDefaultOff = true
executionDefaultOff = true
automaticR2Retry = false
rendererCanConfigureExecution = false
computeRouterAuthorityChanged = false
mhsActuationEnabled = false
productionCutoverAuthorized = false
```

## Live execution scope

QB-18 changes the authority gate, not the previously certified transport path. The Windows -> WSL -> QB-15 -> Blender path was live-certified in QB-16. QB-18 local runtime tests verify both execution-disabled and execution-enabled dispatch semantics without introducing a new automatic actuation path.

## Certification result

```text
QB-18 SCENE3D EXECUTION AUTHORITY GATE: CERTIFIED
local accumulated gate = 68/68 PASS
integrated CI = SUCCESS
candidate = cddde649ae37eba4a5c03474c17ce7b85b7cc8b8
predecessor QB-17 = CERTIFIED
execution default = OFF
```

**QB-18: CERTIFIED.**
