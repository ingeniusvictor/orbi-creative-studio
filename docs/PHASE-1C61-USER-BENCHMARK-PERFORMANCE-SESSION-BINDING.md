# P1C61 — User Benchmark Performance Session Binding

## Purpose

P1C61 closes the gap between the real controlled benchmark bridge and the user benchmark session.

Since P1C57, Electron main returns a detached performance sidecar for every successful controlled sample:

`p1c57-backend-performance-observation`

Before P1C61, the renderer-side P1C21 session retained only:

- P1C7 run evidence;
- P1C31 provenance.

The performance sidecar was validated in Electron main but then discarded by the user session.

## Behavior

P1C61 adds a separate in-memory performance store keyed by the same exact target:

`modelId::backend::widthxheight`

A real benchmark result with P1C31 provenance must now also include a P1C57 sidecar that exactly matches the P1C7 sample context:

- protocol;
- run index;
- model;
- backend;
- resolution;
- harness version;
- source commit;
- runtime identity/version/hash;
- model hash;
- auxiliary hashes;
- measurement timestamp.

The duration must be positive and finite.

## Atomic rejection

If real provenance exists but the performance sidecar is:

- missing;
- malformed;
- context-mismatched;
- authority-forged;

the capture is rejected before any of these are stored:

- P1C7 run evidence;
- P1C31 provenance;
- P1C57 performance evidence.

## Historical compatibility

Legacy/fixture-shaped benchmark responses without real P1C31 provenance may continue to omit P1C57 performance evidence.

This preserves deterministic unit-test fixtures without upgrading them into real performance evidence.

## Schema preservation

P1C61 does not insert duration into the strict P1C7 envelope.

The P1C7 resource evidence remains unchanged.

Performance remains detached and accessible through:

`readPerformance(target)`

or the default exported reader:

`readUserBenchmarkSessionPerformance(target)`

## Authority boundary

The new store is:

- in-memory only;
- benchmark-only;
- non-promoting;
- non-routing;
- non-cutover;
- still under `legacy-dispatcher-only`.

P1C61 does not persist files, modify the runtime registry, or route generation.

## Next

With real P1C57 observations now retained through the user session, a later phase can export a governed hardware-pilot evidence bundle without losing performance data.
