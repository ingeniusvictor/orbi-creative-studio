# ORBI Creative Studio — Android / Edge Feasibility Note

Status: **post-Phase-0 research track**

Target example: POCO X7 Pro (12 GB RAM) as an ORBI Edge Mesh node.

## What the pinned upstream already provides

The baseline contains useful building blocks:

- a provider-aware local inference client
- an Electron IPC boundary for local inference
- a curated local model catalog
- `sd.cpp` binary discovery/download logic
- explicit Linux ARM64 asset-selection code and tests
- a network-provider pattern through Wan2GP
- model download/storage abstractions

These pieces reduce the amount of architecture ORBI would need to invent.

## What the upstream does not provide

The pinned baseline does **not** provide an Android application/runtime target.

Current desktop packaging targets are centered on:

- macOS
- Windows x64
- Linux x64

Linux ARM64 inference asset-selection logic exists, but that is not equivalent to Android/Termux support.

The Electron application itself should not be treated as an Android runtime.

## Recommended ORBI strategy

Do not port the whole Electron UI to Android first.

Prefer a node/server split:

```
ORBI Creative Studio UI
        |
  ORBI Compute Router
        |
  ORBI Edge Node API
        |
  Android / Termux runtime
        |
  supported local engine
```

The phone should expose capabilities rather than pretending to be a desktop Electron host.

## Candidate Android responsibilities

Good early candidates:

- small local LLM inference
- prompt planning
- embeddings / local knowledge
- Whisper-class speech recognition
- TTS
- lightweight image inference experiments
- job queue / orchestration
- capability and health reporting

Do not assume modern local video generation is practical on 12 GB shared mobile RAM merely because a desktop model lists a similar VRAM number.

## Required feasibility measurements

For each candidate model/backend record:

- exact model file and quantization
- model bytes on disk
- peak resident RAM
- CPU/GPU/NPU backend actually used
- generation latency
- thermal behavior
- sustained performance after repeated runs
- battery/energy impact
- crash/OOM behavior
- output dimensions and quality
- Android/Termux versions
- device SoC and RAM

## Integration principle

The ORBI provider abstraction should treat Android as a capability-advertising node.

Example:

```json
{
  "node": "poco-x7-pro",
  "execution": "edge",
  "capabilities": ["llm", "speech", "image-lite"],
  "video_generation": false,
  "health": "ready"
}
```

The router can then select the phone only for jobs it can execute reliably.

## Gate

No Android implementation should begin until:

1. Phase 0 baseline build certification is complete.
2. Provider/Compute Router design (#4) is approved.
3. Local asset provenance/integrity model (#5) is defined.
4. A minimal node protocol is specified.

This keeps Android experiments from becoming a fork-specific coupling inside the creative UI.
