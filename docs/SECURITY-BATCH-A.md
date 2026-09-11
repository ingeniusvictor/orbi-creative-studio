# ORBI Creative Studio — Security Batch A Result

Execution date: 2026-09-11

Source baseline:

- `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- ORBI security branch: `security/batch-a-lock-safe`
- remediation commit: `7d85265`
- policy: package-lock-only / no `package.json` changes

## Guardrail

The workflow explicitly aborted if `package.json` changed.

Observed:

- `package.json`: unchanged
- `package-lock.json`: changed
- lockfile commit: 546 insertions / 389 deletions

## Functional validation after remediation

PASS:

- exact dependency re-install
- root Node tests
- workspace builds
- Next.js production build
- Electron/Vite renderer build

No upstream functional source file was modified.

## Full audit improvement

The complete dependency graph also improved:

- before: **36** vulnerabilities (3 low / 5 moderate / 26 high / 2 critical)
- after lock-safe remediation: **21** vulnerabilities (0 low / 5 moderate / 15 high / 1 critical)

The remaining full-audit critical/high findings are dominated by development/build/runtime-tooling families such as Electron/electron-builder and related chains. They remain tracked separately and are not hidden by the production-only result.

## Production audit improvement

Before:

- total: 9
- critical: 1
- high: 5
- moderate: 3
- low: 0

After:

- total: **5**
- critical: **0**
- high: **1**
- moderate: **4**
- low: 0

## Findings eliminated/downgraded by lock-safe remediation

The lock-safe update removed the critical production classification and multiple high findings without requiring semver-intent changes to package.json.

Notably:

- Next.js is no longer critical in the resulting audit, but remains moderate.
- Axios no longer appears in the remaining production vulnerability rows.
- form-data, nanoid and sharp no longer appear in the remaining production vulnerability rows.

## Remaining production findings

### postcss

Severity: **high**

Transitive through the current Next.js line.

npm reports complete remediation through a Next.js update that currently requires a semver-major transition to `next@16.3.5` under the audit solver.

### next

Severity: **moderate**

Direct dependency.

A fix is reported as available, but the residual dependency relationship with PostCSS means the next security batch requires explicit framework-version review rather than another blind lockfile update.

### react-syntax-highlighter

Severity: **moderate**

Direct workspace dependency.

npm proposes `react-syntax-highlighter@16.1.1`, a semver-major change.

### prismjs

Severity: **moderate**

Transitive through syntax highlighting.

### refractor

Severity: **moderate**

Transitive through syntax highlighting.

## Conclusion

Batch A is a **successful low-risk remediation**.

It reduced production findings:

`9 -> 5`

and critical findings:

`1 -> 0`

while preserving the tested build surface.

## Next security batches

### Batch B1 — Next/PostCSS

Must be evaluated explicitly because the audit solver points to a Next.js major-version path for complete remediation.

Required before merge:

- migration compatibility analysis
- middleware/API route review
- tests/build
- Docker smoke
- desktop renderer/package smoke

### Batch B2 — syntax highlighting

Evaluate `react-syntax-highlighter@16.1.1` independently.

Do not combine with Next.js migration.

## Merge policy

Do not modify `upstream-baseline`.

The lock-safe commit should eventually be integrated into an ORBI-owned foundation/integration branch after Phase 0 certification review.
