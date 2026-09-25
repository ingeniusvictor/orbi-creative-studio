# QB-18 — Scene3D Execution Authority Gate

Status: **IMPLEMENTATION CANDIDATE — EXECUTION DEFAULT OFF**

## Dependency chain

QB-18 v3 is rebuilt cleanly on the certified QB-17 canonical head:

```text
c7aebf1df06be5e2deb82054e7d68e56c39c9535
```

It inherits the fully certified QB-12 → QB-17 dependency chain.

## Purpose

QB-18 separates:

- Scene3D diagnostics/read authority, and
- governed Scene3D execution authority.

Enabling the Scene3D pilot no longer implies side-effect authority.

## Main-process flags

Read/diagnostic pilot:

```text
ORBI_SCENE3D_PILOT_ENABLED
```

Governed execution:

```text
ORBI_SCENE3D_EXECUTION_ENABLED
```

Rules:

- both default OFF,
- execution can become true only when the pilot itself is enabled,
- renderer cannot set either flag,
- renderer sees only sanitized boolean status,
- no launch/provider/path details are exposed.

## Read-only mode

With:

```text
ORBI_SCENE3D_PILOT_ENABLED=1
ORBI_SCENE3D_EXECUTION_ENABLED=0
```

the renderer may use status, scene info, object info, pending recoveries and reconciliation history.

The renderer may not use dry-run recipe or execute recipe.

Both return:

```text
SCENE3D_EXECUTION_DISABLED
```

## Pre-spawn denial

Execution denial happens before sidecar client creation. A blocked execution attempt therefore does not spawn Python or WSL, create a sidecar process, create a provider request, or allocate an R2 request id in the sidecar.

## Inherited hardening

QB-18 v3 preserves the certified QB-16/QB-17 protections, including:

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
- read-only diagnostics surface.

## Public status

The sanitized status adds:

```text
executionEnabled
executionDefaultOff
```

The diagnostics surface may display this state but cannot mutate it.

## Renderer authority

There is no renderer API for:

```text
setExecutionEnabled
setPilotEnabled
setProvider
setLedgerPath
retryExecution
reconcilePending
```

## Production boundary

QB-18 does not add execution UI, does not enable governed execution by default, does not alter Compute Router authority, does not enable MHS actuation, and does not authorize production cutover.

## Validation

QB-18 adds 9 new tests to the certified 59-test QB-17 accumulated gate.

Expected accumulated focused gate:

```text
tests 68
pass 68
fail 0
```

Then run canonical integrated CI.

## Next phase

**QB-19 — Governed Scene3D Execution Review Surface**

QB-19 may expose controlled execution review only after QB-18 certification.

## Rebuild note

The previous QB-18 v2 branch diverged from the final certified QB-17 history. QB-18 v3 was therefore rebuilt from the certified canonical head and contains only the QB-18 authority delta.

**QB-18 v3 status: IMPLEMENTATION CANDIDATE — execution authority remains default OFF.**
