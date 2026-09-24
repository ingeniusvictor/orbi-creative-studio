# QB-18 — Scene3D Execution Authority Gate

Status: **IMPLEMENTATION CANDIDATE — EXECUTION DEFAULT OFF**

## Dependency chain

QB-18 v2 is rebuilt cleanly on the current QB-17 stack and inherits the QB-12 → QB-17 dependency chain.

It must not be merged independently while those dependencies remain uncertified/unmerged.

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

the renderer may use:

- status,
- scene info,
- object info,
- pending recoveries,
- reconciliation history.

The renderer may not use:

- dry-run recipe,
- execute recipe.

Both return:

```text
SCENE3D_EXECUTION_DISABLED
```

## Pre-spawn denial

Execution denial happens before sidecar client creation.

Therefore a blocked execution attempt:

- does not spawn Python,
- does not launch WSL,
- does not create a sidecar process,
- does not create a provider request,
- does not allocate an R2 request id in the sidecar.

This is intentional defense-in-depth.

## WSL/native launcher hardening inherited from QB-16

QB-18 inherits:

- absolute native Python executable requirement,
- WSL launcher resolved through trusted `SystemRoot\System32\wsl.exe`,
- `shell:false`,
- child-environment allowlisting,
- PATH/provider-secret stripping,
- fail-closed malformed JSON handling,
- raw reconciliation evidence kept main-only.

## Public status

The sanitized status now includes:

```text
executionEnabled
executionDefaultOff
```

The QB-17 diagnostics surface may display this state but cannot mutate it.

## Renderer authority

Preload continues to expose the same narrow methods.

There is no:

```text
setExecutionEnabled
setPilotEnabled
setProvider
setLedgerPath
retryExecution
reconcilePending
```

## Tests

QB-18 adds/extends tests proving:

- execution authority defaults OFF,
- pilot OFF always forces execution OFF,
- read-only pilot mode,
- execution-enabled mode requires both explicit flags,
- renderer cannot mutate execution authority,
- dry-run is blocked before sidecar creation,
- execute is blocked before sidecar creation,
- read operations still work with execution OFF,
- diagnostics can display the boolean without mutation authority.

## Production boundary

QB-18 does not add execution UI.

It does not:

- enable governed execution by default,
- expose recipe execution buttons,
- alter Compute Router authority,
- enable MHS actuation,
- authorize production cutover.

## Next recommended phase

**QB-19 — Governed Scene3D Execution Review Surface**

Only after QB-18 validation, a UI may be added that:

- requires execution authority ON,
- requires dry-run before execute,
- shows recipe/fingerprint metadata,
- requires explicit product confirmation,
- keeps destructive delete confirmation,
- never retries automatically.

**QB-18 v2 status: IMPLEMENTATION CANDIDATE — execution authority remains default OFF.**


## Rebuild note

The earlier QB-18 branch diverged from the hardened QB-17 history. This v2 branch was rebuilt from
the current QB-17 head so the following protections are inherited without conflict:

- absolute native Python executable,
- trusted SystemRoot WSL launcher,
- child environment allowlisting,
- malformed-JSON fail-closed behavior,
- renderer sanitizer hardening,
- raw reconciliation evidence kept main-only,
- read-only diagnostics surface.

No canonical branch was modified during the rebuild.
