# P1C54 — Effective Backend Activation Evidence

## Purpose

P1C54 distinguishes **runtime files installed** from **requested compute backend actually discoverable by the pinned sd.cpp runtime**.

A valid CUDA installation receipt is not sufficient evidence that CUDA loaded successfully. The same distinction applies to Vulkan, ROCm and Metal.

## Probe contract

The exact pinned stable-diffusion.cpp commit supports:

`sd-cli --list-devices`

and documents the output as one:

`name<TAB>description`

record per available GGML backend device.

P1C54 executes this read-only probe only after pinned runtime installation integrity has already passed.

## Backend matching

The selected ORBI runtime backend must expose a corresponding device family:

- `cpu` → `CPU`
- `cuda12` → `CUDA0`, `CUDA1`, …
- `vulkan` → `Vulkan0`, …
- `rocm` → `ROCm0` / `HIP0`, …
- `metal` → `Metal`

If the expected family is absent, readiness fails closed with:

`EXPECTED_BACKEND_DEVICE_NOT_FOUND`

## Privacy

The Electron main process may retain the parsed device list transiently for the probe result.

Renderer/provider readiness receives only:

`backendActivationVerified: boolean`

No GPU model, description or device name is exported to renderer diagnostics.

## Security boundary

P1C54:

- does not run a model;
- does not perform generation;
- does not alter backend selection;
- does not download anything;
- does not execute the probe before installation integrity succeeds;
- does not expose hardware-identifying device strings to the renderer.
