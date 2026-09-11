# ORBI Creative Studio — Foundation Divergence Scope

Captured: 2026-09-11

Comparison:

- base: `upstream-baseline@871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- head: `integration/orbi-foundation`
- ahead: 25 commits
- behind: 0
- changed/added files: 17

## Current ORBI-owned divergence

### Security / runtime

- `electron/lib/fileIntegrity.js`
- `electron/lib/runtimeManifest.js`
- `electron/lib/urlPolicy.js`
- `electron/lib/localInference.js`
- `electron/lib/wan2gpProvider.js`
- `electron/main.js`

### QA / lint

- `eslint.config.mjs`
- `components/StandaloneShell.js`

### Dependency graph

- `package.json`
- `package-lock.json`

### Tests

- `tests/runtimeProvenance.test.js`
- `tests/urlPolicy.test.js`

### Integration documentation / CI

- `docs/ORBI-FOUNDATION.md`
- foundation/security certification workflows

## What has deliberately not changed

No ORBI foundation divergence currently modifies:

- product branding / icons,
- application ID,
- installer name/path,
- upstream UI visual design,
- MuAPI provider behavior,
- generation model catalogs,
- workflow UX,
- Agent Studio functionality,
- Compute Router implementation,
- ORBI Edge networking,
- model-generation semantics.

## Interpretation

The first ORBI foundation is a **hardening layer**, not a product reimplementation.

Its current divergence is limited to:

1. dependency remediation,
2. URL trust boundaries,
3. deterministic QA,
4. local runtime provenance/integrity,
5. small hook-stability cleanup.

This narrow scope should be preserved until the foundation certification is fully green.

Future product features should be layered above this branch in explicit Phase 1 workstreams rather than mixed into the Phase 0 hardening history.
