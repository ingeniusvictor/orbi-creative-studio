# ORBI Creative Studio — Phase 1B.24 Evidence Fingerprint

Status: stacked on P1B.23. Deterministic integrity fingerprint only.

## Purpose

Create a deterministic SHA-256 fingerprint for a P1B.22 evidence export after it passes P1B.23 offline validation.

The fingerprint detects whether two validated evidence packages are byte-equivalent after canonicalization.

It is not a digital signature and does not prove who created the evidence.

## Canonicalization

`canonicalizeEvidenceExport()` first validates the evidence package with P1B.23.

It then serializes JSON canonically:

- object keys sorted lexicographically at every level;
- array order preserved;
- JSON string escaping preserved;
- finite JSON numbers only;
- booleans/null encoded canonically.

This makes the digest independent of ordinary JavaScript object insertion order.

## SHA-256

`createEvidenceFingerprint()` calculates SHA-256 using Web Crypto `subtle.digest` over UTF-8 canonical evidence.

The result records:

- schema version;
- algorithm `SHA-256`;
- 64-character lowercase digest;
- canonical byte length;
- source commit;
- parity profile;
- review state;
- non-authorizing execution state.

## JSON input

`createEvidenceFingerprintFromJson()` parses and validates a serialized P1B.22 package through P1B.23 before hashing.

Fingerprinting an invalid/tampered export therefore fails before digest calculation.

## Verification

`verifyEvidenceFingerprint()` recalculates the fingerprint and reports:

- overall match;
- digest match;
- metadata match;
- actual digest;
- source/review identity.

A changed but separately valid evidence package produces a different SHA-256.

## Cryptographic boundary

SHA-256 provides a deterministic integrity fingerprint only.

The fingerprint always states:

- `authenticityVerified: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

Anyone able to modify an unsigned JSON package can also calculate a new SHA-256. Therefore the fingerprint alone does not establish provenance or signer identity.

## Platform behavior

The production module uses browser/Electron Web Crypto and contains no Node crypto dependency.

If Web Crypto SHA-256 is unavailable, fingerprint creation fails closed with:

`EVIDENCE_FINGERPRINT_CRYPTO_UNAVAILABLE`

## Pure behavior

P1B.24 does not:

- write files;
- trigger downloads;
- access network;
- use IPC;
- use storage;
- modify Router Diagnostics;
- alter providers;
- route or execute generation;
- authorize cutover.

## Merge gate

Keep stacked until P1B.3–P1B.23 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.