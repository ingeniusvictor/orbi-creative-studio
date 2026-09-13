# ORBI Creative Studio — Phase 1B.5 Studio Router Shadow Parity

Status: preparation-only. Stacked on P1B.4. Not imported by Studio execution components.

## Purpose

Model the decision that the current Electron Studio dispatcher already makes and compare it against the Compute Router without changing who executes generation.

The shadow planner lives at:

`src/lib/computeRouter/studioShadow.mjs`

It accepts only routing facts:

- operation: `t2i`, `i2i`, `t2v`, `i2v`, or `v2v`;
- explicit model ID;
- optional aspect ratio;
- optional resolution;
- optional duration;
- readiness snapshot.

The prompt is intentionally not part of the shadow report because routing does not require prompt content.

## Legacy provider mapping

The existing Studio behavior is represented as:

- sd.cpp local model → `sdcpp-device`;
- Wan2GP local/LAN model → `wan2gp-lan`;
- all other catalog models → `muapi-cloud`.

Each request keeps the currently selected model as `modelPreference`, so the shadow planner does not broaden selection to another model.

## Policies

### sd.cpp

- privacy: `device-only`
- cost: `free-only`
- fallback: disabled

### Wan2GP

- privacy: `trusted-lan`
- cost: `free-only`
- fallback: disabled

### MuAPI

- privacy: `cloud-ok`
- cost: `metered-ok`
- fallback: disabled

## Parity states

- `match`: Router chooses the same provider the Studio currently uses;
- `blocked`: Router has no eligible provider under current readiness evidence;
- `mismatch`: Router selected a different provider.

The report contains provider IDs and rejection reasons only. It does not contain prompt content, credentials, filesystem paths, endpoint URLs, or provider payloads.

## Important MuAPI gate

Current P1B.4 snapshot exposes secure credential readiness but no dedicated MuAPI transport health.

Therefore a cloud request is intentionally reported as `blocked` / `health:unknown` until an explicit transport-health signal exists.

This prevents credential presence from being mistaken for cloud service readiness.

## Scope boundary

P1B.5 does **not**:

- import into `src/components/ImageStudio.js`;
- import into `src/components/VideoStudio.js`;
- call `localAI.generate`;
- call MuAPI generation;
- call IPC;
- change provider selection;
- enable fallback;
- change any Studio UI.

A later cutover phase can invoke this planner in shadow mode and record parity evidence before any real routing switch is enabled.

## Merge gate

Keep stacked until P1B.3 and P1B.4 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no steps/logs.
