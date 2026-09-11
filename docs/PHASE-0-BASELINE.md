# Phase 0 — Baseline Certification

## Objective

Create a reproducible and auditable starting point for ORBI Creative Studio before introducing ORBI-specific code.

## Certification checklist

- [x] ORBI repository created
- [x] Repository access verified
- [x] Upstream repository verified
- [x] MIT license verified and preserved
- [x] Upstream baseline commit pinned
- [x] Upstream package version recorded
- [ ] Import full upstream source tree
- [ ] Verify submodules and nested workspaces
- [ ] Install dependencies without source modification
- [ ] Run baseline build
- [ ] Run baseline desktop build or dev start where practical
- [ ] Inventory all cloud providers and API dependencies
- [ ] Inventory MuAPI coupling
- [ ] Inventory local-model execution paths
- [ ] Verify sd.cpp integration
- [ ] Verify Wan2GP client path
- [ ] Identify telemetry / analytics / external callbacks
- [ ] Record environment variables and secrets required
- [ ] Record baseline test/lint/build results
- [ ] Create first ORBI development branch only after certification

## Baseline pin

`Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Rules for Phase 0

1. Do not rebrand functional code yet.
2. Do not remove MuAPI yet.
3. Do not replace providers yet.
4. Do not optimize for Android yet.
5. Do not introduce ORBI Edge Mesh coupling yet.
6. First establish what the original repository does, what runs locally, what requires cloud, and what actually builds.

## Exit criteria

Phase 0 passes only when the imported source can be tied to the pinned upstream baseline and we have a written record of:

- source integrity,
- dependency installation,
- build status,
- local inference paths,
- cloud dependencies,
- known blockers,
- and recommended ORBI divergence points.
