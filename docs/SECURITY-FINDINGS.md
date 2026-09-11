# ORBI Creative Studio — Phase 0 Security Findings

Status: **STATIC REVIEW ONLY**

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

This file records findings before ORBI-specific changes. It is not an accusation against the upstream project; it is a hardening backlog for our derived build.

## Positive controls already present upstream

Observed protections include:

- Electron `contextIsolation: true`
- Electron `nodeIntegration: false`
- Electron `webSecurity: true`
- a preload bridge exposing a narrow local-AI IPC surface
- CSP and other HTTP security headers in Next.js middleware
- upload-proxy target validation
- rejection of private/local IP literals in the upload proxy
- blocked executable/script-like upload extensions and MIME types
- HTTPS-only enforcement for upload proxy targets

These are useful foundations and should be preserved.

## SEC-01 — Wan2GP server URL trust boundary

Severity: **Medium**

`electron/lib/wan2gpProvider.js` persists and probes a user-supplied URL with no explicit protocol or host allowlist.

The configured base URL is then used for:

- `/config`
- `/info`
- `/api`
- `/gradio_api/info`
- file uploads
- generation calls
- generated file URLs

Risk:

A renderer-level compromise, malicious imported configuration, or unsafe user input could direct the privileged Electron main process toward arbitrary HTTP/HTTPS hosts, including local-network services.

Recommended ORBI hardening:

- parse and validate URL before persistence
- allow only `http:` and `https:`
- default to loopback/private LAN only for "local server" mode
- require explicit opt-in for public WAN endpoints
- reject credentials in URL
- optionally maintain a trusted-node registry for ORBI Edge Mesh
- add tests for loopback, RFC1918 LAN, public WAN, malformed URLs, and alternate schemes

## SEC-02 — Electron external-link scheme filtering

Severity: **Medium**

`electron/main.js` currently calls:

`shell.openExternal(url)`

for every URL received through `setWindowOpenHandler`.

Recommended ORBI hardening:

- permit only `https:` by default
- optionally permit `http:` only for trusted local development
- reject `file:`, custom schemes, and unexpected protocols
- add unit coverage for URL scheme validation

## SEC-03 — MuAPI key stored in JavaScript-readable storage

Severity: **Medium**

The MuAPI key is stored in `localStorage` and also synchronized to a JavaScript-readable `muapi_key` cookie for agent routes.

Observed cookie construction:

- long lifetime
- `SameSite=Lax`
- no `HttpOnly` because it is set from JavaScript

This increases the impact of any future XSS.

Recommended ORBI direction:

- do not make MuAPI the architectural identity primitive
- introduce a provider secret abstraction
- on Electron, prefer OS-backed secure credential storage if available
- for web deployment, keep provider secrets server-side where practical
- minimize browser-readable long-lived credentials
- preserve CSP and reduce `unsafe-inline` / `unsafe-eval` where feasible

## SEC-04 — CSP is protective but permissive

Severity: **Low/Medium**

The current CSP includes:

- `script-src 'unsafe-eval' 'unsafe-inline'`
- `style-src 'unsafe-inline'`
- broad HTTPS media/image access

This may be necessary for the current app, but ORBI should attempt to reduce the permissive directives after baseline functionality is certified.

## SEC-05 — Runtime binary/model supply chain

Severity: **Medium**

The application can download:

- sd.cpp binaries from GitHub releases
- model weights from Hugging Face

The static review did not find an integrity manifest that pins cryptographic hashes for all downloaded binaries and weights.

Recommended ORBI hardening:

- maintain a signed/committed asset manifest
- pin expected SHA-256 values where practical
- record source URL, model license, model revision, and expected file size
- validate downloads before execution
- distinguish "ORBI trusted" from "user-added" models

## SEC-06 — Model-license and content-policy separation

Severity: **Governance**

The application UI aggregates many cloud and local models. Code licensing and model-weight licensing are separate concerns.

ORBI should track per model:

- code/runtime license
- weight/model license
- commercial-use status
- attribution requirements
- redistribution restrictions
- provider terms
- local/cloud availability

## Recommended order

1. Preserve baseline unchanged.
2. Import and build.
3. Add tests around URL validation.
4. Implement provider-secret abstraction.
5. Add asset/model provenance manifest.
6. Only then add ORBI Edge Mesh routing and Android nodes.
