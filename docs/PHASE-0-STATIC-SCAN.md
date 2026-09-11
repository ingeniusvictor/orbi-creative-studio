# ORBI Creative Studio — Static Secret and Endpoint Scan

Certification date: 2026-09-11

Baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- successful scan run: `34653339622`

## Secret-pattern scan

Result: **PASS**

High-risk tracked-file patterns checked included:

- PEM/private-key headers
- OpenAI-style `sk-` tokens
- Google API-key-like `AIza...` tokens
- GitHub token prefixes
- Slack token prefixes

Observed result:

`SECRET_PATTERN_HIT=0`

This is a pattern scan, not a formal guarantee that no credential exists anywhere. It materially reduces the likelihood of obvious committed secrets in the pinned baseline.

## Endpoint inventory

The source/submodules contain a large URL surface.

The scan found:

- **1,554 unique URL-like strings**

This number includes:

- documentation links
- model download URLs
- provider/API endpoints
- repository URLs
- third-party assets
- links inside nested submodules/packages

It must not be interpreted as 1,554 runtime network dependencies.

The ORBI provider/provenance work should eventually replace ad-hoc URLs with typed/provider-scoped configuration where practical.

## Sensitive execution surfaces

Observed child-process usage:

- `afterPack.js` uses `execSync` for macOS codesign
- `electron/lib/localInference.js` imports `spawn` / `execFile`
- `scripts/package-linux-deb.js` imports `execFileSync`

Observed runtime process spawn:

- `electron/lib/localInference.js` starts the local inference binary with `spawn(BINARY_PATH, args, ...)`

Observed Electron external-link surface:

- `electron/main.js` calls `shell.openExternal(url)`

This directly supports the earlier SEC-02-style recommendation to validate/allowlist schemes before opening external URLs.

Observed IPC main handlers include:

### local-ai

- binary status
- binary download
- model listing/download/delete
- auxiliary download
- generate
- cancel generation

### Wan2GP

- configuration
- URL set/probe
- model listing
- generate/cancel
- upload file

The preload bridge exposes corresponding `ipcRenderer.invoke` calls.

## Interpretation

No obvious committed secret pattern was found.

The principal static security work remains:

- external URL/scheme validation
- Wan2GP trust-boundary validation
- provider-secret storage redesign
- model/binary provenance and integrity
- dependency remediation

The scan did not introduce any source changes to the immutable upstream baseline.
