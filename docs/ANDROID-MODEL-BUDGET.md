# ORBI Creative Studio — Android / POCO Local Model Budget

Status: feasibility planning based on exact Phase 0 remote asset metadata.

This document estimates **weight-file footprint only**. It is not a RAM benchmark.

## Exact local asset sizes

Verified through Hugging Face LFS metadata on 2026-09-11.

### Z-Image Turbo stack

Required baseline assets:

- Z-Image Turbo Q4_K: 3,864,250,304 bytes
- Qwen3 4B text encoder: 2,546,340,960 bytes
- VAE: 335,304,388 bytes

Total weight bytes:

**6,745,895,652 bytes**

Approximately:

- 6.746 GB decimal
- 6.283 GiB binary

### Z-Image Base stack

- Z-Image Base Q4_K_M: 5,066,995,776 bytes
- Qwen3 4B text encoder: 2,546,340,960 bytes
- VAE: 335,304,388 bytes

Total:

**7,948,641,124 bytes**

Approximately:

- 7.949 GB decimal
- 7.403 GiB binary

### SD 1.x-class catalog weights

Each of these baseline files is around 2.13 GB:

- DreamShaper 8: 2,132,625,894 bytes
- Realistic Vision v5.1: 2,132,625,894 bytes
- Anything v5: 2,132,625,616 bytes

### SDXL Base

- SDXL Base 1.0: 6,938,078,334 bytes
- approximately 6.938 GB / 6.462 GiB

## What this means for a 12 GB Android phone

A 12 GB phone does not provide 12 GB exclusively to AI.

Memory is shared by:

- Android/system services,
- app/runtime,
- CPU allocations,
- GPU driver/buffers,
- model weights/mappings,
- intermediate tensors,
- image buffers,
- backend workspace/cache.

Therefore a model whose files total 6–8 GB is **not** equivalent to a desktop workload requiring only 6–8 GB of dedicated VRAM.

## Feasibility ranking for POCO-class Edge experiments

### Best first image experiment

An SD 1.x-class model around 2.13 GB is the most defensible first target.

Why:

- substantially smaller file footprint,
- simpler than Z-Image + Qwen encoder + VAE stack,
- better chance of fitting after Android/system overhead,
- useful for benchmarking CPU/Vulkan feasibility.

This is still experimental until measured.

### Z-Image Turbo

Not recommended as the first phone target.

The required weight set alone is ~6.75 GB.

Runtime allocations can push real memory pressure materially higher, so a 12 GB shared-memory Android device has little safety margin.

### Z-Image Base

Even less suitable as an initial phone workload.

Weights alone approach 8 GB.

### SDXL

Also poor as a first POCO target due to a ~6.94 GB model file before runtime allocations.

## ORBI Edge principle

The phone should advertise measured capability rather than ORBI assuming capability from total RAM.

Example future probe:

```json
{
  "node_id": "poco-x7-pro",
  "ram_total_mb": 12288,
  "backends": ["cpu", "vulkan-if-available"],
  "models": {
    "sd1-lite": {
      "status": "tested",
      "max_resolution": "512x512",
      "peak_ram_mb": null,
      "median_latency_ms": null
    },
    "z-image-turbo": {
      "status": "not-certified",
      "reason": "weight-stack footprint too high for first mobile target"
    }
  }
}
```

## Measurements required on the actual phone

For a legitimate ORBI capability claim record:

- exact phone RAM available before load,
- backend actually used,
- model load time,
- peak RSS / memory pressure,
- generation time,
- thermal throttling across repeated generations,
- battery/energy impact,
- crash/OOM behavior,
- output resolution,
- output quality.

## Current conclusion

The exact provenance data strengthens the earlier strategy:

**use the POCO primarily as an ORBI Edge orchestration/LLM/speech node first, and treat SD 1.x image generation as the first serious visual experiment.**

Do not make Z-Image/SDXL/video generation a phone requirement for the initial ORBI Creative Studio architecture.
