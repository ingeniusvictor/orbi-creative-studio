# QB-16 — Creative Studio Electron Scene3D Pilot Bridge

Status: **IMPLEMENTATION CANDIDATE — DEFAULT OFF — NOT FOR MERGE YET**

## Dependency gate

QB-16 depends on certification of the lab chain:

- QB-12 — Durable Execution Ledger & Restart Safety
- QB-13 — Durable Recovery & Reconciliation
- QB-14 — Scene3D Pilot Integration Contract
- QB-15 — Scene3D Local Sidecar Transport

This branch may be tested before those certifications, but it must not be merged into
`integration/orbi-foundation` until the dependency gates are PASS.

## Base

Branch created from frozen Creative Studio commit:

```text
b0c63b33f51e7d81322b47eb3312b6e76a266c68
```

No UI surface is enabled by QB-16.

## Architecture

```text
Creative Studio renderer
        ↓
window.orbiScene3D
        ↓
Electron preload
        ↓
trusted IPC handlers
        ↓
Scene3D process client
        ↓
native Python OR wsl.exe
        ↓
QB-15 stdio JSONL sidecar
        ↓
orbi.scene3d.v1
        ↓
durable policy/audit/recovery
        ↓
Blender
```

The renderer never receives:

- Python path
- sidecar path
- ledger path
- raw generated Python
- Qwen package names
- provider configuration
- reconciliation mutation authority

## Default-OFF feature gate

Environment flag:

```text
ORBI_SCENE3D_PILOT_ENABLED
```

Default: **false**.

When disabled:

- no sidecar client is created,
- no child process is started,
- Scene3D action IPC calls return `SCENE3D_PILOT_DISABLED`,
- the rest of Creative Studio starts normally.

The renderer cannot enable the pilot.

## Launch modes

### Native

Main-process environment:

```text
ORBI_SCENE3D_PILOT_ENABLED=1
ORBI_SCENE3D_LAUNCHER_MODE=native
ORBI_SCENE3D_SIDECAR_PATH=<absolute path to qb15_scene3d_sidecar.py>
ORBI_SCENE3D_PYTHON=<python executable>
```

The durable ledger is resolved under Electron `userData`.

### Windows → WSL

Main-process environment:

```text
ORBI_SCENE3D_PILOT_ENABLED=1
ORBI_SCENE3D_LAUNCHER_MODE=wsl
ORBI_SCENE3D_WSL_REPO=/absolute/linux/path/to/orbi-qwen-mm-plugins-lab
ORBI_SCENE3D_WSL_PYTHON=/absolute/linux/path/to/.venv/bin/python
ORBI_SCENE3D_WSL_LEDGER=/absolute/linux/path/to/scene3d.sqlite3
ORBI_SCENE3D_WSL_DISTRO=<optional distro name>
```

Electron launches:

```text
wsl.exe [--distribution <distro>] --cd <repo> <python> <qb15 sidecar> --ledger <ledger>
```

The child process is created with:

```text
shell: false
```

No command string is constructed by renderer input.

## Process client

Implementation:

```text
electron/lib/scene3dSidecarClient.js
```

Properties:

- lazy process start,
- one long-lived child per Electron main instance,
- JSONL request/response correlation,
- 256 KiB outbound request bound,
- 1 MiB accumulated response bound,
- bounded timeout,
- no automatic retry,
- provider diagnostics stay on stderr,
- graceful shutdown through stdin EOF.

If an R2 request times out, the process client does not resend it.

Recovery is handled through the durable ledger/reconciliation path.

## Product request policy

Implementation:

```text
electron/lib/scene3dPilotPolicy.js
```

Initial allowlist:

```text
orbi.blender.create_cube.v1
orbi.blender.delete_object.v1
```

Unknown recipes are rejected.

Renderer recipe requests cannot include fields such as:

- `code`
- `provider`
- `requestId`
- `retry`
- `ledgerPath`

The destructive delete recipe requires:

```text
confirmed: true
```

in the product IPC request.

That confirmation flag is consumed in Electron main and is not forwarded to the sidecar.

## Request identity

