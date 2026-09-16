# ORBI Creative Studio — Phase 1C2 Local Compatibility Snapshot

Status: diagnostic compatibility contract candidate.

## Purpose

Combine existing P1C hardware facts with explicit runtime/model evidence and resource requirements to produce a fail-closed local compatibility assessment.

P1C2 does **not** route or execute generation.

## Existing evidence reused

P1C2 is intentionally built on already integrated components:

- Desktop hardware capability probe
- sanitized provider readiness hardware snapshot
- pinned sd.cpp runtime manifest
- local model installation state
- auxiliary model asset state

It does not duplicate those probes.

## Compatibility states

The evaluator returns one of:

- `COMPATIBILITY_CANDIDATE`
- `COMPATIBILITY_BLOCKED`
- `COMPATIBILITY_UNKNOWN`

A candidate is still diagnostic only.

Every result keeps:

- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Fail-closed evidence requirements

A compatibility candidate requires all of the following:

- local runtime exists
- runtime backend is recognized
- runtime selection is pinned to the manifest
- installed runtime provenance is explicitly verified
- requested model is installed
- required auxiliary assets are installed
- backend has matching observed hardware capability
- explicit system RAM requirement is satisfied
- explicit VRAM requirement is satisfied for CUDA

Missing evidence becomes `COMPATIBILITY_UNKNOWN`.

Explicit incompatibility becomes `COMPATIBILITY_BLOCKED`.

## Backend interpretation

- CPU requires platform/architecture evidence.
- CUDA 12 requires observed NVIDIA GPU capability.
- Vulkan requires observed Vulkan capability.
- ROCm requires observed ROCm capability.
- Metal remains unknown until a direct capability signal is added; platform alone is not treated as proof.

## Resource policy

P1C2 intentionally refuses to infer RAM or VRAM needs from model file size.

Resource requirements must be explicit metadata.

This avoids claiming that a downloaded model will run merely because its file fits on disk.

## Current gaps exposed by P1C2

The current repository does not yet provide both of the following as routing-grade evidence:

1. persistent verification that the installed extracted runtime is the pinned runtime;
2. curated per-model RAM/VRAM requirements.

Those gaps should be addressed before any local compatibility result is allowed to influence provider readiness.

## Security boundary

P1C2 is pure logic. It does not:

- access filesystem
- spawn commands
- access network
- use IPC
- use browser storage
- download runtimes/models
- mutate provider readiness
- route generation
- execute generation
- authorize cutover

## Next step

P1C3 should add installed runtime provenance evidence and model resource profiles, then feed the compatibility result into provider readiness in shadow/diagnostic mode only.
