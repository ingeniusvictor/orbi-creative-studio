# ORBI Creative Studio — Phase 1B.10 Session Parity Evidence

Status: stacked on P1B.9. In-memory observation only. No persistence, no cutover.

## Purpose

Collect P1B.8 shadow reports during the current renderer session and feed them into the P1B.9 certification ledger.

The collector lives at:

`src/lib/computeRouter/paritySession.mjs`

It is started once from `src/main.js`.

## Data flow

1. P1B.8 emits local event:
   `orbi:compute-router-shadow`
2. P1B.10 listens for that event.
3. The report is validated and normalized by P1B.9.
4. Sanitized routing evidence is retained only in memory.
5. Internal code can request:
   - evidence snapshot
   - certification evaluation
   - evidence clear

## Singleton lifecycle

The session collector is idempotent:

- first start attaches one listener;
- repeated starts do not add duplicate listeners;
- stop removes the listener;
- clear removes evidence but does not stop collection.

The renderer bootstrap calls `startStudioParitySessionCollector()` exactly once.

## Fail-soft behavior

Invalid or malformed shadow events are ignored.

A bad diagnostic event must not:

- throw into Studio execution;
- stop generation;
- alter provider selection;
- corrupt valid evidence already collected.

## Privacy

The session ledger stores only the P1B.9 normalized evidence fields:

- expected provider ID
- selected provider ID
- operation
- model ID
- parity
- observation timestamp
- route key

It does not retain prompt/media/API-key/payload fields.

## No persistence

P1B.10 deliberately does not use:

- `localStorage`
- `sessionStorage`
- IndexedDB
- filesystem
- cloud APIs
- analytics/telemetry

Closing or reloading the renderer discards the evidence.

This is intentional until the evidence format and certification behavior are proven under CI and real use.

## No public/global API

The collector does not attach a parity object to `window` or `globalThis`.

Evidence access remains module-internal so it cannot be mistaken for a production execution-control API.

## Scope boundary

P1B.10 does **not**:

- change ImageStudio dispatch
- change VideoStudio dispatch
- authorize cutover
- auto-enable fallback
- persist certification state
- execute providers
- send telemetry

A later phase may add an explicit diagnostic/export surface after this session-only behavior is certified.

## Merge gate

Keep stacked until P1B.3–P1B.9 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no steps/logs.