For reads and governed execution, Electron main generates opaque request ids using
`crypto.randomUUID()`.

Renderer cannot supply execution request ids.

This preserves the QB-14 replay-identity ownership rule.

## IPC surface

Preload global:

```text
window.orbiScene3D
```

Methods:

```text
getStatus()
sceneInfo()
objectInfo(objectName)
dryRunRecipe(request)
executeRecipe(request)
pendingRecoveries()
reconciliationHistory(requestId?)
```

There is no renderer method for:

- execute Python
- execute Blender code
- retry execution
- release reservation
- configure provider
- configure ledger path
- reconcile pending execution

Every IPC handler passes through the existing `assertTrustedSender` boundary.

## Recovery

The renderer may inspect:

- pending durable executions
- reconciliation history

The renderer cannot mutate reconciliation state.

QB-13 operator tooling remains the recovery authority for this pilot generation.

## Main-process lifecycle

`electron/main.js` registers the Scene3D bridge during app readiness.

Failure to register the default-OFF pilot does not prevent Creative Studio startup.

On `before-quit`, Electron main calls the bridge shutdown hook, which closes the child stdin and
allows the QB-15 sidecar to exit through EOF.

## Existing authority remains unchanged

QB-16 explicitly declares:

```text
computeRouterAuthorityChanged = false
mhsActuationEnabled = false
productionCutoverAuthorized = false
```

No existing image/video generation route is replaced.

## Tests

New tests:

```text
tests/scene3dPilotConfig.test.js
tests/scene3dPilotPolicy.test.js
tests/scene3dSidecarClient.test.js
tests/scene3dPilotBridge.test.js
tests/scene3dRendererSanitizer.test.js
tests/scene3dPilotBridgeRuntime.test.js
```

New QB-16 tests: **46**.

They cover:

- default-OFF behavior,
- native launch configuration,
- Windows→WSL launch configuration,
- hiding privileged launch details,
- exact recipe allowlist,
- destructive confirmation,
- request-field smuggling rejection,
- main-owned request identity,
- lazy child spawn,
- `shell:false`,
- single-process reuse,
- timeout with no retry,
- invalid JSON handling,
- unmatched response IDs,
- graceful EOF shutdown,
- outbound message size limit,
- narrow preload API,
- trusted IPC wrapper,
- no Qwen imports in Creative Studio,
- renderer-bound provider/provenance stripping,
- raw provider-result/tool-name stripping,
- provider exception/path sanitization,
- recovery receipt provider-metadata stripping,
- no current UI usage,
- no Compute Router/MHS authority expansion.

## Cross-host smoke

Script:

```text
scripts/qb16-scene3d-cross-host-smoke.js
```

This can validate the real path:

```text
Node on Windows
   ↓
wsl.exe
   ↓
QB-15 Python JSONL sidecar
   ↓
ORBI Scene3D runtime
   ↓
Blender
```

It verifies:

1. sidecar status,
2. no public listener,
3. no R2 automatic retry,
4. preexisting-object guard,
5. dry-run,
6. governed create,
7. live MESH read-back,
8. recovery inspection,
9. governed cleanup,
10. graceful client close.

Expected terminal result:

```text
QB-16 CROSS-HOST SCENE3D PILOT BRIDGE: PASS
```

## Local unit validation

```bash
node --test \
  tests/scene3dPilotConfig.test.js \
  tests/scene3dPilotPolicy.test.js \
  tests/scene3dSidecarClient.test.js \
  tests/scene3dPilotBridge.test.js \
  tests/scene3dRendererSanitizer.test.js \
  tests/scene3dPilotBridgeRuntime.test.js
```

Expected:

```text
46 tests passed
```

## Production boundary

QB-16 still does not:

- expose UI controls,
- enable the feature by default,
- package the Qwen lab with Creative Studio,
- choose production installation paths,
- reconcile pending executions from renderer,
- change generation routing,
- authorize MHS writes,
- authorize production cutover.

**QB-16 status: IMPLEMENTATION CANDIDATE — feature flag OFF, awaiting dependency and local/CI validation.**
