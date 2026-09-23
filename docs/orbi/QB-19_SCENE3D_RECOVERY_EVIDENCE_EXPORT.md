# QB-19 — Scene3D Recovery Evidence Export

Status: **IMPLEMENTATION CANDIDATE — USER-INITIATED — READ-ONLY HANDOFF**

## Dependency

QB-19 is stacked on QB-18 and inherits the full QB-12 → QB-18 certification chain.

QB-18 parent evidence before QB-19:

- syntax: GREEN
- lint: GREEN
- root tests: GREEN
- workspaces build: GREEN
- Next build: GREEN
- Electron renderer build: GREEN
- production dependency security gate: GREEN

QB-19 must remain draft until the lab dependency chain and cross-host smoke are certified.

## Purpose

QB-19 creates a governed handoff artifact for uncertain Scene3D recovery state without granting
the renderer recovery authority.

The product may export evidence for a human/operator, but it still cannot:

- retry execution,
- reconcile pending state,
- release a request id,
- execute a recipe,
- configure provider/ledger/Python,
- choose an arbitrary output path programmatically.

## Main-owned capture

Renderer API:

```text
window.orbiScene3D.exportRecoveryEvidence()
```

takes **no arguments**.

Electron main captures a fresh snapshot by calling:

```text
pending_recoveries
reconciliation_history
```

through the existing QB-16 sidecar client.

Electron main also owns `capturedAt`.

The renderer cannot provide:

- recovery records,
- request fingerprints,
- evidence,
- provider metadata,
- destination path,
- timestamps.

## Export bundle

Evidence type:

```text
orbi-scene3d-recovery-handoff
```

The bundle contains only:

- capture timestamp,
- minimal pending execution records,
- minimal reconciliation records,
- operator-review requirement,
- explicit privacy claims,
- explicit non-authority claims.

Pending records retain:

- sequence,
- request id,
- operation,
- outcome = pending,
- provider-called = null,
- replay-reserved = true.

Reconciliation records retain:

- reconciliation sequence,
- request id,
- resolution,
- actor,
- final/non-final,
- reservation-released = false.

## Privacy boundary

The serializer excludes:

- provider metadata,
- Qwen identity,
- request fingerprint,
- raw reconciliation evidence,
- evidence SHA-256,
- retry semantics,
- SQLite/ledger paths,
- Python paths,
- generated Python/provider tool names,
- renderer-injected unrelated fields.

The export explicitly declares:

```text
providerMetadataIncluded = false
requestFingerprintIncluded = false
rawEvidenceIncluded = false
localPathsIncluded = false
```

## Authority boundary

Every bundle/result declares:

```text
readOnly = true
executionAuthorized = false
retryAuthorized = false
reconciliationAuthorized = false
requestIdReleaseAuthorized = false
productionCutoverAuthorized = false
```

## File export

The implementation reuses the security pattern already proven by P1C63:

1. validate + whitelist serializer,
2. Electron-main save dialog,
3. reject existing destination,
4. temporary file with `flag: 'wx'`,
5. hard-link promotion,
6. delete temporary file,
7. SHA-256 verification,
8. delete destination on hash mismatch.

No overwrite is allowed.

Renderer receives only:

- status,
- basename,
- SHA-256,
- bytes,
- non-authority flags.

The full destination path is never returned.

## UI behavior

QB-19 extends the QB-18 recovery panel.

The export button is initially disabled.

It becomes available only after the user explicitly loads recovery state and both pending/history
payloads validate.

Every new recovery reload first revokes export readiness. This prevents exporting stale prior state
after a failed refresh.

The export action itself is a second explicit click.

## Implementation

```text
electron/lib/scene3dRecoveryExportCore.js
electron/lib/scene3dRecoveryFileExport.js
electron/lib/scene3dPilotBridge.js
electron/preload.js
src/components/Scene3DRecoveryInspectionPanel.js
src/lib/i18n.js
```

## Tests

New suites:

```text
tests/scene3dRecoveryExportCore.test.js
tests/scene3dRecoveryFileExport.test.js
tests/scene3dRecoveryExportBridge.test.js
tests/scene3dRecoveryExportUi.test.js
```

QB-19 adds **28 tests**:

- 9 serializer/export-plan tests,
- 5 file-export tests,
- 5 main/preload bridge tests,
- 9 UI boundary tests.

They validate:

- deterministic SHA-256,
- privacy whitelist,
- authority denial,
- invalid pending/reconciliation rejection,
- create-only no-overwrite file behavior,
- hash mismatch cleanup,
- basename-only renderer result,
- no-argument renderer request,
- main-owned fresh recovery capture,
- main-owned timestamp,
- source-unavailable rejection,
- export disabled before validated recovery inspection,
- stale-export revocation on reload,
- path-free UI,
- bilingual export copy.

## Validation

Focused:

```bash
node --test \
  tests/scene3dRecoveryExportCore.test.js \
  tests/scene3dRecoveryFileExport.test.js \
  tests/scene3dRecoveryExportBridge.test.js \
  tests/scene3dRecoveryExportUi.test.js
```

Canonical validation remains the full Integrated Gate.

## Next safe phase

After QB-19 is GREEN, further product authority should still remain constrained.

Recommended:

**QB-20 — Recovery Handoff Integrity / Operator Import Contract**

Potential scope:

- validate a QB-19 exported artifact before operator use,
- checksum verification,
- schema/version validation,
- no automatic reconciliation,
- produce an operator command preview for QB-13,
- no execution/retry authority.

**QB-19 status: IMPLEMENTATION CANDIDATE — governed evidence export only.**
