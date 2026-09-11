# ORBI Creative Studio — Phase 0 sd.cpp Windows Certification

Certification date: 2026-09-11

Run:

`34654968455`

## Result

**PASS — upstream-selected Windows x64 runtime downloads and executes**

The pinned upstream selector resolved the current release:

- release tag: `master-859-7f410a3`
- upstream commit: `7f410a3`

Selected asset:

- `sd-master-7f410a3-bin-win-cuda12-x64.zip`
- asset ID: `557971750`
- archive size: `336,517,170` bytes
- archive SHA-256: `b97beb83f471138d63d48354e006067a9d0e52fea47f6d20b3b45a3105062eb9`

Extracted CLI:

- `sd-cli.exe`
- size: `651,264` bytes
- SHA-256: `e0eec4bfa8f9582a71717fc14c5cf31224f4c4bc3f794fd773cd708a2fb88b38`

Execution:

```
stable-diffusion.cpp version unknown, commit 7f410a3
Usage: sd-cli.exe [options]
SDCPP_WINDOWS_BINARY_EXECUTION_PASS
```

## Selector defect discovered

The same current stable-diffusion.cpp release also ships:

- `sd-master-7f410a3-bin-win-cpu-x64.zip`
- `sd-master-7f410a3-bin-win-vulkan-x64.zip`
- `sd-master-7f410a3-bin-win-rocm-7.14.0-x64.zip`
- CUDA 12 variants

However, the upstream selector regex recognizes older Windows tags such as:

- `win-avx2-x64`
- `win-avx-x64`
- `win-noavx-x64`
- `win-cuda12-x64`

It does **not** currently match the new generic:

`win-cpu-x64`

Therefore the selector skipped the available CPU build and chose CUDA 12.

## ORBI implication

ORBI should not blindly inherit this selector.

The target design should:

1. pin a reviewed stable-diffusion.cpp release;
2. maintain explicit CPU/CUDA/Vulkan/ROCm variants;
3. detect host capability;
4. always retain a CPU-compatible fallback where supported;
5. verify archive SHA-256 before extraction;
6. expose selected runtime/backend in diagnostics.

A separate CPU asset execution certification is the next gate before implementing this policy.
