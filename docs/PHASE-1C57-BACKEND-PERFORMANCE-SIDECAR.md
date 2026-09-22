# P1C57 — Backend Performance Sidecar Evidence

## Purpose

P1C57 adds measured execution duration to controlled local benchmarks without changing the strict P1C5/P1C7 resource-evidence schemas.

The existing benchmark sample remains responsible for:

- model/backend/resolution identity;
- runtime/model hashes;
- peak system RAM;
- peak CUDA VRAM;
- review-only resource certification evidence.

Performance is emitted separately.

## Runtime duration

The Electron benchmark harness measures the controlled sd.cpp process with a monotonic clock.

The measurement begins immediately before spawning `sd-cli` and ends when the process closes.

Download time, model hashing and later evidence construction are not included.

The harness returns the internal scalar:

`runtimeDurationMs`

This scalar is not inserted into the P1C5 sample.

## Performance sidecar

After the existing benchmark result and auxiliary hashes have been validated, Electron main builds:

`p1c57-backend-performance-observation`

The sidecar is bound to the same:

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

It adds only:

`durationMs`

plus the existing non-authorizing benchmark flags.

## Compatibility

`p1c7-benchmark-run-evidence` remains unchanged.

The performance sidecar is returned beside `runEvidence`, not inside it. Existing strict resource-evidence validators therefore keep their exact schema and historical evidence remains valid.

## Privacy

The performance sidecar contains no:

- filesystem paths;
- GPU model names;
- device descriptions;
- exact backend device names;
- prompt content.

## Authority boundary

Performance observations are measurements only.

They are:

- benchmark-only;
- not production-profile promotion;
- not routing eligible;
- not cutover authorization;
- still under `legacy-dispatcher-only`.

Later phases may aggregate several P1C57 observations, but no single duration measurement may authorize routing.
