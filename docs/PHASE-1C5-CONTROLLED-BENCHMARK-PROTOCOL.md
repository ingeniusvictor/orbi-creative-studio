# ORBI Creative Studio — Phase 1C5 Controlled Benchmark Protocol

Status: benchmark evidence protocol candidate. No production resource profile is promoted by this phase.

## Purpose

Define a strict, deterministic protocol for turning repeated local runtime measurements into a reviewable resource-certification candidate.

P1C5 exists to close the evidence gap identified by P1C4 without inventing RAM/VRAM requirements and without allowing synthetic or accidental measurements to influence routing.

## Supported benchmark contexts

Initially supported backends remain:

- `cpu`
- `cuda12`

Every sample must bind exactly to:

- model ID;
- backend;
- width and height;
- harness version;
- exact source commit;
- runtime identity;
- runtime version;
- runtime binary SHA-256;
- model artifact SHA-256.

This makes a benchmark candidate specific to the exact measured runtime/model context rather than merely to a friendly model name.

## Sample requirements

Every sample uses schema version 1 and protocol version `p1c5-v1`.

A valid sample requires:

- unique positive run index;
- exact model/backend/resolution context;
- exact 40-character source commit;
- exact 64-character runtime binary SHA-256;
- exact 64-character model artifact SHA-256;
- exact ISO measurement timestamp;
- positive peak system RAM in MiB;
- for CUDA12, positive peak NVIDIA VRAM in MiB;
- for CPU, VRAM must be `null`.

Unknown or extra fields fail closed.

## Candidate requirements

`buildResourceCertificationCandidate()` requires at least 3 valid samples.

All samples must match the same benchmark context. Mixed runtime versions, binary hashes, model hashes, source commits, harness versions, backends, models, or resolutions are rejected.

Duplicate run indexes are rejected.

The function derives a conservative recommendation from:

1. the maximum observed peak system RAM;
2. the maximum observed peak VRAM for CUDA12;
3. an explicit safety margin between 0% and 100%;
4. upward rounding to whole MiB.

No percentile extrapolation, model-size inference, undocumented heuristic, or hardware guess is used.

## Deliberate non-promotion boundary

The P1C5 result is only a `benchmark-candidate`.

It explicitly reports:

- `requiresHumanCertification: true`
- `productionProfilePromoted: false`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

A benchmark candidate is intentionally incompatible with P1C4's `certified` production-profile schema and therefore cannot silently become routing evidence.

## Side-effect boundary

P1C5 is a pure evidence protocol. It does not:

- launch a model runtime;
- execute inference;
- read process memory itself;
- call `nvidia-smi`;
- read or write filesystem state;
- use IPC;
- access network services;
- access browser storage;
- download runtimes or models;
- modify provider readiness;
- modify ImageStudio or VideoStudio;
- authorize generation routing.

Real measurement instrumentation can feed this protocol in a later phase, but must preserve the exact evidence contract.

## Production state after P1C5

There are still **zero automatically promoted production resource profiles**.

P1C5 creates the deterministic evidence boundary needed before any controlled benchmark can be reviewed for promotion.

## Next step

P1C6 should add a bounded local measurement harness that can capture peak process/system RAM and, for CUDA12, NVIDIA VRAM for an explicitly selected model/runtime/resolution test run.

That harness should emit P1C5 samples only; it must not itself certify or promote production profiles.
