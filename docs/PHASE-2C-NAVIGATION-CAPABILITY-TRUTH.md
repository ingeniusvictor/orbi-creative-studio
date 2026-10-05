# Phase 2C — Navigation & Capability Truth

## Goal

Make the Electron desktop navigation describe the product that actually exists today.

Phase 2A proved that ORBI Creative Studio contains two materially different product surfaces:

- an Electron/Vite desktop shell;
- a richer Next/web application with additional studios and routes.

Phase 2C prevents those two surfaces from being presented as though they have identical capabilities.

## Primary Electron navigation

The desktop header now exposes only the four creative surfaces that are implemented as working Electron experiences:

1. Image
2. Video
3. Cinema Studio
4. Lip Sync

These are the primary desktop creative journey.

## Deferred desktop surfaces

The following routes remain in the Electron codebase, but are intentionally removed from the primary desktop navigation:

- Workflows — desktop placeholder; web/workspace implementation exists.
- Agents — desktop placeholder; web/workspace implementation exists.
- MCP/CLI — developer/upstream-oriented surface, not a primary creative workflow.

Their code is preserved so Phase 2D can evaluate convergence instead of rebuilding or deleting working foundations prematurely.

## Capabilities that are not advertised as Electron primary tools

- Audio Studio — available in the shared web Studio, not yet integrated as an Electron Studio.
- Scene3D — governed pilot backend, default OFF, not yet a primary creative surface.
- Local Models — advanced configuration, not a creative destination.
- Router Diagnostics — engineering diagnostics, not a creative destination.

## Navigation behavior cleanup

The old header rendered a permanent active dot under Image even after another tab was selected. Phase 2C replaces that with a moving active-state indicator and `aria-current` state tied to the selected primary page.

## Non-goals

Phase 2C does not:

- delete Workflows, Agents or MCP/CLI code;
- integrate web applications into Electron;
- add Audio Studio to Electron;
- expose Scene3D as a primary Studio;
- alter provider routing or generation execution;
- reopen Compute Router scope;
- change installer or user-data identity.

## Product rule established

A capability may appear in the primary Electron navigation only when it has a real Electron user journey that can be exercised end-to-end.

Existing web-only capability must be labeled or integrated truthfully rather than represented as a finished desktop feature.

## Validation

`tests/desktopNavigationCapabilityTruth.test.js` protects the Phase 2C contract by verifying:

- the primary Electron pages are exactly Image, Video, Cinema and Lip Sync;
- deferred routes remain in the codebase;
- Audio and Scene3D are not falsely advertised as Electron primary surfaces;
- engineering diagnostics stay outside the creative navigation;
- active navigation state follows the selected page.

The repository integrated PR gate remains the final merge gate.

## Next

Phase 2D — Desktop/Web Convergence Spike.

The next product question is not “how do we build Workflows and Agents?” They already exist in web/workspace form. The bounded Phase 2D question is:

> What is the smallest reliable integration path that lets Electron access one existing web capability without duplicating its implementation?

Only one convergence path should be proven first before expanding further.
