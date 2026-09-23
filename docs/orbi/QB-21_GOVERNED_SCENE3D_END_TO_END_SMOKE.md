# QB-21 — Governed Scene3D End-to-End Pilot Smoke

Status: **IMPLEMENTATION CANDIDATE — LIVE VALIDATION HARNESS READY**

## Dependency chain

QB-21 is stacked on QB-20 and inherits the complete QB-12 → QB-20 dependency chain.

It does not authorize merge or production cutover.

## Purpose

QB-21 validates the real governed path from the Creative Studio Electron-main bridge through the
QB-15 sidecar and into Blender.

The smoke exercises the same IPC handlers used by the renderer but without requiring DOM/UI
automation.

## Real path

```text
Creative Studio scene3dPilotBridge
    ↓
Scene3D sidecar client
    ↓
native Python or Windows → WSL
    ↓
QB-15 JSONL sidecar
    ↓
ORBI compatibility runtime
    ↓
durable execution ledger
    ↓
Qwen Blender provider
    ↓
Blender
```

## Smoke sequence

Script:

```text
scripts/qb21-scene3d-governed-e2e-smoke.js
```

Sequence:

1. verify pilot + execution authority are enabled,
2. verify status does not pre-start the sidecar,
3. verify `ORBI_QB21_Cube` did not preexist,
4. dry-run create,
5. obtain main-issued one-shot review,
6. mutate size after review,
7. prove `SCENE3D_REVIEW_MISMATCH`,
8. prove consumed mismatch token cannot be reused,
9. obtain a fresh dry-run review,
10. execute governed create,
11. verify provider-call audit,
12. read back live Blender MESH,
13. inspect pending recovery/history,
14. dry-run governed delete,
15. execute governed cleanup with fresh review,
16. shutdown sidecar,
17. create a new bridge/process session,
18. verify object remains absent,
19. verify automatic R2 retry remains disabled.

Required result:

```text
QB-21 GOVERNED SCENE3D END-TO-END: PASS
```

## Review evidence hardening

QB-21 additionally tightens QB-19 review issuance.

A review token is issued only when dry-run evidence proves:

- exact recipe id match,
- exact canonical parameter fingerprint match,
- valid 64-character lowercase SHA-256 compiled-code identity,
- `network_allowed=false`,
- empty `filesystem_scope`,
- execution remains `dry-run`,
- provider execution was not called.

Invalid evidence returns:

```text
SCENE3D_REVIEW_EVIDENCE_INVALID
```

No token is issued.

## Review-to-execution code identity revalidation

QB-21 closes the remaining review→execute TOCTOU gap.

A successful review token is not sufficient by itself. On execution, Electron main now performs:

```text
consume one-shot review token
    ↓
current sidecar dry_run_recipe
    ↓
validate recipe id + canonical parameters
    ↓
validate code SHA-256 + no network + empty filesystem scope
    ↓
compare current code SHA with reviewed code SHA
    ↓
execute_recipe
```

If the sidecar restarted or governed recipe code changed after review:

```text
SCENE3D_REVIEW_CODE_CHANGED
```

is returned and `execute_recipe` is never dispatched.

The review token is consumed **before** this revalidation, so a failed code-identity check cannot be
retried with the same capability token.

This extra dry-run is provider-free and has no side effect.

## Environment

### Native/Wsl/Linux

Set:

```text
ORBI_SCENE3D_PILOT_ENABLED=1
ORBI_SCENE3D_EXECUTION_ENABLED=1
ORBI_SCENE3D_LAUNCHER_MODE=native
ORBI_SCENE3D_SIDECAR_PATH=<absolute path>/scripts/orbi/qb15_scene3d_sidecar.py
ORBI_SCENE3D_PYTHON=<absolute path>/.venv/bin/python
```

### Windows → WSL

Set:

```text
ORBI_SCENE3D_PILOT_ENABLED=1
ORBI_SCENE3D_EXECUTION_ENABLED=1
ORBI_SCENE3D_LAUNCHER_MODE=wsl
ORBI_SCENE3D_WSL_REPO=/home/.../orbi-qwen-mm-plugins-lab
ORBI_SCENE3D_WSL_PYTHON=/home/.../orbi-qwen-mm-plugins-lab/.venv/bin/python
ORBI_SCENE3D_WSL_LEDGER=/home/.../scene3d-qb21.sqlite3
ORBI_SCENE3D_WSL_DISTRO=<optional distro>
```

The WSL launcher itself is resolved from trusted Windows `SystemRoot\System32\wsl.exe`.

## Safety boundaries

QB-21 does not:

- add new recipes,
- expose Python,
- expose reconciliation mutation,
- enable execution by default,
- add automatic retries,
- change Compute Router authority,
- enable MHS writes,
- authorize production cutover.

## Validation

Focused Node/unit validation should run through the repository integrated gate.

Live validation:

```bash
node scripts/qb21-scene3d-governed-e2e-smoke.js
```

Expected:

```text
QB-21 GOVERNED SCENE3D END-TO-END: PASS
```

**QB-21 status: IMPLEMENTATION CANDIDATE — ready for cumulative CI and live cross-runtime validation.**
