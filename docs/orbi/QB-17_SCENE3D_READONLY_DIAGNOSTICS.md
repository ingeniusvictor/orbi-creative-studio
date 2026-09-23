# QB-17 — Scene3D Read-Only Diagnostics

Status: **IMPLEMENTATION CANDIDATE — READ-ONLY — DEFAULT HIDDEN**

## Dependency

QB-17 is stacked on QB-16 and therefore inherits all QB-12 → QB-16 certification dependencies.

QB-16 Integrated Gate status at the parent commit:

```text
syntax: GREEN
lint: GREEN
root tests: GREEN
workspaces build: GREEN
Next build: GREEN
Electron renderer build: GREEN
production dependency security gate: GREEN
```

QB-17 must not be merged until the dependency chain is certified.

## Purpose

QB-17 adds the first renderer-visible Scene3D surface, but it is diagnostics-only.

It does not:

- execute recipes,
- dry-run recipes,
- inspect pending recovery state,
- inspect reconciliation history,
- reconcile anything,
- configure providers,
- configure launch paths,
- start Python,
- start Blender,
- start the sidecar.

## Visibility

The panel is mounted beside the existing Router Diagnostics panel.

It starts with:

```text
display: none
```

It becomes visible only when:

```text
window.orbiScene3D.getStatus()
```

returns a validated status with:

- `enabled = true`
- mode = `native` or `wsl`
- `defaultOff = true`
- `rendererCanConfigure = false`
- `automaticR2Retry = false`
- `reconciliationMutation = false`
- exact certified recipe allowlist.

When the feature flag is OFF or status is malformed/unavailable, the panel remains hidden.

## No process start

QB-16 `getStatus()` is local to Electron main and does not construct or start the sidecar client.

Therefore opening Settings / Router Diagnostics cannot start:

- `wsl.exe`
- Python
- QB-15 sidecar
- Blender/Qwen provider runtime.

## Displayed fields

The panel shows only:

- launch mode,
- sidecar process started / not started,
- certified pilot recipes,
- explicit read-only boundary text.

No filesystem paths, request IDs, provider identity, Qwen package name, ledger location, Python path,
or raw provider output are rendered.

## Exact recipe set

QB-17 accepts exactly:

```text
orbi.blender.create_cube.v1
orbi.blender.delete_object.v1
```

If status advertises an additional/unreviewed recipe, the panel fails closed and stays hidden.

## Bilingual copy

English and Chinese strings are added for:

- panel title,
- subtitle,
- launch mode,
- process state,
- certified recipes,
- read-only boundary.

The English copy explicitly states that opening the panel does not start Python, Blender or the
sidecar.

## Implementation

```text
src/components/Scene3DPilotDiagnosticsPanel.js
src/components/SettingsModal.js
src/lib/i18n.js
```

## Tests

```text
tests/scene3dPilotDiagnostics.test.js
```

QB-17 adds **8 tests** covering:

- valid enabled read-only status normalization,
- disabled/unavailable hidden behavior,
- authority escalation rejection,
- retry-semantics rejection,
- launch-mode allowlist,
- exact recipe allowlist,
- absence of execution/recovery methods and buttons,
- Settings-only diagnostics mounting,
- bilingual read-only copy.

The source test explicitly forbids use of:

```text
sceneInfo
objectInfo
dryRunRecipe
executeRecipe
pendingRecoveries
reconciliationHistory
reconcilePending
retryExecution
button creation
```

inside the diagnostics component.

## Validation

Focused gate:

```bash
node --test tests/scene3dPilotDiagnostics.test.js
```

Full repository gate remains:

```bash
node --test tests/*.test.js
npm run lint -- --max-warnings 10
npm run build:packages
npm run build
npm run vite:build
```

## Next phase

After QB-17 validation:

**QB-18 — User-Initiated Recovery Inspection**

Potential scope:

- explicit button to load pending recovery state,
- no automatic sidecar startup,
- read-only pending/reconciliation display,
- no reconciliation mutation,
- no recipe execution,
- no retries.

**QB-17 status: IMPLEMENTATION CANDIDATE — read-only and hidden unless pilot is explicitly enabled.**
