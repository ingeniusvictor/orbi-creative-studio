# Phase 1A / S3 — Desktop Provider Secret Store

Status: **S3 foundation implemented; legacy credential migration intentionally NOT activated yet.**

Base lineage: `integration/orbi-foundation` after S2.

## What this stage adds

Electron now has a main-process-owned provider secret store based on Electron `safeStorage`.

Security properties:

- encrypted provider values are persisted under Electron `userData`, not browser `localStorage`;
- provider values are encrypted before writing to disk;
- the renderer has no filesystem or generic keychain access;
- preload exposes only MuAPI readiness, set/update and delete operations;
- IPC rejects non-main-frame and non-`file://` senders;
- Linux `basic_text` is rejected rather than silently accepted as secure storage;
- if OS encryption is unavailable, the store reports unavailable and refuses writes;
- corrupt store files are reported and not silently overwritten;
- writes use a temporary file + rename and request restrictive filesystem permissions where supported.

## Why legacy migration is not active yet

The current Electron renderer still performs MuAPI HTTP requests itself. That renderer therefore still needs the provider credential at request time.

Clearing the legacy browser value immediately after copying it into main-process secure storage would make cloud generation fail after restart unless we did one of the following:

1. expose a secret-read IPC back to the renderer; or
2. move provider-authenticated MuAPI transport behind a main-process/server boundary.

Option 1 would improve persistence-at-rest but would still hand the secret back to renderer JavaScript. ORBI's target design is stronger: keep the stored credential in the trusted process and execute authenticated provider transport behind that boundary.

Therefore this change deliberately stops before destructive migration.

## Exposed desktop bridge

`window.orbiCredentials` exposes only:

- `getMuapiReadiness()`
- `setMuapiKey(value)`
- `deleteMuapiKey()`

There is **no `getMuapiKey()` bridge**.

## Persistence format

File:

`<Electron userData>/orbi-security/provider-secrets.json`

The file contains versioned metadata and base64-encoded ciphertext returned by Electron `safeStorage`; it must never contain plaintext provider credentials.

## Platform policy

### Windows

Use Electron/OS protected storage when `safeStorage.isEncryptionAvailable()` is true.

### macOS

Use Electron/Keychain-backed storage when available. Consistent production behavior remains tied to stable code signing, so unsigned/ad-hoc certification builds are not considered final Keychain certification.

### Linux

Use the selected secret-service/keyring backend only when Electron reports encryption available and the selected backend is not `basic_text`.

`basic_text` is treated as **not secure** and writes are refused.

## Tests added

`tests/providerSecretStore.test.js` verifies:

- encrypted-at-rest round trip;
- readiness and presence state;
- deletion;
- rejection of Linux `basic_text`;
- rejection when OS encryption is unavailable;
- corrupt-store protection;
- constrained provider/secret identifiers.

## S3 completion gate

S3 is complete only after provider-authenticated desktop traffic no longer depends on persistent renderer-readable credentials.

Recommended next implementation:

1. introduce a desktop MuAPI transport in the Electron main process (or equivalent trusted provider adapter);
2. have renderer code request operations rather than retrieve the secret;
3. implement one-time migration:
   - read legacy browser credential once;
   - call secure `setMuapiKey`;
   - verify secure readiness/presence;
   - remove legacy `localStorage` value;
   - never recreate it on Electron;
4. certify restart behavior and generation parity;
5. keep hosted web migration separate as S4.

## Non-goals of this foundation commit

- no hosted-web session change;
- no automatic deletion of legacy credentials;
- no generic secret retrieval to renderer;
- no provider routing changes;
- no branding changes.
