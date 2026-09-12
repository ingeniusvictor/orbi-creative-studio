# ORBI Creative Studio — Phase 1C Desktop Hardware Capability Probe

Status: read-only capability probe candidate.

Related: #19 and #4.

## Purpose

Measure desktop execution facts that the Compute Router can later consume. This layer reports observed capability only; it does not select a model, choose a provider, or launch inference.

## Facts reported

Base node facts:

- OS platform
- CPU architecture
- CPU model
- logical core count
- nominal CPU speed
- total RAM
- currently free RAM

Accelerator/tooling facts:

- NVIDIA GPU visibility through `nvidia-smi`
- NVIDIA GPU names, reported VRAM and driver version
- CUDA toolkit visibility/version through `nvcc`
- Vulkan tooling/runtime visibility through `vulkaninfo --summary`
- ROCm visibility through `rocminfo`

Absence of a command is reported as unavailable, not treated as a fatal error.

## Security model

The probe uses a fixed internal command allowlist only:

- `nvidia-smi`
- `nvcc`
- `vulkaninfo`
- `rocminfo`

It does not:

- accept command names or arguments from the user,
- use a shell,
- interpolate arbitrary strings,
- modify system configuration,
- install drivers,
- download runtimes,
- elevate privileges.

Each process has a bounded timeout and output buffer.

## Interpretation rules

The probe intentionally distinguishes facts from conclusions.

Examples:

- an NVIDIA driver being visible does not prove that a specific sd.cpp CUDA build is installed;
- `nvcc` being present means CUDA toolkit tooling is visible, not that every CUDA model/runtime will work;
- Vulkan tooling being visible does not guarantee model compatibility;
- total RAM alone must never be used to claim GPU or backend support.

Runtime selection belongs to a later compatibility layer.

## Current non-goals

- no UI
- no preload/renderer command bridge
- no runtime selection
- no model download
- no generation
- no automatic driver changes
- no telemetry upload

## Next step

After certification, expose a sanitized capability snapshot to the Compute Router/provider readiness layer and combine it with installed runtime/model provenance.
