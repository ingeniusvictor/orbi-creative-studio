# ORBI Creative Studio — Dependency Security Triage

Baseline audit date: 2026-09-11

Source baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- Node: `v20.20.2`
- npm: `10.8.2`

## Audit result

`npm audit --audit-level=high`

- 36 total findings
- 3 low
- 5 moderate
- 26 high
- 2 critical

This document is a triage aid, not a claim that every advisory is exploitable in ORBI.

## Highest-priority direct surfaces

### Next.js — critical audit classification

Next is a direct root runtime dependency and powers the web/server application.

This must be treated as a release blocker until upgraded to a version outside the affected advisory ranges and the application is fully re-certified.

Because Next middleware/API routes are materially used by the app, these findings cannot be dismissed as dev-only by default.

### Electron — high audit classification

Electron is a direct dependency for the desktop application.

The audit includes multiple security advisories across renderer/process boundaries and platform integrations.

The current baseline does use positive Electron controls such as:

- `contextIsolation: true`
- `nodeIntegration: false`
- `webSecurity: true`

Those reduce exposure but do not replace upgrading the runtime.

### Axios — high audit classification

Axios is a direct dependency and is used in provider/network flows.

Audit findings include proxy/header/prototype-pollution and resource-exhaustion classes.

Upgrade should be treated as an early, likely lower-risk remediation batch compared with major framework upgrades.

## Build/toolchain surfaces

### electron-builder / app-builder-lib / builder utilities

The audit reports high-severity findings and indicates that full remediation may require a breaking electron-builder update.

These findings matter especially when producing installers and update artifacts.

### tar / node-gyp / cacache / make-fetch-happen

`tar` is classified critical by the audit.

Much of this dependency chain is associated with install/build tooling. Exploitability in the shipped app must be evaluated separately, but build-system exposure still matters because ORBI will produce release artifacts.

### Vite / esbuild

The audit identifies a vulnerable esbuild range through the current Vite chain and indicates that full remediation may require a major Vite upgrade.

This should be isolated from runtime-framework changes.

### Babel toolchain

Audit findings exist in Babel packages used by workspace builds.

Treat as a separate compiler/toolchain remediation batch.

## Transitive/content-processing surfaces

Observed audit families include:

- `@xmldom/xmldom`
- `form-data`
- `ip-address`
- `js-yaml`
- `nanoid`
- `postcss`
- `postcss-selector-parser`
- `prismjs` / `refractor`
- `sharp`
- `tmp`
- `brace-expansion`
- `browserslist`

Some are reachable through runtime content paths; others are build/dev dependencies. Each should be classified before acceptance or remediation.

## Recommended remediation batches

Do not run one global force-fix.

### Batch A — non-breaking lock-safe updates

Test only upgrades that npm identifies as non-breaking first.

Evidence required after the batch:

- 17/17 Node tests
- workspace build
- Next production build
- Vite build
- Windows/Linux packaging where affected
- new audit count

### Batch B — web runtime

Focus on:

- Next.js
- Axios
- content-processing/runtime dependencies

This is the highest release priority.

### Batch C — Electron runtime

Upgrade Electron independently and run:

- desktop build
- preload/IPC smoke tests
- external-link security tests
- local inference IPC tests
- Windows package test
- Linux package test

### Batch D — Electron packaging toolchain

Upgrade electron-builder and related packages independently of Electron where possible.

### Batch E — Vite/build chain

Upgrade Vite/esbuild/Babel and verify that generated Electron renderer output remains equivalent.

### Batch F — submodule dependency trees

Handle Design Agent / Agents Hub / Vibe Workflow dependency findings at their workspace boundaries instead of silently overriding everything at root.

## No-force rule

`npm audit fix --force` is prohibited as an unreviewed operation.

The baseline currently builds successfully. Remediation should preserve that evidence while reducing the audit surface in measured steps.

Tracked by issue #8.
