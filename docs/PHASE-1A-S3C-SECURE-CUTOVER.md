# ORBI Creative Studio — Phase 1A S3C Secure Desktop Credential Cutover

Status: implementation candidate.

## Goal

Make Electron secure provider storage authoritative and remove the legacy MuAPI key from renderer-accessible storage after a successful one-time migration.

## Runtime split

Hosted/browser mode keeps the existing compatibility path until S4.

Electron mode:

1. detects the secure credential bridge,
2. reads the legacy key only for migration,
3. writes it into the S3A OS-backed store,
4. verifies readiness,
5. deletes renderer localStorage/cookie/runtime injection,
6. never returns the provider secret to renderer JavaScript.

## Studio changes

Image, Video, LipSync, Cinema and UploadPicker no longer use synchronous raw-key presence checks.

They call `hasMuapiCredential()`, which:

- uses normal browser compatibility outside Electron,
- uses secure-store readiness in Electron.

The existing `MuapiClient.getKey()` returns only a non-secret desktop sentinel when Electron transport is active. The actual credential is attached exclusively by the S3B main-process transport.

## Auth and Settings

Desktop Auth/Settings writes go through `setMuapiCredential()`.

On Electron the key is written directly into secure main-process storage and legacy renderer storage is cleared.

On hosted/browser mode the compatibility storage behavior remains unchanged until S4.

## Migration safety

Legacy storage is deleted only after `setMuapiKey()` on the Electron credential bridge resolves successfully.

If secure storage is unavailable, migration fails closed and the old value is not deliberately copied into another plaintext fallback.

## Exit criteria

- Electron `getMuapiKey()` returns null.
- Studio authorization gates use secure readiness.
- legacy `muapi_key` localStorage is removed after successful migration.
- no preload API can return a decrypted provider secret.
- MuAPI requests continue through S3B trusted main-process transport.
- hosted-web behavior remains unchanged pending S4.
