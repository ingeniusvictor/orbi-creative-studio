# QB-18 — User-Initiated Scene3D Recovery Inspection

Status: **IMPLEMENTATION CANDIDATE — READ-ONLY — EXPLICIT USER ACTION**

## Dependency

QB-18 is stacked on QB-17 and inherits the full QB-12 → QB-17 dependency chain.

It must not be merged before those phases are certified.

## Purpose

QB-18 adds the first recovery-data view for the Scene3D pilot.

The critical rule is:

> Recovery state is never loaded automatically.

Opening Settings may call only the local QB-16 `getStatus()` path. That call does not start the
sidecar.

Only an explicit click on:

```text
Load recovery state
```

may invoke:

```text
pendingRecoveries()
reconciliationHistory()
```

This user action may start the local QB-15 sidecar because WSL/native SQLite inspection is performed
through the provider-neutral stdio process.

## Authority boundary

QB-18 can only inspect sanitized recovery evidence.

It cannot:

- execute a recipe,
- dry-run a recipe,
- read Blender scene/object state,
- retry an execution,
- release a request id,
- reconcile pending state,
- configure a provider,
- configure the ledger,
- execute Python,
- execute Blender code.

## Visibility

The recovery panel is hidden unless QB-16 status confirms:

- pilot enabled,
- default-OFF contract intact,
- renderer cannot configure,
- R2 automatic retry disabled,
- reconciliation mutation disabled.

The panel is mounted under the existing Scene3D read-only diagnostics inside the Settings
Diagnostics tab.

## User-initiated loading

The component performs only a status read during initialization.

Recovery providers are invoked exclusively inside the load button's `onclick` handler.

A loading guard prevents overlapping inspection requests from one panel instance.

## Pending normalization

Only genuinely uncertain durable executions are accepted:

```text
outcome = pending
provider_called = null
replay_reserved = true
```

The renderer model retains only:

- execution sequence,
- request id,
- operation,
- pending outcome,
- provider-called unknown state.

It drops fields such as:

- request fingerprint,
- provider metadata,
- retry semantics,
- internal risk/provenance details.

## Reconciliation-history normalization

Accepted resolutions are exactly:

```text
applied
not_applied
inconclusive
```

A reconciliation record is rejected if it claims:

```text
reservation_released = true
```

The UI retains only:

- reconciliation sequence,
- request id,
- resolution,
- actor,
- final/non-final state.

It does not render:

- evidence body,
- evidence SHA-256,
- request fingerprint,
- provider metadata,
- retry semantics.

## Rendering safety

All dynamic recovery data is written through `textContent`.

The component does not use dynamic HTML templates or `insertAdjacentHTML` for recovery data.

## Bilingual copy

English and Chinese copy explicitly states:

- recovery is loaded only after a click,
- loading may start the sidecar,
- the panel cannot retry or reconcile an execution,
- the displayed state is read-only.

## Implementation

```text
src/components/Scene3DRecoveryInspectionPanel.js
src/components/SettingsModal.js
src/lib/i18n.js
```

## Tests

```text
tests/scene3dRecoveryInspection.test.js
```

QB-18 adds **10 tests** covering:

- read-only feature-status validation,
- minimal pending model,
- rejection of non-pending/known-call state,
- evidence/fingerprint stripping,
- exact QB-13 resolution allowlist,
- permanent reservation requirement,
- explicit click-triggered loading,
- absence of execution/mutation methods,
- textContent-only recovery rendering,
- Settings mounting without direct privileged calls,
- bilingual boundary copy.

## Validation

Focused:

```bash
node --test tests/scene3dRecoveryInspection.test.js
```

Full repository validation remains the canonical Integrated Gate:

```bash
node --test tests/*.test.js
npm run lint -- --max-warnings 10
npm run build:packages
npm run build
npm run vite:build
```

## Next safe phase

After QB-18 is GREEN, the next useful phase should not add execution controls yet.

Recommended:

**QB-19 — Recovery Evidence Export / Operator Handoff**

Scope:

- user-initiated export of sanitized pending/reconciliation evidence,
- governed save dialog in Electron main,
- no renderer-selected arbitrary path,
- no overwrite,
- SHA-256 verified export,
- no reconciliation mutation,
- no retry,
- no execution.

That would let the operator move from read-only UI evidence to the QB-13 reconciliation tool
without granting the product reconciliation authority.

**QB-18 status: IMPLEMENTATION CANDIDATE — recovery inspection remains read-only and explicitly user initiated.**
