# P3 — ORBI Creative Studio Codebase Onboarding Map

Status: REFERENCE / NON-AUTHORIZING  
Snapshot: `8cb8f9357f06731c60cc051fdb9bdd14615cd120`

## Overview

ORBI Creative Studio is a JavaScript generative-media application that combines a Next/React web surface with a Vite/Electron desktop surface. The ORBI branch adds governed local-model, provider, benchmark, evidence and Compute Router layers on top of the upstream creative-studio codebase.

## Technology map

| Layer | Technology |
|---|---|
| Web application | Next.js 15, React 19 |
| Desktop shell | Electron 33 |
| Renderer/build | Vite 5 |
| Language | JavaScript, ESM, JSX |
| Package manager | npm |
| Quality | ESLint 9 + Node test suites |
| CI | GitHub Actions |
| Packaging | electron-builder + Docker surfaces |

There is no first-party TypeScript/TSX source at this snapshot.

## Key entry points

- `app/`: Next.js pages and API routes.
- `src/main.js`: Vite renderer entry.
- `electron/main.js`: trusted Electron main-process entry.
- `electron/preload.js`: renderer/main capability bridge.
- `src/components/`: ORBI renderer UI and diagnostics.
- `src/lib/computeRouter/`: governed routing, parity, evidence, certification and cutover contracts.
- `electron/lib/`: local inference, provider credentials, runtime evidence, model catalog and benchmark bridges.
- `packages/studio/`: upstream-derived studio UI/workflows.
- `tests/`: deterministic product/governance tests.
- `.github/workflows/`: dedicated phase gates + integrated PR gate.
- `docs/`: architecture, evidence and phase documentation.

## External package boundaries

The repository declares Git submodules for:

- `packages/Vibe-Workflow`
- `packages/Open-Poe-AI`
- `packages/Open-AI-Design-Agent`

Treat these as upstream/external boundaries. Do not casually make them authoritative over ORBI-owned routing, security or certification contracts.

## Critical authority boundary

The following are governed ORBI surfaces and must not be changed implicitly by an agent framework:

- runtime certification source;
- Compute Router contracts and routing authority;
- provider secret storage/transport;
- benchmark evidence provenance;
- cutover eligibility/authorization;
- upstream intake policy;
- canonical integration history.

An agent recommendation is not evidence and agent memory is not canonical state.

## Common verification commands

From the root `package.json`:

- install exact graph: `npm ci`
- Electron syntax: `find electron -type f -name '*.js' -print0 | xargs -0 -n1 node --check` (Linux CI form)
- lint: `npm run lint -- --max-warnings 10`
- root tests: `node --test tests/*.test.js`
- workspace build: `npm run build:packages`
- Next build: `npm run build`
- renderer build: `npm run vite:build`
- production dependency security gate: `npm audit --omit=dev`, blocking on critical/high findings
- Electron dev: `npm run electron:dev`
- Windows packaging: `npm run electron:build:win`
- Linux packaging: `npm run electron:build:linux`

The integrated PR workflow remains the final repository-level validation surface.

## Working convention

For meaningful changes:

`plan -> smallest isolated change -> focused tests -> root/integrated gates -> evidence -> review -> merge`

Do not combine unrelated runtime, security, memory, hook and agent-framework changes in one PR.