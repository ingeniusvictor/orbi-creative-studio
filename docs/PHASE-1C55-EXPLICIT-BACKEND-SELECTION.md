# P1C55 — Explicit Backend Selection Enforcement

## Purpose

P1C55 turns a verified explicit local backend preference into the actual runtime backend used for generation.

Before P1C55, ORBI could install and verify a CUDA/Vulkan/ROCm/Metal runtime and P1C54 could prove that its backend device was discoverable, but generation still relied on sd.cpp automatic placement.

That left room for a silent mismatch between what the user selected and what the runtime actually used.

## Behavior

When `OPEN_GENERATIVE_AI_SD_BACKEND` is left at:

`auto`

ORBI does not add a `--backend` argument. The pinned sd.cpp runtime remains free to use its own auto-fit behavior.

When the user explicitly selects:

- `cpu`
- `cuda` / `cuda12`
- `vulkan`
- `rocm`
- `metal`

ORBI requires P1C54 activation evidence to be valid.

It then uses the exact device name returned by the pinned runtime's official `--list-devices` command, for example:

`--backend CUDA0`

or:

`--backend Vulkan0`

No backend device string is guessed.

## Fail-closed behavior

If an explicit backend was requested but no matching runtime device is active, generation fails before spawning the model.

ORBI does not silently fall back to CPU.

## Privacy

The selected device name exists only inside Electron main-process runtime logic.

Provider readiness continues to expose only:

`backendActivationVerified: boolean`

GPU names, descriptions and exact device identifiers remain absent from renderer/provider snapshots.

## Scope

P1C55 changes only explicit generation backend selection.

It does not:

- change the pinned runtime manifest;
- modify backend installation;
- modify model selection;
- change benchmark certification;
- expose hardware identity to renderer code.
