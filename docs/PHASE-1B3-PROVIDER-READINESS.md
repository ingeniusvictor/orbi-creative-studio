# ORBI Creative Studio — Phase 1B.3 Provider Readiness Composition

Status: pure readiness composition candidate. No Studio/provider execution wiring.

Related: ARCH-01 (#4), ARCH-03 (#23).

## Purpose

Turn runtime evidence already produced by ORBI into safe Compute Router provider states.

This layer does not probe anything itself. It receives snapshots and returns provider descriptors.

## sd.cpp readiness

Inputs:
- binary status
- model status
- auxiliary asset status
- sanitized hardware snapshot

Rules:
- no binary evidence → `unknown`
- binary missing → `misconfigured`
- binary present but no model evidence → `unknown`
- binary present but no fully usable installed model → `misconfigured`
- one or more usable installed models → `ready`
- only installed/auxiliary-complete models remain selectable

For Z-Image models, auxiliary LLM/VAE state must be downloaded when the model declares auxiliary requirements.

A runtime-reported model ID that no longer exists in the catalog fails closed to `misconfigured`.

## Wan2GP readiness

Inputs:
- configuration-present evidence (`configured: true`) or legacy configured URL
- probe result
- per-model readiness

Rules:
- no config evidence → `unknown`
- explicit unconfigured/empty URL → `misconfigured`
- `configured: true` may be used by a narrow bridge so the LAN endpoint itself does not need to cross IPC
- configured server probe fails → `offline`
- server reachable but model evidence absent → `unknown`
- server reachable but zero usable mapped models → `misconfigured`
- server reachable with one or more ready models → `ready`
- only ready models remain selectable

## MuAPI readiness

Two independent facts are preserved:

1. secure credential readiness
2. transport/service health

Credential is `available` only when:
- secure storage is available,
- backend is secure,
- secret exists,
- store is not corrupt.

Cloud health:
- explicit healthy evidence → `ready`
- explicit failed evidence → `offline`
- no evidence → `unknown`

A stored key alone does not mark cloud execution ready.

## Hardware sanitization

The raw desktop probe is reduced to routing-safe facts:
- platform / architecture
- CPU model / logical cores
- total / free RAM
- NVIDIA presence / max reported VRAM
- CUDA toolkit visibility/version
- Vulkan visibility
- ROCm visibility

Raw probe output and unrelated fields are not propagated.

## Safety properties

- no IPC
- no network
- no child processes
- no storage access
- no generation
- no automatic cloud fallback
- stale model identities fail closed
- unknown evidence remains unknown

## Next step

After P1B.3 is certified and merged, add a narrow Electron readiness snapshot bridge that gathers the already-existing status calls and returns sanitized data.

That bridge should still not execute generation. Studio routing integration comes only after parity evidence.
