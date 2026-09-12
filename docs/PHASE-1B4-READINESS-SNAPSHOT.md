# ORBI Creative Studio — Phase 1B.4 Electron Readiness Snapshot (Preparation)

Status: implementation prepared on top of P1B.3. **No Studio generation routing changes.**

## Purpose

Expose one read-only, sanitized Electron snapshot that contains the evidence required by the Compute Router readiness composition layer.

The snapshot does not choose a provider and does not execute a generation.

## Snapshot contents

### Hardware
Collected with the asynchronous hardware capability probe:
- platform / architecture
- CPU facts
- RAM facts
- NVIDIA / reported VRAM
- CUDA toolkit visibility
- Vulkan visibility
- ROCm visibility

The async probe launches fixed allowlisted checks in parallel and does not use a shell.

### sd.cpp
Only routing facts are returned:
- binary exists
- pinned runtime identity metadata
- model IDs
- model state
- auxiliary requirement/state

Not returned:
- binary path
- model path
- data directory
- download URL
- model hash
- environment variable values

### Wan2GP
Returned:
- configured URL
- one probe result
- model IDs and ready/unavailable facts

The same probe result is reused to derive model readiness so one snapshot does not probe the server twice.

### MuAPI
Returned:
- secure credential readiness only

Not returned:
- provider secret
- encrypted payload
- filesystem/keychain details

`transportHealth` is intentionally null. P1B.4 does not call MuAPI merely to determine health because ORBI must not introduce an accidental billable or cloud-dependent readiness check.

## Error isolation

Each evidence source is captured independently.

If hardware, local models, Wan2GP, or credential storage fails:
- the snapshot still returns the other sources;
- the failing source becomes null/unknown;
- only a source name + bounded error code is returned;
- raw internal error messages are suppressed.

## IPC boundary

Preload exposes exactly:

`window.orbiComputeRouter.getReadinessSnapshot()`

The main-process handler reuses the existing trusted-main-frame/file-origin sender policy.

No arbitrary command, network destination, provider secret, file path, or generation operation is exposed.

## Hardware non-blocking rule

The original synchronous capability probe remains for compatibility/tests, but P1B.4 uses the new async-parallel probe so readiness capture does not intentionally block Electron's main process while external tooling is checked.

## Dependency order

P1B.4 depends on:
1. P1B.2 provider adapters;
2. P1B.3 readiness composition.

Because GitHub Actions stopped allocating runners during preparation, this branch is intentionally non-mergeable until:
- P1B.3 is certified/merged;
- P1B.4 is recreated cleanly from canonical integration;
- dedicated CI is green;
- global foundation certification is green.
