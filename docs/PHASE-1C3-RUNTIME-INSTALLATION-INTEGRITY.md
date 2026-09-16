# ORBI Creative Studio — Phase 1C3 Runtime Installation Integrity

Status: pinned-installation integrity evidence candidate.

## Purpose

Close the first P1C2 evidence gap by measuring whether the current local sd.cpp binary is still the binary installed from an archive that was verified against the pinned runtime manifest.

This phase intentionally uses the term **installation integrity**, not publisher authenticity.

## Evidence chain

For runtime downloads managed by ORBI:

1. resolve the platform/backend entry from `runtimeManifest.js`;
2. download the exact pinned archive;
3. verify the archive against the manifest SHA-256;
4. extract and place the runtime binary;
5. compute SHA-256 of the installed binary;
6. write a bounded local installation receipt containing only runtime identity, pinned archive SHA-256, binary filename/hash and install timestamp;
7. on future readiness checks, re-hash the current binary and compare it with the receipt;
8. require the receipt runtime identity and archive SHA-256 to still match the current pinned manifest.

## Claims intentionally NOT made

A successful result means:

- the receipt is bound to the currently pinned archive identity;
- the current binary matches the binary hashed immediately after that verified archive installation.

It does **not** prove:

- publisher identity;
- code signing identity;
- remote provenance beyond the pinned archive hash;
- resistance to an attacker that can modify both the local runtime and local receipt.

Every result therefore keeps:

- `authenticityVerified: false`;
- `tamperResistance: local-receipt-not-tamper-proof`.

## Fail-closed behavior

The following remain unverified:

- binary exists but installation receipt is missing;
- manually supplied runtime;
- bundled runtime copied without equivalent receipt evidence;
- receipt does not match current pinned manifest;
- current binary hash changed;
- malformed, oversized or unreadable receipt.

None of these states are silently promoted to compatibility readiness.

## Readiness boundary

Only these sanitized fields cross into provider readiness:

- runtime backend;
- whether the runtime entry is manifest-pinned;
- whether installation integrity verified.

Binary hashes, archive hashes, local paths and receipt contents remain in the Electron main process.

## P1C2 semantic refinement

P1C3 replaces the ambiguous P1C2 field `installedProvenanceVerified` with:

- `installedIntegrityVerified`

and the reason code:

- `INSTALLED_RUNTIME_INTEGRITY_UNVERIFIED`

This more accurately describes what the local evidence proves.

## Runtime impact

P1C3 adds integrity evidence to managed runtime installation/readiness. It does not:

- select providers;
- change routing eligibility;
- execute generation through the Compute Router;
- authorize cutover.

P1C2 still enforces:

- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next step

P1C4 should add curated model resource profiles (system RAM/VRAM requirements with explicit evidence status) before compatibility can influence provider readiness.
