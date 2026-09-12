# ORBI Creative Studio — Phase 1D Model Download Integrity (Preparation)

Status: implementation prepared on top of MODEL-01. **Do not merge before the provenance manifest is certified and merged.**

## Goal

Make local model provenance enforceable, not merely documentary.

A model/auxiliary asset must not become a usable final file until its exact byte size and SHA-256 match the governed catalog metadata.

## Download lifecycle

1. download/resume into `<final>.download.part`;
2. complete network transfer into `<final>.download`;
3. verify exact byte size;
4. verify SHA-256;
5. atomically rename staging to the final model filename;
6. cache the successful verification for the unchanged file during the current app session.

A crash after step 2 is recoverable: on the next explicit download action, ORBI verifies the completed staging file and promotes it without redownloading when valid.

## Existing files

Files installed by older ORBI builds may not have been integrity-verified.

Before local generation:

- the selected model is verified;
- required Z-Image text encoder is verified;
- required Z-Image VAE is verified.

A wrong-size model is also reported as `integrity-failed` in model-list state, so the UI does not show it as ready.

## Cache boundary

Successful SHA verification is cached only for an unchanged file fingerprint:

- path
- exact size
- modification time
- change time
- expected SHA-256

The cache is in-memory and disappears on app restart.

This avoids hashing multi-GB weights on every generation while still revalidating after observable filesystem changes.

## Failure policy

- size mismatch → reject;
- hash mismatch → reject;
- missing/invalid provenance metadata → reject;
- failed staged verification → delete staging, never create final file;
- existing corrupt file encountered during explicit Download → delete the corrupt file and redownload;
- no plaintext/network fallback and no “accept anyway” path.

## Scope

Covered assets are inherited from `electron/lib/modelProvenance.json` / governed catalog metadata:

- six sd.cpp models;
- Qwen3-4B Z-Image text encoder;
- Z-Image VAE.

## Non-goals

This phase does not:

- decide legal redistribution rights;
- download new model families;
- change Compute Router policy;
- certify model performance;
- add distributed inference;
- merge while MODEL-01 or CI is unresolved.

## Merge dependency

1. MODEL-01 provenance v1 green + merged.
2. Rebase/recreate P1D from canonical integration branch.
3. Full P1D CI green.
4. Global Linux/macOS/Windows foundation certification green.
