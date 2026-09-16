# P1C12 — Governed Shadow Snapshot Handoff

## Purpose

P1C12 adds a narrow in-memory handoff between already-sanitized P1C10 shadow compatibility snapshots and the P1C11 Router Diagnostics view.

The handoff is deliberately **not** a producer. It does not benchmark, query the registry, probe hardware, route generation, or access provider execution.

## Handoff contract

`createShadowCompatibilitySnapshotHandoff()` exposes only:

- `publish(snapshot)`
- `read()`
- immutable authority-boundary metadata.

A publication is accepted only when `validateShadowCompatibilitySnapshot()` accepts the exact P1C10 shape.

The handoff deep-copies and freezes the accepted snapshot before storing it, so later mutation of the caller-owned object cannot change diagnostics evidence.

## Ordering rules

The handoff uses the validated `capturedAt` timestamp to prevent accidental rollback:

- newer snapshot: accepted;
- identical timestamp + identical content: idempotent / unchanged;
- older snapshot: rejected as stale;
- identical timestamp + different content: rejected as conflict.

No arbitrary overwrite API or clear/reset control is exposed to product UI.

## UI connection

Settings passes only `readShadowCompatibilitySnapshot` to `RouterDiagnosticsPanel` as a provider.

Router Diagnostics resolves the provider each time its existing **Refresh** action renders, so a future governed producer can publish a newer sanitized snapshot without adding another UI action.

P1C12 does not connect `publishShadowCompatibilitySnapshot` to:

- `main.js`;
- Image Studio;
- Video Studio;
- provider readiness;
- local generation;
- routing;
- cutover.

Therefore the production UI normally remains in the neutral “no validated snapshot” state until a later explicitly governed producer phase is implemented.

## Storage and transport boundary

P1C12 uses module memory only. It has no:

- filesystem access;
- browser storage;
- database access;
- fetch/network access;
- Electron IPC;
- timers/background polling.

## Authority boundary

Every handoff result preserves:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next

P1C13 may define an **explicit diagnostic snapshot producer** that derives a P1C10 snapshot from the already-governed P1C9 registry plus current readiness/hardware evidence. It must publish only through this P1C12 handoff and must remain off the generation/execution path.
