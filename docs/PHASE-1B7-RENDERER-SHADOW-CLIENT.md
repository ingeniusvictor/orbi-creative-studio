# ORBI Creative Studio — Renderer Shadow Client P1B.7

Status: final preparation layer before touching the Studio generation handlers.

## Purpose

P1B.7 connects the already-separated pieces:

1. read the redacted Electron readiness snapshot;
2. compose P1B.3 provider descriptors;
3. evaluate the P1B.5 Studio shadow request;
4. return parity evidence.

It still does not execute a provider.

## API

`createComputeRouterShadowClient()` exposes:

- `evaluateStudioRequest(input)` — strict diagnostic mode; propagates readiness/router errors;
- `observeStudioRequest(input)` — fail-soft mode intended for future Studio shadow instrumentation.

The default client reads only:

`window.orbiComputeRouter.getReadinessSnapshot()`

It never touches:

- `window.localAI`;
- `window.orbiMuapi`;
- provider generation methods;
- uploads;
- provider secrets.

## Fail-soft guarantee

`observeStudioRequest()` catches all internal shadow/readiness errors and returns a redacted result:

```json
{
  "mode": "shadow-only",
  "executed": false,
  "status": "unavailable",
  "parity": "unavailable",
  "reason": "SHADOW_EVALUATION_UNAVAILABLE",
  "legacyProviderId": null,
  "selectedProviderId": null
}
```

This makes shadow observation non-authoritative by construction.

## Why Studio components are still untouched

The existing ImageStudio and VideoStudio generation branches remain the only code that can invoke sd.cpp, Wan2GP, or MuAPI.

P1B.7 deliberately stops one step before adding calls to `observeStudioRequest()` inside those handlers. That instrumentation should happen only after real CI is restored and the stacked readiness/router layers are certified.

## Future controlled cutover

A safe progression after CI recovery is:

1. instrument ImageStudio/VideoStudio with non-blocking shadow observation while still executing the legacy provider;
2. collect parity/no-route/divergence evidence;
3. define acceptable parity thresholds and mismatches;
4. add an explicit feature flag for router authority;
5. only then allow the Compute Router decision to choose execution.
