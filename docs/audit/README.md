# Phase 0 — Pre-Import Audit Index

Upstream baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Current status

**Static pre-import audit: substantially complete.**  
**Runtime/build certification: pending full history-preserving upstream import.**

## Documents

- [Architecture](./ARCHITECTURE.md)
- [Cloud / Local Execution Map](./CLOUD-LOCAL-MAP.md)
- [Security & Privacy](./SECURITY-PRIVACY.md)
- [Submodules & Licenses](./SUBMODULES-LICENSES.md)
- [Android / Edge Feasibility](./ANDROID-EDGE-FEASIBILITY.md)
- [Controlled ORBI Divergence Plan](./ORBI-DIVERGENCE-PLAN.md)
- [Import & Runtime Certification Runbook](./IMPORT-RUNBOOK.md)
- [ADR-001 — Local-First Compute](../decisions/ADR-001-LOCAL-FIRST-COMPUTE.md)

## Findings snapshot

### Confirmed

- Root license is MIT.
- Root package version at baseline is 2.0.0.
- Major app surfaces use Next.js/React, Vite and Electron.
- MuAPI is the dominant cloud path.
- `sd.cpp` provides bundled desktop-local image inference.
- Wan2GP is a separately operated Gradio server integration.
- Linux ARM64/aarch64 is represented in the local binary asset-selection code.
- Three Git submodules are pinned by gitlink SHA.
- Vibe Workflow and Open AI Design Agent licenses were verified as MIT at their pinned revisions.
- No obvious `analytics` or `sentry` keyword hits were found in the preliminary source search.

### Risks / hardening targets

- MuAPI API key appears in browser-local storage flows and cookie-backed agent flows.
- CSP currently permits `unsafe-eval` / `unsafe-inline` script execution.
- MuAPI names appear in persistence/state namespaces and several direct UI paths.
- Cloud uploads require explicit privacy/cost visibility in ORBI.
- Wan2GP remote-node transport/authentication needs hardening before generalized edge use.
- `Open-Poe-AI` submodule license/repository redirect remains unresolved.

### Not yet certified

- dependency installation
- tests
- Next.js build
- Vite build
- Electron execution
- runtime network egress
- local image generation
- Wan2GP live generation
- package vulnerability status
- complete license/SBOM inventory

## Phase 0 gate

Do not begin functional ORBI divergence until the upstream baseline branch exists in this repository and the runtime certification runbook has been executed.

Documentation/planning may continue in parallel, but the original baseline must remain immutable.