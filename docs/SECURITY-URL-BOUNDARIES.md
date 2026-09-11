# ORBI Creative Studio — URL Boundary Hardening Result

Validation date: 2026-09-11

Branch:

`security/url-boundaries`

Base:

`security/batch-a-lock-safe@7d852659d053995dbf9ca36b236854aac99406ab`

Validation run:

`34654349553`

## Result

**PASS**

The hardening branch adds explicit trust-boundary validation for:

1. Electron external links,
2. Wan2GP configured server URLs.

Validation after the change:

- root tests: **22/22 PASS**
- workspace builds: PASS
- Next.js production build: PASS
- Electron/Vite renderer build: PASS

The original 17 baseline tests remain green and 5 new URL-policy tests were added.

## Electron external links

Before:

`shell.openExternal(url)` accepted any URL delivered to the window-open handler.

After:

- only `http:` and `https:` are permitted;
- URLs with embedded credentials are rejected;
- schemes such as `file:`, `javascript:` and `data:` are blocked;
- blocked URLs are not sent to the operating system shell.

HTTP remains permitted here because generated/local Wan2GP media can legitimately use a local HTTP URL. The security boundary is scheme restriction, not a blanket HTTPS requirement for user-visible links.

## Wan2GP provider URLs

New normalization policy:

### HTTP permitted for

- `localhost`
- `.local` hostnames
- IPv4 loopback
- RFC1918 IPv4 LAN addresses
- IPv6 loopback

### HTTPS permitted for

- public hostnames/endpoints

### Rejected

- non-HTTP(S) schemes
- embedded username/password credentials
- query strings/fragments in the configured base URL
- IPv4 link-local `169.254.0.0/16`
- public HTTP endpoints

This preserves common local GPU-server setups while reducing accidental public cleartext endpoints and obvious SSRF/metadata-service exposure.

## Files changed

- `electron/lib/urlPolicy.js` — new policy helper
- `electron/main.js` — external-link enforcement
- `electron/lib/wan2gpProvider.js` — endpoint normalization/enforcement
- `tests/urlPolicy.test.js` — 5 policy tests

## Remaining trust work

This is not a complete trusted-node architecture.

Future ORBI Edge/Wan2GP hardening should still add:

- explicit trusted-node registry,
- resolved-IP / DNS-rebinding considerations where appropriate,
- TLS/certificate policy for public nodes,
- user-visible trust state,
- node identity/capability handshake,
- no silent provider fallback across trust boundaries.

## Integration status

Validated but **not merged into main or immutable upstream baseline**.

It should be integrated only into the selected ORBI foundation branch after security-branch selection.
