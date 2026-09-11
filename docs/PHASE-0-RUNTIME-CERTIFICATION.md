# ORBI Creative Studio — Phase 0 Runtime Certification

Certification date: 2026-09-11

Baseline:

- upstream commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- certification branch: `cert/phase-0-runtime`
- GitHub Actions run: `34651368277`
- certification workflow commit: `659dab2f029569ade4a8708326df7aecaebbfe89`

## Result

### Functional build baseline: **PASS**

The pinned upstream source was checked out with all submodules and built without modifying upstream functional code.

### Dependency security baseline: **FAIL / remediation required**

The code builds and tests successfully, but the exact dependency graph contains known vulnerabilities and must not be treated as release-ready.

## Toolchain

- Ubuntu GitHub Actions runner
- Node: `v20.20.2`
- npm: `10.8.2`
- Git: `2.55.0`

## Source integrity

PASS:

- pinned root commit exists
- pinned root tree matches
- certification branch is a descendant of the pinned baseline
- only the certification workflow differs from the upstream baseline on the certification branch

## Submodules

PASS:

- `packages/Vibe-Workflow@c65ce897e82bf73659c2725528c8492cd609d831`
- `packages/Open-Poe-AI@3e21ebc92d93bd699ffc6000bbcf980eaa8830cb`
- `packages/Open-AI-Design-Agent@ebc0ce7650baad0d13797ccd471c883e78be3161`

Recursive checkout succeeded.

## Dependency installation

Command:

```bash
npm ci
```

Result: **PASS**

Observed:

- 1044 packages added
- 1049 packages audited by npm during install
- several deprecation warnings are present in inherited dependencies

## Node test suite

Command:

```bash
node --test tests/*.test.js
```

Result: **PASS**

- tests: 17
- pass: 17
- fail: 0

Coverage includes baseline checks for:

- local inference asset selection
- Linux ARM64 asset-path resolution
- local AI path configuration
- generation progress parsing
- generation parameter resolution
- Wan2GP model availability / endpoint resolution

This is not comprehensive application test coverage; it is the complete root Node test suite present in the pinned baseline.

## Workspace build

Command:

```bash
npm run build:packages
```

Result: **PASS**

Observed Babel compilation:

- one workspace compiled 22 files
- one compiled 11 files
- one compiled 4 files
- studio compiled 68 files

Babel reports that `packages/studio/src/models.js` exceeds 500 KB and deoptimizes output styling. This is a maintainability/performance signal, not a build failure.

## Next.js production build

Command:

```bash
npm run build
```

Result: **PASS**

Observed:

- `next build`
- compiled successfully
- compilation stage completed in approximately 44 seconds on the GitHub runner

## Electron renderer / Vite build

Command:

```bash
npm run vite:build
```

Result: **PASS**

Observed:

- Vite 5.4.21
- production build succeeded
- build completed in approximately 3.34 seconds on the GitHub runner

This validates the renderer bundle. It does **not** yet certify native packaged Electron installers on Windows/macOS/Linux.

## Dependency security audit

Command:

```bash
npm audit --audit-level=high
```

Result: **FAIL — expected to remain informational during baseline certification**

Observed:

- 36 total vulnerabilities
- 3 low
- 5 moderate
- 26 high
- 2 critical

Representative affected dependency families include:

- Electron / Electron build toolchain
- Next.js
- Axios
- tar and related build chains
- xmldom
- Vite / esbuild
- PrismJS / syntax-highlighting chain
- sharp / native image stack
- brace-expansion
- ip-address

The workflow job itself remained green because the audit step was explicitly configured with `continue-on-error: true`. This must not be interpreted as an audit PASS.

Tracked in issue #8.

## Certification interpretation

The upstream baseline is now certified as:

**reproducibly importable + installable + testable + buildable**

It is **not yet certified as release-ready** because:

- dependency vulnerabilities require triage/remediation,
- actual sd.cpp generation has not been exercised on target desktop hardware,
- Wan2GP generation has not been exercised against a real GPU server,
- native Electron installers have not been built/tested for each target OS,
- licensing/provenance questions remain for selected submodules/models.

## Phase 0 conclusion

The architecture is sufficiently healthy to justify continuing ORBI adaptation planning.

Functional code divergence should still wait until the remaining Phase 0 governance/security gates are explicitly resolved or accepted.

## Evidence policy

Do not modify `upstream-baseline`.

All dependency remediation, provider abstraction, security hardening, Android/Edge work, and ORBI branding must occur on separate derived branches with before/after test and build evidence.
