# P1C14 — Read-only Shadow Compatibility Evidence Collector

## Purpose

P1C14 adds a renderer-side collector that retrieves only the sanitized Compute Router readiness snapshot already exposed by Electron and converts the exact target model/backend/resolution facts into evidence suitable for P1C13.

It does not create a new hardware probe, runtime probe, IPC channel, generation path, or publication path.

## Existing source reused

The collector resolves only:

- `window.orbiComputeRouter`
- `orbiComputeRouter.getReadinessSnapshot()`

That preload bridge already maps to `compute-router:readiness-snapshot`, whose Electron main implementation gathers and sanitizes:

- sd.cpp binary/runtime readiness;
- sd.cpp model states;
- auxiliary model states;
- hardware capability facts.

P1C14 does not access `window.localAI`, provider credentials, MuAPI transport, raw filesystem paths, or raw hardware command output.

## Exact target context

The collector requires:

- safe `modelId`;
- certifiable backend (`cpu` or `cuda12` in this phase);
- positive integer width;
- positive integer height.

It selects exactly one matching sd.cpp model evidence entry. Missing, duplicate, or malformed target evidence fails closed.

When an installed runtime is present, its reported backend must match the requested backend exactly. A missing runtime may still be represented as evidence so downstream compatibility can report `RUNTIME_MISSING` rather than inventing readiness.

## Sanitized evidence output

A successful collection returns a frozen `p1c14-shadow-compatibility-evidence` object containing only:

- capture timestamp;
- exact target context;
- runtime existence/backend/pinning/integrity facts;
- target model state;
- required auxiliary states for that target model;
- already-sanitized hardware facts needed by compatibility evaluation;
- immutable authority boundaries.

It does not carry:

- model paths;
- GPU names;
- raw probe output;
- Wan2GP evidence;
- MuAPI credential or transport evidence;
- secrets;
- reviewer/certification provenance;
- generation parameters.

## Failure model

P1C14 returns stable reason codes and does not reflect arbitrary exception text from bridge resolution, readiness collection, or clock failures.

Representative failures include:

- `COLLECTOR_BRIDGE_UNAVAILABLE`
- `COLLECTOR_READINESS_FAILED`
- `COLLECTOR_SNAPSHOT_INVALID`
- `COLLECTOR_RUNTIME_EVIDENCE_MISSING`
- `COLLECTOR_RUNTIME_BACKEND_MISMATCH`
- `COLLECTOR_MODEL_EVIDENCE_NOT_FOUND`
- `COLLECTOR_MODEL_EVIDENCE_DUPLICATE`
- `COLLECTOR_CLOCK_INVALID`

## Non-goals

P1C14 does not:

- publish to P1C12;
- call P1C13 automatically;
- execute generation;
- change provider readiness;
- select a provider;
- start background polling;
- write to filesystem/browser storage/database;
- add or widen Electron IPC.

## Authority boundary

Every collector result preserves:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next

P1C15 may explicitly compose P1C14 collection with P1C13 production/publication, still behind a diagnostic-only invocation boundary and still outside Image Studio, Video Studio, startup auto-routing, provider selection, or cutover.
