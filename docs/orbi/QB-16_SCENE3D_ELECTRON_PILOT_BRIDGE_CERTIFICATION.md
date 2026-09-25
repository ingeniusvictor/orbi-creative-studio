# QB-16 — Scene3D Electron Pilot Bridge Certification

Status: **CERTIFIED**

## Certified candidate

Branch:

```text
feature/qb-16-scene3d-electron-pilot-bridge
```

Implementation candidate:

```text
90c8df6346dc9fa1642bdaf5cabe4afb31f54c3d
```

Certified dependency chain:

```text
QB-12 CERTIFIED
QB-13 CERTIFIED
QB-14 CERTIFIED
QB-15 CERTIFIED
```

QB-15 certification head:

```text
09edd9f3d0d1b4201f1257bc55e67e76f96c9f38
```

## Certification evidence

### Local QB-16 unit gate

Observed on the certified candidate:

```text
tests 50
pass 50
fail 0
```

The gate covers:

- Scene3D pilot configuration,
- product request policy,
- sidecar process client,
- Electron bridge contract,
- renderer sanitization,
- runtime bridge behavior.

### Cross-host live smoke

Observed from Windows PowerShell against the certified QB-15 WSL sidecar and live Blender MCP:

```text
QB-16 CROSS-HOST SCENE3D PILOT BRIDGE: PASS
```

The live path exercised:

```text
Windows Node
  -> wsl.exe
  -> QB-15 stdio JSONL sidecar
  -> governed ORBI Scene3D runtime
  -> Blender MCP
  -> Blender
```

The smoke verified:

- sidecar status,
- no public listener,
- automatic R2 retry disabled,
- pre-existing object guard,
- cross-host dry run,
- governed object creation,
- live MESH read-back,
- durable recovery inspection,
- governed cleanup,
- graceful sidecar client close.

### Remote CI

GitHub Actions on the exact implementation candidate:

```text
ORBI Pull Request integrated gate = SUCCESS
ORBI P1C63 Hardware Pilot File Export = SUCCESS
```

### Repository lineage

Verified before certification:

```text
integration/orbi-foundation base = b0c63b33f51e7d81322b47eb3312b6e76a266c68
candidate = 90c8df6346dc9fa1642bdaf5cabe4afb31f54c3d
ahead = 43
behind = 0
```

The candidate is therefore a pure fast-forward from the previously canonical Creative Studio base.

## Certified architecture

QB-16 certifies the default-OFF Electron product bridge:

```text
Creative Studio renderer
  -> preload capability
  -> trusted Electron IPC
  -> Scene3D process client
  -> native Python or wsl.exe
  -> QB-15 local sidecar
  -> orbi.scene3d.v1
  -> durable policy/audit/recovery
  -> Blender
```

## Certified security and authority boundaries

QB-16 certifies that:

- the Scene3D pilot remains default OFF,
- the renderer cannot enable the pilot,
- the renderer cannot choose Python, provider, sidecar or ledger paths,
- the renderer cannot supply execution request ids,
- destructive delete requires explicit product confirmation,
- confirmation is consumed in Electron main and is not forwarded,
- the initial recipe allowlist remains the certified create/delete pair,
- no arbitrary Blender Python surface is exposed,
- no retry or request-id release surface is exposed,
- no reconciliation mutation surface is exposed,
- recovery visibility remains inspection-only,
- renderer-bound provider/provenance metadata is sanitized,
- raw operator reconciliation evidence is not exposed,
- sidecar launch uses `shell:false`,
- WSL launch uses the trusted SystemRoot `wsl.exe`,
- child environment is allowlisted,
- provider secrets and inherited PATH are not forwarded,
- invalid sidecar protocol output fails closed,
- R2 automatic retry remains disabled,
- Compute Router authority is unchanged,
- MHS actuation remains disabled,
- production cutover remains unauthorized.

## Windows portability hardening discovered during certification

Local Windows certification exposed two issues not covered by the prior Linux CI candidate.

The certified candidate includes hardening for both:

1. Native path normalization now follows the explicitly requested platform instead of the host running the test.
2. Electron-specific bridge dependencies are loaded lazily/injectably so pure Node contract tests do not require an Electron runtime at module-load time.

The corresponding static trusted-sender contract test was updated to validate the effective lazy-bound trusted sender.

These changes are included in the 50/50 local PASS and the final remote integrated CI PASS.

## Explicit limitations

QB-16 does not certify:

- production enablement,
- automatic feature activation,
- arbitrary Scene3D recipes,
- arbitrary Python,
- renderer-controlled provider configuration,
- renderer reconciliation mutation,
- automatic recovery retries,
- cross-machine remote transport,
- MHS actuation,
- production cutover.

Read-only Scene3D pilot diagnostics are the scope of QB-17.

## Certification result

```text
QB-16 SCENE3D ELECTRON PILOT BRIDGE: CERTIFIED
local unit gate = 50/50 PASS
cross-host live smoke = PASS
integrated CI = SUCCESS
hardware pilot export CI = SUCCESS
candidate = 90c8df6346dc9fa1642bdaf5cabe4afb31f54c3d
```

**QB-16: CERTIFIED.**
