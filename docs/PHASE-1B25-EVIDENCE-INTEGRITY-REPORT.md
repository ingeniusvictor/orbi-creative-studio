# ORBI Creative Studio — Phase 1B.25 Evidence Integrity Report

Status: stacked on P1B.24. Human-readable integrity diagnostics only.

## Purpose

Convert P1B.23 validation plus P1B.24 fingerprint verification into a stable, human-readable integrity report.

The report is diagnostic. It does not authorize execution or claim provenance.

## Core API

`inspectEvidenceIntegrity()` accepts:

- a P1B.22 evidence export;
- a P1B.24 fingerprint;
- a Web Crypto provider;
- a report timestamp.

It returns one of:

- `INTEGRITY_VERIFIED`;
- `FINGERPRINT_MISMATCH`;
- `EXPORT_INVALID`;
- `FINGERPRINT_INVALID`;
- `CRYPTO_UNAVAILABLE`;
- `VERIFICATION_FAILED`.

## Stable failure codes

Invalid input is represented with stable reason codes rather than raw validation messages.

This avoids reflecting arbitrary or malicious input values into the human report.

Examples:

- `EXPORT_SCHEMA_OR_CONSISTENCY_INVALID`;
- `FINGERPRINT_SCHEMA_INVALID`;
- `CRYPTO_UNAVAILABLE`;
- `DIGEST_MISMATCH`;
- `FINGERPRINT_METADATA_MISMATCH`.

## Human formatter

`formatEvidenceIntegrityText()` produces a concise report showing:

- check time;
- integrity status;
- source commit;
- parity profile;
- review status;
- expected/actual SHA-256;
- reasons;
- execution authority;
- explicit authenticity and cutover boundaries.

## Authority boundary

The report always preserves:

- `authenticityVerified: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

The formatter rejects reports that attempt to claim cutover authority, authenticity verification, or non-legacy execution authority.

## Integrity versus authenticity

`INTEGRITY_VERIFIED` means the validated evidence package matches the supplied SHA-256 fingerprint and metadata.

It does not establish signer identity, trusted timestamp, origin, or provenance.

The human report explicitly states that SHA-256 alone does not prove signer identity or provenance.

## Pure behavior

P1B.25 does not:

- access filesystem;
- write reports to disk;
- trigger downloads;
- access network;
- use IPC;
- use browser storage;
- modify Router Diagnostics;
- alter providers;
- route or execute generation;
- authorize cutover.

## Merge gate

Keep stacked until P1B.3–P1B.24 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.