# Phase 0 Audit — Security & Privacy Findings

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

Status: preliminary static audit. This is **not** a complete security certification.

## 1. API-key storage

The upstream uses the key name `muapi_key` across several surfaces.

Observed patterns include:

- browser `localStorage`
- a client-readable application flow that copies/uses the key
- Next.js agent pages using a `muapi_key` cookie
- API calls authenticated with `x-api-key`

Examples of affected areas:

- `src/lib/muapi.js`
- `src/components/AuthModal.js`
- `src/components/SettingsModal.js`
- `components/StandaloneShell.js`
- `app/agents/*`
- `src/components/VideoStudio.js`
- `src/components/LipSyncStudio.js`

### ORBI assessment

Storing long-lived provider secrets in browser `localStorage` is not desirable for the ORBI target architecture because any successful script injection in the same origin can potentially access them.

The cookie path also requires review for `HttpOnly`, `Secure`, `SameSite` and lifecycle semantics after the source is imported.

### ORBI target

Provider secrets should move behind a secret-storage abstraction:

- desktop: OS-backed credential storage/keychain when possible
- server: environment/secret manager
- web: server-held credentials; avoid exposing long-lived keys to browser JavaScript
- edge nodes: encrypted node-local credential store where a secret is actually required

No secret migration should occur until baseline runtime behavior is certified.

## 2. Content Security Policy

`middleware.js` adds useful headers including:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Content Security Policy

However the current CSP permits:

- `script-src 'unsafe-eval'`
- `script-src 'unsafe-inline'`
- `style-src 'unsafe-inline'`
- `connect-src` to `https://muapi.ai` and `https://*.muapi.ai`

### ORBI assessment

The headers are a positive baseline, but ORBI should eventually reduce unsafe script directives and replace the MuAPI wildcard with provider-specific dynamically generated policy or a controlled backend proxy boundary.

## 3. Network boundaries

Cloud generations and some media uploads cross the local machine boundary to MuAPI.

Wan2GP also transmits prompts/media over HTTP to a configured Gradio server. If that server is not loopback or trusted LAN/VPN, transport security and authentication need explicit treatment.

### ORBI target

Every adapter should declare a privacy boundary:

- `ON_DEVICE`
- `OWNED_LAN`
- `OWNED_REMOTE`
- `THIRD_PARTY_CLOUD`

The UI should be able to state where input media is going before execution.

## 4. Upload proxy / SSRF review

The repository contains `src/lib/uploadProxyTarget.js`, indicating the authors already recognize that arbitrary proxy targets require validation.

After import, Phase 0 runtime/security review must inspect all server-side proxy routes for:

- SSRF protections
- accepted protocols
- hostname allowlists
- redirect handling
- private-IP access
- maximum payload sizes
- content-type validation

## 5. Telemetry / analytics scan

Pre-import code search returned no obvious hits for:

- `analytics`
- `sentry`

This is only a keyword scan, **not proof of zero telemetry**.

After import, perform a dependency-level and runtime network audit for:

- analytics SDKs
- crash reporters
- remote fonts/assets
- update checks
- model-download hosts
- package postinstall network activity
- Electron external requests

## 6. Local files and generated media

The local inference system stores binaries, model weights and temporary content under an Electron user-data directory, with an override via `OPEN_GENERATIVE_AI_LOCAL_AI_DIR`.

ORBI should eventually define retention rules for:

- generated media
- uploaded reference media
- temporary files
- model caches
- prompt/history records
- failed/pending jobs

## 7. Pending-job and history storage

Observed local-storage namespaces include:

- `muapi_pending_jobs`
- `muapi_uploads`
- generation/history keys

These names also reveal provider coupling in application state. ORBI should migrate to provider-neutral storage schemas only after baseline import.

## 8. Security gates before public ORBI release

Before any public release, require:

- [ ] dependency vulnerability scan
- [ ] secret scan
- [ ] license scan
- [ ] server-route SSRF review
- [ ] Electron IPC boundary review
- [ ] CSP tightening
- [ ] API-key storage hardening
- [ ] network egress inventory
- [ ] upload size/type limits
- [ ] local file/path traversal review
- [ ] authenticated remote-node communication
- [ ] threat model for ORBI Edge Mesh

## 9. Phase 0 conclusion

No blocking malicious telemetry was identified in the preliminary keyword scan. The largest immediate design concern is **provider credentials and provider coupling in browser-accessible state**, followed by cloud upload transparency and the security of future remote compute nodes.