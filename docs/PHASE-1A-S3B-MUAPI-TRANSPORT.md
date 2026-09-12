# ORBI Creative Studio — Phase 1A S3B MuAPI Desktop Transport

Status: implementation candidate.

## Goal

Move authenticated MuAPI HTTP execution out of Electron renderer JavaScript and into the trusted main process while keeping the existing Studio/MuapiClient API stable.

## Security boundary

Renderer may provide only:

- an allowed relative `/api/v1/*` path,
- GET or POST,
- a bounded JSON body,
- or bounded upload bytes.

Renderer may not provide:

- a destination host,
- arbitrary methods,
- credential headers,
- filesystem paths,
- keychain operations,
- or a request for the decrypted provider secret.

The main process:

1. validates the IPC sender,
2. validates the MuAPI path/method,
3. resolves the MuAPI secret from `providerSecretStore`,
4. attaches `x-api-key`,
5. executes only against `https://api.muapi.ai`,
6. returns response data without the credential.

## Compatibility strategy

`MuapiClient.authenticatedFetch()` keeps web behavior unchanged.

When `window.orbiMuapi` exists, the same client routes through Electron IPC. This preserves the current image, video, I2I, I2V, V2V, lip-sync, upload and polling call sites.

## Transitional credential migration

S3B synchronizes the existing renderer-held compatibility value into secure desktop storage before the first Electron cloud request.

The legacy value is intentionally retained during S3B because multiple Studio components still use synchronous `getMuapiKey()` checks to decide whether to display AuthModal and to resume pending jobs.

Deleting the legacy renderer value is therefore S3C, not S3B.

## S3C exit criteria

- renderer authorization checks use async provider readiness rather than raw-key presence,
- Settings/Auth writes update secure desktop storage directly,
- pending-job resume no longer requires a raw key argument in Electron,
- successful one-time migration deletes legacy localStorage,
- no Electron renderer code can read a provider secret,
- hosted web compatibility remains unchanged until S4.

## Failure policy

If Electron secure storage is unavailable, desktop MuAPI cloud execution fails closed. ORBI must not silently fall back to plaintext desktop credential persistence.
