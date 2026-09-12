# ORBI Creative Studio — Phase 1B.2 Provider Descriptor Adapters

Status: descriptive adapters only. No execution-path wiring.

Related: ARCH-01 (#4).

## Purpose

Translate the providers that already exist in ORBI Creative Studio into the Phase 1B Compute Router contract without changing how any generation currently executes.

The adapters describe facts. They do not execute jobs.

## Current provider boundaries

### `sdcpp-device`

- execution: `device`
- trust boundary: `same-device`
- metering: `local-compute`
- credentials: `not-required`
- current operation: T2I
- capabilities are derived from `LOCAL_MODEL_CATALOG` entries whose provider is `sdcpp`

This adapter intentionally does not claim I2I or video capability because the current ORBI sd.cpp execution path is prompt-to-image only.

### `wan2gp-lan`

- execution: `lan`
- trust boundary: `trusted-network`
- metering: `local-compute`
- credentials: `not-required`
- current operations: T2I, T2V, I2V
- capabilities are derived from the existing Wan2GP entries in `LOCAL_MODEL_CATALOG`

The adapter describes the trusted LAN execution boundary. It does not imply distributed tensor memory or pooled RAM.

### `muapi-cloud`

- execution: `cloud`
- trust boundary: `third-party`
- metering: `credits`
- credential state is explicit
- operations are derived from the canonical Studio catalogs:
  - T2I
  - I2I
  - T2V
  - I2V
  - V2V
  - LipSync
  - Audio

MuAPI sub-vendors such as Google, ByteDance, Kling, Fal, etc. remain model provenance metadata. The execution/trust boundary from ORBI's perspective is still MuAPI cloud.

## Fail-closed readiness

All provider factories default to:

- `health: unknown`
- MuAPI `credentials: unknown`

Therefore simply importing these adapters cannot make a provider eligible for routing.

A later readiness layer must explicitly report a runnable state such as `ready` or `degraded`.

## Catalog parity

The adapter layer does not maintain a second hand-written model catalog.

It imports:

- the canonical MuAPI model arrays already used by Studio;
- the existing local model catalog already used by Electron/local inference.

This reduces drift between UI choices and router capability descriptions.

## Hardware facts

The sd.cpp adapter can accept a sanitized hardware summary and attach it as capability metadata.

This is descriptive only. Phase 1B.2 does not yet decide whether a given model is safe or performant on that hardware.

## Non-goals

This phase does not:

- call MuAPI;
- call sd.cpp;
- call Wan2GP;
- use IPC;
- probe hardware;
- change Studio model selection;
- add automatic fallback;
- consume credits;
- download models;
- alter generation history.

## Next step

Create a readiness composition layer that combines:

1. hardware probe facts,
2. installed runtime state,
3. installed model state,
4. Wan2GP probe state,
5. MuAPI secure credential readiness,

and emits provider descriptors with explicit health/credential states.

Only after parity tests should Studio generation decisions be moved behind the router.
