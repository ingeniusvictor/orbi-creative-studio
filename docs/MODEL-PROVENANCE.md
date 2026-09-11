# ORBI Creative Studio — Local Model Provenance Baseline

Audit date: 2026-09-11

This inventory covers only the local `sd.cpp` catalog present in the pinned upstream baseline.

Important: repository/code licensing and model-weight licensing are independent.

## Current catalog

| ORBI/upstream ID | Source repository | Observed repository license | Status |
|---|---|---|---|
| z-image-turbo | leejet/Z-Image-Turbo-GGUF | Apache-2.0 | provisionally verified |
| z-image-base | unsloth/Z-Image-GGUF | Apache-2.0 | provisionally verified |
| Z-Image text encoder | unsloth/Qwen3-4B-Instruct-2507-GGUF | Apache-2.0 | provisionally verified |
| Z-Image VAE | Comfy-Org/z_image_turbo | Apache-2.0 | provisionally verified at repository/file surface |
| dreamshaper-8 | Lykon/DreamShaper | Hugging Face metadata: `other` | **requires manual license clarification** |
| realistic-vision-v51 | SG161222/Realistic_Vision_V5.1_noVAE | CreativeML Open RAIL-M | provisionally verified |
| anything-v5 | Yntec/AnythingV5 | CreativeML Open RAIL-M | provisionally verified |
| stable-diffusion-xl-base | stabilityai/stable-diffusion-xl-base-1.0 | OpenRAIL++ | provisionally verified |

## Sources

- https://huggingface.co/leejet/Z-Image-Turbo-GGUF
- https://huggingface.co/unsloth/Z-Image-GGUF
- https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF
- https://huggingface.co/Comfy-Org/z_image_turbo
- https://huggingface.co/Lykon/DreamShaper
- https://huggingface.co/SG161222/Realistic_Vision_V5.1_noVAE
- https://huggingface.co/Yntec/AnythingV5
- https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0

## Important metadata discrepancy — Z-Image Turbo

The pinned upstream contains inconsistent size metadata for the same configured filename `z_image_turbo-Q4_K.gguf`:

- `electron/lib/modelCatalog.js`: 2.5 GB
- `src/lib/localModels.js`: 3.4 GB
- current Hugging Face repository listing: approximately 3.86 GB for `z_image_turbo-Q4_K.gguf`

This should be treated as a baseline metadata defect until the actual downloaded byte size is measured.

Impact:

- disk-space estimates can be wrong
- RAM planning can be wrong
- Android/Termux feasibility estimates can be misleading
- progress UI may misrepresent downloads if it relies on catalog estimates

Recommended ORBI approach:

- derive display size from authoritative remote metadata when possible
- maintain exact expected byte size in a provenance manifest
- validate file SHA-256 after download
- do not use handwritten GB estimates as a hardware-compatibility decision

## DreamShaper caution

The current Hugging Face repository metadata reports license `other`, and the model card points users to the original DreamShaper/Civitai source.

ORBI should not redistribute DreamShaper weights until the exact license applicable to `DreamShaper_8_pruned.safetensors` has been reviewed and recorded.

Local user-side downloading is a different distribution question and should still be documented transparently.

## Weight integrity backlog

For every local asset, Phase 1 should add:

- exact source revision/commit
- exact remote filename
- byte size
- SHA-256
- license identifier
- license URL/text reference
- commercial-use flag
- redistribution flag
- attribution requirement
- runtime compatibility
- minimum tested RAM/VRAM
- last verification date

## Current conclusion

The local-first architecture is technically promising, but ORBI should not bundle or redistribute weights until this provenance inventory becomes machine-readable and the unresolved DreamShaper license is closed.
