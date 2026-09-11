# Phase 0 — Baseline Certification

## Objective

Create a reproducible and auditable starting point for ORBI Creative Studio before introducing ORBI-specific code.

## Certification checklist

- [x] ORBI repository created
- [x] Repository access verified
- [x] Upstream repository verified
- [x] MIT license verified and preserved
- [x] Upstream baseline commit pinned
- [x] Upstream root tree SHA recorded
- [x] Upstream package version recorded
- [x] Static repository inventory completed
- [x] Submodule pins and nested workspace paths identified
- [x] Inventory all cloud providers and API dependencies
- [x] Inventory MuAPI coupling
- [x] Inventory local-model execution paths
- [x] Static inspection of sd.cpp integration
- [x] Static inspection of Wan2GP client path
- [x] Search for telemetry / analytics / external callbacks
- [x] Record environment variables and persistent configuration
- [x] Static security findings recorded
- [x] Root/submodule licensing baseline recorded
- [x] Local model provenance baseline completed for identity — exact bytes/SHA/revisions captured for 8 local assets
- [x] Reproducible import runbook created
- [x] Import full upstream source tree into ORBI Git history
- [x] Initialize all submodules at pinned commits in the ORBI checkout
- [x] Install dependencies without source modification
- [x] Run available baseline node tests — 17/17 PASS
- [x] Run package/workspace builds — PASS
- [x] Run root Next.js build — PASS
- [x] Docker/self-hosted web smoke test — PASS
- [x] Linux Electron desktop launch smoke — real child process sustained >12 s
- [x] Run baseline Electron desktop packaging — Windows x64 PASS; Linux x64 PASS; macOS x64/arm64 PASS
- [x] Run dependency vulnerability audit after full import — 36 findings; remediation tracked in #8
- [x] Deterministic ESLint baseline established on QA branch — 0 errors / 12 warnings
- [x] Verify sd.cpp binary runtime on Linux x64 — dynamic selector/download/execution PASS; real model generation remains a hardware/model gate
- [ ] Verify Wan2GP at runtime against a real server
- [ ] Resolve Open AI Agents Hub standalone license-file ambiguity — MIT intent corroborated by README + package.json
- [ ] Resolve DreamShaper weight-license ambiguity
- [x] Record baseline test/build results in `docs/PHASE-0-RUNTIME-CERTIFICATION.md`
- [ ] Declare Phase 0 PASS before functional ORBI divergence

## Baseline pin

- Commit: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- Root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`

## Static audit artifacts

- `docs/PHASE-0-AUDIT.md`
- `docs/SECURITY-FINDINGS.md`
- `docs/LICENSING-BASELINE.md`
- `docs/MODEL-PROVENANCE.md`
- `docs/PROVIDER-MAP.md`
- `docs/CONFIG-INVENTORY.md`
- `docs/IMPORT-RUNBOOK.md`

## Rules for Phase 0

1. Do not rebrand functional code yet.
2. Do not remove MuAPI yet.
3. Do not replace providers yet.
4. Do not optimize for Android yet.
5. Do not introduce ORBI Edge Mesh coupling yet.
6. First establish what the original repository does, what runs locally, what requires cloud, and what actually builds.
7. Do not create a partial upstream baseline merely to bypass tooling limitations.
8. Keep `upstream-baseline` immutable once imported.

## Exit criteria

Phase 0 passes only when the imported source can be tied to the pinned upstream baseline and we have a written record of:

- source integrity,
- dependency installation,
- build/test status,
- local inference paths,
- cloud dependencies,
- submodule state,
- licensing/provenance blockers,
- security findings,
- known runtime blockers,
- and recommended ORBI divergence points.
