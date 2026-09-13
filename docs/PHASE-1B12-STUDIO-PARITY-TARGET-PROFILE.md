# ORBI Creative Studio — Phase 1B.12 Studio Parity Target Profile v1

Status: stacked on P1B.11. Certification scope definition only. No cutover.

## Purpose

Define one explicit, versioned set of Image/Video Studio routing paths that must demonstrate parity before any future Compute Router cutover is considered.

The profile lives at:

`src/lib/computeRouter/studioParityTargets.mjs`

Profile ID: `studio-image-video-v1`

Schema version: `1`

## Why a fixed profile is necessary

P1B.9 intentionally requires explicit targets and refuses implicit certification. Without a shared profile, different diagnostics callers could accidentally certify different route subsets.

P1B.12 removes that ambiguity for the current Electron Image/Video Studio scope.

## v1 required routes

### sd.cpp device
- `sdcpp-device:t2i`

### Wan2GP LAN
- `wan2gp-lan:t2i`
- `wan2gp-lan:t2v`
- `wan2gp-lan:i2v`

### MuAPI cloud
- `muapi-cloud:t2i`
- `muapi-cloud:i2i`
- `muapi-cloud:t2v`
- `muapi-cloud:i2v`
- `muapi-cloud:v2v`

Total: **9 routes**.

## Why Wan2GP T2I is included

ImageStudio local mode uses every non-video entry from `LOCAL_MODEL_CATALOG`. That includes Wan2GP image models, so Wan2GP T2I is part of the actual current Studio path and must be covered.

## Explicitly out of v1 scope

The profile does not include `muapi-cloud:lipsync`, `muapi-cloud:audio`, `sdcpp-device:i2i`, or `wan2gp-lan:v2v`. Those routes are not currently instrumented by the P1B.8 ImageStudio/VideoStudio scope or are not supported by the corresponding provider path.

## Evidence thresholds

Every v1 route requires minimum samples **10** and minimum distinct models **1**.

## Capability consistency

Tests verify every profile target has at least one declared capability in `SDCPP_CAPABILITIES`, `WAN2GP_CAPABILITIES`, or `MUAPI_CAPABILITIES`.

## Session/diagnostics integration

P1B.10 now exposes convenience helpers bound to v1:
- `evaluateCurrentStudioParitySession()`
- `buildCurrentStudioParityDiagnosticReport()`
- `formatCurrentStudioParityDiagnosticReport()`

The generic target-taking APIs remain available for tests and later profiles.

## Scope boundary

P1B.12 does not collect new evidence, alter P1B.8 observation behavior, change provider descriptors, modify ImageStudio/VideoStudio dispatch, select providers, enable fallback, authorize cutover, or expose a control UI.

## Merge gate

Keep stacked until P1B.3–P1B.11 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.