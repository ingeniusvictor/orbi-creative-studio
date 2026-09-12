# Phase 0 Audit — Android / Edge Feasibility

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Objective

Assess whether the Open Generative AI foundation can eventually use Android devices and ORBI Edge Mesh nodes without assuming that a phone can replace a desktop CUDA GPU.

## 1. What the upstream already gives us

The local inference implementation contains a useful separation between:

- UI/studio
- local inference client
- Electron IPC
- `sd.cpp` execution
- Wan2GP HTTP execution

The binary asset selector explicitly includes Linux ARM64/aarch64 handling and can prefer plain, Vulkan or ROCm builds when matching artifacts exist.

This is encouraging for ARM64 experimentation, but it does **not** mean the Electron desktop application is Android-compatible.

## 2. POCO-class Android node interpretation

A modern Android phone with 12 GB system RAM should be treated as a shared-memory edge device, not as a 12 GB VRAM GPU.

Practical target classes:

### Strong candidates

- small quantized LLM inference
- prompt rewriting/routing
- embeddings/RAG
- Whisper-class speech recognition
- local TTS
- media metadata/pre-processing
- orchestration and job dispatch
- lightweight image-generation experiments

### Experimental candidates

- SD 1.5-class image generation through an Android/Termux-compatible `stable-diffusion.cpp` build
- Vulkan acceleration when the device/driver/build combination is stable

### Poor candidates today

- full Wan 2.x video generation
- Hunyuan Video
- large FLUX workflows
- long/high-resolution diffusion workloads

The limiting factors are not only RAM capacity; they include memory bandwidth, thermal throttling, backend/kernel support, driver compatibility and sustained power.

## 3. Recommended Android architecture

Do not port the whole Electron app to Android first.

Prefer extracting a headless worker contract:

```text
ORBI Creative Studio UI
        |
ORBI Compute Router
        |
        +--> Desktop sd.cpp worker
        +--> Wan2GP GPU worker
        +--> ORBI Edge Worker (Android/Termux)
                  |
                  +--> local LLM
                  +--> Whisper/TTS
                  +--> optional sd.cpp image worker
```

The Android device should expose declared capabilities instead of pretending to support every generation type.

Example capability handshake:

```json
{
  "node_type": "android",
  "arch": "arm64",
  "memory_mb": 12288,
  "backends": ["cpu", "vulkan"],
  "capabilities": ["llm", "asr", "tts", "image_sd15"],
  "thermal_state": "nominal"
}
```

The exact schema is future design work; this example records the architectural intent only.

## 4. Termux spike after Phase 0

A safe first experiment should be isolated from the production repository:

1. Build or obtain a trustworthy ARM64 `stable-diffusion.cpp` CLI compatible with Termux.
2. Start with a small SD 1.5-class model, not SDXL/video.
3. Generate a low-resolution reference image.
4. Measure:
   - wall-clock generation time
   - peak RAM
   - device temperature
   - throttling behavior
   - battery draw
   - CPU vs Vulkan stability
5. Repeat at 512x512.
6. Decide whether Android image inference is worth productizing.

## 5. Edge Mesh fit

The upstream Wan2GP pattern proves the UI already accepts the concept of inference occurring on a different machine over HTTP.

ORBI should generalize this into a provider-neutral node protocol instead of hard-coding Android into Studio components.

Potential routing policy:

```text
cheap/local task -> phone/CPU node
image task -> local desktop/Vulkan/GPU node
heavy video task -> dedicated GPU/Wan2GP
commercial-only model -> cloud provider with cost approval
```

## 6. Security requirements for edge nodes

Before remote nodes become a product feature, require:

- mutual authentication
- encrypted transport
- explicit pairing
- per-node capability allowlist
- job cancellation/timeouts
- file-size limits
- temporary-file cleanup
- no arbitrary shell execution from Studio
- audit log of where each generation ran

## 7. Phase 0 conclusion

Android is a credible **ORBI edge-compute node**, especially for language, speech, orchestration and possibly lightweight image inference. It should not be the initial target for heavy local video generation.

The highest-value engineering move is therefore to build a provider/node abstraction after baseline certification, not to force the desktop application itself to run on Android.