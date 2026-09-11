# ORBI Creative Studio — Local Runtime Provenance Policy

Status: implementation under validation on `security/runtime-provenance-pin`.

## Problem solved

The upstream local-inference downloader scans recent stable-diffusion.cpp releases and selects a matching asset dynamically.

That behavior makes the executable supply chain time-dependent:

- the same ORBI app version can download different binaries on different dates;
- a new upstream naming convention can silently change backend selection;
- no archive SHA-256 is enforced before extraction/execution.

The Windows selector already demonstrated this risk: the current release contains a valid `win-cpu-x64` asset, but the old matcher does not recognize that naming pattern and therefore selected CUDA 12.

## Pinned runtime release

Current reviewed stable-diffusion.cpp source line:

- release: `master-859-7f410a3`
- upstream commit: `7f410a3793c5bba8eb198e962ce7a3d6095f9d89`

## Default policy

### Windows x64

Default:

- CPU

Optional explicit backends:

- CUDA 12
- Vulkan
- ROCm

### Linux x64

Default:

- CPU/plain build

Optional:

- Vulkan
- ROCm

### macOS arm64

Default:

- Metal

The macOS Metal artifact remains the fixed upstream Open Generative AI runtime from `v1.0.3-binaries`, with its GitHub-published SHA-256 now recorded.

## Backend override

Implementation uses:

`OPEN_GENERATIVE_AI_SD_BACKEND`

Supported values:

- `auto`
- `cpu`
- `cuda12`
- `cuda` alias
- `vulkan`
- `rocm`
- `metal`

`auto` intentionally resolves to the conservative compatibility default for the platform.

Future ORBI UI hardware detection can set a preferred accelerator explicitly; the supply-chain manifest remains the same.

## Integrity enforcement

Before extraction, the downloaded runtime archive must pass exact SHA-256 verification.

If the hash differs:

1. archive is rejected,
2. downloaded file is removed,
3. extraction does not occur,
4. runtime is not executed,
5. user receives an integrity error.

## Known pinned assets

### Linux CPU

- archive SHA-256: `3f3e1a6b57a2e4d184aa9ea9ab916272ea92b4b79d5af667cad89d0a3edc2bc7`
- live download/hash certification: PASS

### Windows CPU

- archive SHA-256: `38c58cd603e39f91a63fb4c854db4af19c6a15b642d3982ab3c5b336b05c1855`
- live download/hash/execution certification: PASS

### Windows CUDA 12

- archive SHA-256: `b97beb83f471138d63d48354e006067a9d0e52fea47f6d20b3b45a3105062eb9`
- CLI execution certification: PASS

### macOS arm64 Metal

- archive SHA-256: `197c1254468cac17a00dce9256d683be43bf20ea202d3c2915debc05c6deaac0`

## Upgrade rule

Changing a runtime URL/hash/release is a security/provenance change.

A future update must:

1. identify the upstream source commit;
2. record release and exact asset;
3. record asset bytes and SHA-256;
4. execute the CLI on the relevant target;
5. run ORBI tests/builds;
6. update the manifest in a reviewed PR.

Do not reintroduce “latest” or recent-release scanning in production code.

## Hardware selection is separate from provenance

The manifest answers:

> Which exact bytes are allowed?

Hardware detection answers:

> Which allowed backend should this node run?

These responsibilities must remain separate.
