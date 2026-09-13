# ORBI Creative Studio — Phase 1B.8 Studio Shadow Observer

Status: stacked on P1B.7. Shadow instrumentation only; legacy generation remains authoritative.

## Purpose

Connect the Compute Router readiness/parity stack to the Electron Studio without changing execution.

ImageStudio and VideoStudio now schedule a shadow observation near a generation action. The observation runs asynchronously and the existing dispatcher continues immediately.

## Observer

`src/lib/computeRouter/studioShadowObserver.mjs`:

- extracts routing-only facts from Studio context;
- excludes prompt text, uploaded media, API keys and provider payloads;
- obtains the sanitized readiness snapshot through `window.orbiComputeRouter`;
- evaluates P1B.5 shadow parity;
- emits a local browser event:
  - `orbi:compute-router-shadow`
- returns `null` on any observation failure;
- catches report-sink failures;
- never throws into the generation path.

There is no external telemetry in this phase.

## Non-blocking scheduling

Studio calls:

`scheduleStudioShadowObservation(...)`

without `await`.

The scheduler defers observation to a microtask. The legacy generation code does not wait for readiness, routing evaluation, hardware probing or MuAPI health.

## ImageStudio mapping

- selected sd.cpp local model → operation `t2i`;
- cloud image mode → `i2i`;
- cloud text-to-image mode → `t2i`.

The current calls remain:

- `localAI.generate(...)`
- `muapi.generateI2I(...)`
- `muapi.generateImage(...)`

## VideoStudio mapping

- V2V mode → `v2v`;
- image-to-video mode → `i2v`;
- text-to-video / extend path → `t2v`.

The current calls remain:

- `localAI.generate(...)` for Wan2GP;
- `muapi.processV2V(...)`;
- `muapi.generateI2V(...)`;
- `muapi.generateVideo(...)`.

## Safety rule

The shadow result is diagnostic evidence only.

It cannot:

- cancel a legacy request;
- select the executing provider;
- alter request payloads;
- trigger fallback;
- gate authentication;
- change Studio history;
- change UI success/error behavior.

A future cutover phase must require explicit parity evidence and a separate reviewed change.

## Merge gate

Keep stacked until P1B.3–P1B.7 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no steps/logs.
