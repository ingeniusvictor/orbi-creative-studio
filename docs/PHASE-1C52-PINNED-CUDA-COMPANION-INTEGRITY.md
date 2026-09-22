# P1C52 — Pinned CUDA12 Companion Integrity

## Purpose

P1C52 fixes Windows CUDA12 local inference without weakening ORBI's pinned-runtime trust model.

The certified stable-diffusion.cpp release `master-859-7f410a3` publishes CUDA12 as two artifacts:

1. `sd-master-7f410a3-bin-win-cuda12-x64.zip`
2. `cudart-sd-bin-win-cu12-x64.zip`

The second artifact supplies the CUDA runtime DLLs required by the CUDA backend.

## Official companion identity

- Asset: `cudart-sd-bin-win-cu12-x64.zip`
- Size: `563452046` bytes
- SHA-256: `fe20366827d357c00797eebb58244dddab7fd9a348d70090c3871004c320f38d`
- Source release: `leejet/stable-diffusion.cpp master-859-7f410a3`

Required installed files:

- `cudart64_12.dll`
- `cublas64_12.dll`
- `cublasLt64_12.dll`

## Installation flow

P1C52 changes the pinned download path to:

1. download the primary runtime archive into ORBI temp storage;
2. verify its manifest SHA-256;
3. extract into a temporary directory;
4. promote the complete runtime directory beside `sd-cli.exe`;
5. download each manifest-declared companion;
6. verify the companion SHA-256 before extraction;
7. extract in temporary storage;
8. locate and copy every required DLL beside `sd-cli.exe`;
9. record the primary archive, companion archive and installed support-file hashes;
10. re-inspect the completed installation before declaring success.

An existing runtime does not short-circuit the pinned repair path when the user requests a download/reinstall.

## Evidence

For runtimes with companions, `.orbi-runtime-installation.json` now binds:

- primary archive identity;
- binary SHA-256;
- companion asset identity;
- companion archive SHA-256;
- each required support filename;
- each installed support-file SHA-256.

A missing or modified CUDA DLL makes `integrityVerified` false.

## Failure behavior

P1C52 fails closed when:

- companion metadata is invalid;
- archive digest differs from the manifest;
- a required DLL is absent from the verified archive;
- a support file is missing after installation;
- a support file changes after receipt creation;
- a CUDA receipt is attempted without verified companion evidence.

## Provenance

The missing-CUDA-runtime failure mode was identified while reviewing Open-Generative-AI PR #313. ORBI did not adopt that PR's dynamic release selection. Instead, the companion asset was independently verified against the exact release already pinned by ORBI and incorporated into the existing manifest/integrity architecture.
