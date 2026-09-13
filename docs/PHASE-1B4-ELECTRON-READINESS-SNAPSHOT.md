# ORBI Creative Studio — Phase 1B.4 Electron Readiness Snapshot Bridge

Status: stacked on P1B.3. No Studio execution routing.

## Purpose

Expose one trusted Electron IPC call that gathers the runtime evidence already owned by the desktop process and returns only the fields required by the Compute Router readiness composition.

Renderer API:

`window.orbiComputeRouter.getReadinessSnapshot()`

IPC channel:

`compute-router:readiness-snapshot`

## Snapshot contents

### sd.cpp

- binary present: yes/no
- local model IDs and download state
- auxiliary LLM/VAE state for models that require them
- sanitized hardware facts

The bridge does not expose local filesystem paths, runtime archive metadata, download URLs, hashes, or raw hardware command output.

### Wan2GP

- configured: yes/no
- probe success: yes/no
- model IDs and ready flags

The configured LAN URL, Gradio endpoint names and probe errors do not cross this bridge.

### MuAPI

- secure-storage available
- secure backend accepted
- secret present
- secret-store state

No API key, ciphertext, storage path or storage backend identifier crosses this bridge.

MuAPI transport health remains absent/unknown because ORBI does not currently have a dedicated non-generation health probe. A stored credential alone must not be interpreted as cloud readiness.

## Hardware boundary

The hardware probe remains in Electron main. The snapshot removes:

- raw command output
- GPU names
- driver versions
- CPU speed
- probe policy internals

It retains only routing-safe capability facts already accepted by P1B.3.

## Safety properties

- trusted top-frame IPC validation
- no generation call
- no provider selection
- no cloud fallback
- no secret read/decrypt operation
- no renderer filesystem access
- Wan2GP URL redacted
- local model paths redacted
- P1B.3 remains the layer that converts evidence into provider descriptors

## Dependency and merge gate

This PR must remain stacked on P1B.3 until P1B.3 is certified and merged.

Do not merge while GitHub Actions is terminating before runner assignment with no steps/logs.
