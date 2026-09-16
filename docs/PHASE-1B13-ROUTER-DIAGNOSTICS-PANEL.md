# ORBI Creative Studio — Phase 1B.13 Read-only Router Diagnostics

Status: stacked on P1B.12. Read-only desktop diagnostics UI. No cutover.

## Purpose

Expose the P1B.11/P1B.12 parity report inside the Electron Settings modal so current session evidence can be inspected without opening developer tools or adding any execution-control surface.

## UI location

Electron Settings gains a third tab:

`Router Diagnostics`

The tab is shown only when the desktop local-AI/Electron bridge is available, matching the existing Local Models gating.

## Component

`src/components/RouterDiagnosticsPanel.js`

The panel reads only:

- `getStudioParitySessionState()`
- `buildCurrentStudioParityDiagnosticReport()`
- `formatCurrentStudioParityDiagnosticReport()`

These APIs are backed by the in-memory P1B.10 ledger and the fixed P1B.12 target profile.

## Visible information

The panel displays:

- current session sample count;
- observed route count;
- target route count;
- target-scoped certification state;
- each target route status;
- sample and model coverage;
- match / blocked / mismatch counts;
- P1B.9 failure reasons;
- the deterministic P1B.11 text report.

## Refresh

The only panel action is `Refresh`.

Refresh recomputes the view from the current in-memory ledger. It does not probe providers directly, mutate evidence, trigger generation, change routing, or persist anything.

## Read-only boundary

The panel does not import or call:

- `localAI` generation;
- MuAPI generation;
- Compute Router selection;
- credential setters;
- IPC directly;
- network fetch;
- evidence clear/reset;
- fallback or cutover controls.

The component is tagged internally with `data-orbi-router-diagnostics="read-only"` and tests require exactly one local click handler: Refresh.

## Safe rendering

Dynamic diagnostics values are rendered through `textContent`.

The component does not inject route/model/reason values through dynamic HTML templates.

## Internationalization

P1B.13 adds English and Simplified Chinese Settings/diagnostics copy through the existing `src/lib/i18n.js` dictionary.

## Studio isolation

ImageStudio and VideoStudio are unchanged in P1B.13.

The diagnostics profile is not imported into either generation component.

## Scope boundary

P1B.13 does not:

- authorize routing control;
- enable provider fallback;
- create files;
- persist diagnostics;
- expose a global API;
- alter provider readiness;
- alter generation payloads;
- clear evidence;
- execute generation.

## Merge gate

Keep stacked until P1B.3–P1B.12 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.