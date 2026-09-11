# ORBI Creative Studio — Production Dependency Audit

Certification date: 2026-09-11

Baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- Node: `v20.20.2`
- npm: `10.8.2`
- certification run: `34653252434`

## Result

Full dependency audit:

- 36 total vulnerabilities
- 3 low
- 5 moderate
- 26 high
- 2 critical

Production-only audit (`npm audit --omit=dev`):

- **9 total vulnerabilities**
- 0 low
- 3 moderate
- 5 high
- 1 critical

Dependency inventory reported by npm:

- production: 250
- development: 882
- optional: 159
- peer: 32
- total: 1168

## Production vulnerability set

### Critical

#### next — direct dependency

Severity: **critical**

The production audit reports Next.js as a direct vulnerable dependency with multiple advisory classes including:

- denial of service
- middleware/proxy bypass
- cache poisoning/confusion
- XSS
- SSRF
- Server Action issues
- image optimization issues

npm reports a fix is available.

Because the application materially uses Next.js middleware/API routes, this is a release blocker for any public web deployment.

### High

#### axios — direct dependency

Severity: **high**

Representative classes:

- ReDoS/resource exhaustion
- proxy credential leakage
- prototype-pollution gadgets
- request construction/header manipulation
- proxy bypass

npm reports a fix is available.

#### form-data — transitive

Severity: **high**

- multipart field/filename CRLF injection

Fix available.

#### nanoid — transitive

Severity: **high**

- resource/loop/integer edge cases

Fix available.

#### postcss — transitive

Severity: **high**

Representative classes:

- CSS serialization XSS
- source map arbitrary-file-read/path-traversal issues

Fix available.

#### sharp — transitive

Severity: **high**

Inherited native image-library findings through libvips/libheif.

Fix available.

### Moderate

#### react-syntax-highlighter — direct dependency in a workspace

Severity: **moderate**

Transitive path through Refractor / PrismJS.

Full remediation is reported as a semver-major update to `react-syntax-highlighter@16.1.1`.

#### prismjs — transitive

Severity: **moderate**

- DOM clobbering

#### refractor — transitive

Severity: **moderate**

- inherits PrismJS exposure

## Key conclusion

The original 36 findings significantly overstate the runtime surface because many are build/dev dependencies.

However, the production runtime still contains a **critical direct Next.js finding** plus a **high direct Axios finding**, so ORBI must not treat the baseline as public-release safe.

## Remediation order

### Batch A — lock-safe/non-breaking fixes

Attempt only updates allowed by existing package.json ranges.

Goals:

- patch Next.js within the allowed major/minor range if npm can do so without a package.json major change
- patch Axios
- patch transitive production dependencies
- preserve 17/17 tests and all builds

### Batch B — explicit major changes

Handle separately:

- react-syntax-highlighter major update
- any framework/runtime upgrade that changes package.json semver intent
- Electron/electron-builder/Vite major updates from the full audit

## Acceptance gate

A future ORBI public web release should require:

- production audit with zero critical findings
- zero high findings unless individually documented and formally accepted
- full test/build/package evidence after upgrades
- Docker smoke test after web-runtime dependency changes

Tracked in issue #8.
