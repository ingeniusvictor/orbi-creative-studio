# ORBI Creative Studio — Phase 1B.19 Build Identity Injection

Status: stacked on P1B.18. Build metadata only. No cutover authority.

## Purpose

Inject the exact Git commit identity into Electron builds so parity/release evidence can later bind to the actual packaged build without manually typing a SHA.

## Build-time generator

`scripts/write-build-identity.js` resolves the source commit using:

1. checked-out `git rev-parse HEAD` when Git is available;
2. otherwise a validated environment SHA from `ORBI_BUILD_SHA`, `GITHUB_SHA`, `VERCEL_GIT_COMMIT_SHA`, or `CI_COMMIT_SHA`.

`ORBI_BUILD_SHA`, when explicitly supplied in a Git checkout, must exactly match `git HEAD` or the build fails closed.

## Generated module

The generator writes:

`electron/generated/buildIdentity.js`

with immutable metadata:

- schema version;
- exact 40-character `sourceCommit`;
- application version from `package.json`.

No timestamps are embedded, keeping the identity deterministic for the same commit/version.

The generated file is ignored by Git but included in Electron packaging through the existing `electron/**/*` files rule.

## Runtime validation

`electron/lib/buildIdentity.js` validates the generated module and returns either:

- `available: true` with normalized SHA/version;
- or an immutable unavailable record when the generated module is missing/invalid.

Missing identity does not expose an arbitrary or guessed commit.

## Preload exposure

Electron preload exposes:

`window.orbiBuildIdentity`

as static, non-sensitive metadata.

No build-identity IPC channel exists.

The object carries no provider control, credentials, filesystem access, routing authority, or execution method.

## Build integration

`npm run build:identity` runs before:

- `vite:dev`;
- `vite:build`;
- all Electron dev/package scripts via `vite:build`.

This means DMG, Windows, Linux, and development Electron bundles receive build identity through the same path.

## Safety

The generator:

- requires an exact 40-character SHA;
- rejects explicit SHA/checkout mismatches;
- writes atomically;
- reads app version from the tracked package manifest;
- does not contact the network.

## Studio isolation

P1B.19 does not import build identity into:

- ImageStudio;
- VideoStudio;
- `src/main.js` generation/router bootstrap.

The identity is only exposed by preload for future evidence binding.

## Scope boundary

P1B.19 does not:

- create parity certification;
- create release approval;
- bind session evidence yet;
- alter provider readiness;
- alter generation dispatch;
- enable fallback;
- authorize cutover.

## Merge gate

Keep stacked until P1B.3–P1B.18 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.