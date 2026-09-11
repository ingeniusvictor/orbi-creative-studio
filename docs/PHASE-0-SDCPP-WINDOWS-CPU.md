# ORBI Creative Studio — Phase 0 sd.cpp Windows CPU Certification

Certification date: 2026-09-11

Run:

`34655979916`

## Result

**PASS**

The generic Windows x64 CPU build from stable-diffusion.cpp release `master-859-7f410a3` was downloaded, hash-verified and executed successfully on a clean Windows runner.

Asset:

- `sd-master-7f410a3-bin-win-cpu-x64.zip`
- archive SHA-256: `38c58cd603e39f91a63fb4c854db4af19c6a15b642d3982ab3c5b336b05c1855`

Extracted CLI:

- `sd-cli.exe`
- size: `651,264` bytes
- SHA-256: `12c1c055f76d8c6c52db13d5e0e2b8c6f2f5fdc125fc499f5da8759e3b7a56a7`

Execution:

```
stable-diffusion.cpp version unknown, commit 7f410a3
Usage: sd-cli.exe [options]
SDCPP_WINDOWS_CPU_EXECUTION_PASS
```

## Conclusion

The Windows CPU artifact is a valid compatibility fallback.

ORBI can therefore separate runtime selection into:

- CPU — universal compatibility baseline,
- CUDA 12 — NVIDIA acceleration,
- Vulkan — cross-vendor acceleration where tested,
- ROCm — AMD acceleration where tested.

The upstream selector currently misses the new `win-cpu-x64` naming pattern, so ORBI should replace dynamic release scanning with a pinned runtime manifest and explicit backend selection.
