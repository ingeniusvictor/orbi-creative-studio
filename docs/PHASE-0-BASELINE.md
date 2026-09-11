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
- [x] Local model provenance baseline started
- [x] Reproducible import runbook created
- [ ] Import full upstream source tree into ORBI Git history
- [ ] Initialize all submodules at pinned commits in the ORBI checkout
- [ ] Install dependencies without source modification
- [ ] Run available baseline node tests
- [ ] Run package/workspace builds
- [ ] Run root Next.js build
- [ ] Run baseline Electron desktop build or dev start where practical
- [ ] Run dependency vulnerability audit after full import
- [ ] Verify sd.cpp at runtime on supported desktop hardware
- [ ] Verify Wan2GP at runtime against a real server
- [ ] Resolve Open AI Agents Hub license-file ambiguity
- [ ] Resolve DreamShaper weight-license ambiguity
- [ ] Record final baseline test/lint/build results
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
