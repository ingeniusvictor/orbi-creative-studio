# ORBI Creative Studio — Phase 1C4 Model Resource Profile Contract

Status: resource certification contract candidate. No production model is certified by this phase.

## Purpose

Define the evidence required before ORBI may convert a local model into explicit system-RAM / VRAM requirements for compatibility decisions.

P1C4 deliberately does not invent minimum memory values.

## Why this phase exists

P1C2 refuses to infer runtime compatibility from model file size.

That rule remains correct because:

- weight file size is not peak process RAM;
- GPU offload varies by backend and runtime;
- resolution changes memory pressure;
- auxiliary encoders/VAE add memory;
- runtime implementation and quantization affect the result.

Therefore a resource requirement must be tied to a controlled benchmark context.

## Initially certifiable backends

P1C4 accepts certification only for:

- `cpu`
- `cuda12`

These are the current backends for which the compatibility layer has meaningful system-memory / NVIDIA-VRAM observations.

Vulkan, ROCm and Metal remain outside resource certification until the hardware evidence layer can measure the relevant memory model safely.

## Pending slots

Every local model in `electron/lib/modelCatalog.js` receives pending slots for CPU and CUDA12 at its default generation resolution.

Pending slots contain:

- no RAM requirement;
- no VRAM requirement;
- no benchmark evidence.

They cannot become compatibility candidates.

## Certified profile requirements

A certified profile must match exactly:

- model ID;
- backend;
- width;
- height.

It must provide explicit requirements and controlled-benchmark evidence:

- at least 3 samples;
- harness version;
- exact 40-character source commit;
- exact ISO certification timestamp;
- declared safety margin.

Unknown or extra fields are rejected.

A file-size estimate is not an accepted evidence method.

## Compatibility boundary

`evaluateCertifiedLocalCompatibility()` resolves requirements only from a certified exact-match profile.

With a pending/missing/invalid profile:

- resource requirements are withheld;
- compatibility remains `COMPATIBILITY_UNKNOWN` unless another hard blocker exists.

Even a synthetically valid profile used by unit tests still produces only a diagnostic candidate:

- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Production state after P1C4

There are **zero certified production resource profiles**.

That is intentional.

The next phase must measure real runtime behavior before any profile is promoted.

## Next step

P1C5 should define a controlled benchmark harness/protocol for collecting peak system RAM and, where measurable, peak NVIDIA VRAM for exact model/backend/resolution combinations.
