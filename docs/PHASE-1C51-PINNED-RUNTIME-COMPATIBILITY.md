# P1C51 — Pinned Runtime Compatibility Hardening

## Purpose

P1C51 aligns ORBI local inference with the exact pinned stable-diffusion.cpp runtime currently declared in `runtimeManifest.js`.

The pinned upstream commit is:

`7f410a3793c5bba8eb198e962ce7a3d6095f9d89`

## Findings

Three compatibility gaps were confirmed against that exact runtime:

1. Packaged runtime staging copied only a narrow allowlist, risking omission of ggml/backend/shared-library files.
2. ORBI still passed `--sd-version` and `--flux`, which are absent from the pinned CLI and are no longer required because architecture is detected from model metadata / checkpoint form.
3. SDXL used `dpmpp2m`, while the pinned runtime's `sample_method_to_str[]` defines the exact accepted token as `dpm++2m`.

## Changes

### Complete runtime staging

`stage-local-ai-binary.js` now copies the entire runtime tree from the resolved source directory instead of only `sd-cli` plus a short allowlist.

Windows staging now requires both:

- `sd-cli.exe`
- `stable-diffusion.dll`

This prevents creating a package that contains the executable but omits runtime libraries such as ggml/backend DLLs.

### Current CLI contract

ORBI no longer appends:

- `--sd-version sdxl`
- `--sd-version sd2`
- `--flux`

Flux/Z-Image continue to use `--diffusion-model` where appropriate.

### Exact sampler identifier

SDXL now uses:

`dpm++2m`

matching the pinned runtime source exactly.

## Provenance

The packaging concern was independently confirmed while reviewing upstream Open-Generative-AI PR #313. ORBI selectively adapted only the parts compatible with its pinned-runtime architecture.

The CLI and sampler behavior were verified directly against the pinned leejet/stable-diffusion.cpp source, not merely copied from the external PR.

## Deferred CUDA companion work

The pinned Windows CUDA12 release also publishes a separate `cudart-sd-bin-win-cu12-x64.zip` companion asset. Installing and evidencing that companion is intentionally handled separately in P1C52 so download/integrity logic is not mixed with packaging and CLI compatibility changes.
