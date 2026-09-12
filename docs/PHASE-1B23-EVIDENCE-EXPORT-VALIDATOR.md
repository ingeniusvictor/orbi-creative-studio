# ORBI Creative Studio — Phase 1B.23 Offline Evidence Export Validator

Status: stacked on P1B.22. Pure offline validation only.

## Purpose

Validate a previously serialized P1B.22 evidence JSON package without trusting its stored summary fields.

The validator checks structural integrity and internal consistency only. It does not prove who produced the JSON.

## Core APIs

`validateCertificationReleaseEvidenceExport(bundle)` validates an already-parsed object.

`parseCertificationReleaseEvidenceExport(json)` parses JSON, validates it, and deep-freezes the parsed bundle.

## Strict schema

The validator requires exact field sets for:

- export root;
- parity binding/certification/routes;
- release gates/proofs;
- review summary/routes.

Unknown fields are rejected instead of ignored.

## Parity validation

The validator independently checks:

- `PARITY_CERTIFICATION_BOUND`;
- binding marked valid;
- strict P1B.9 freshness limits;
- exact P1B.12 9-route target profile;
- provider/operation identity;
- minimum sample/model coverage;
- all samples match;
- zero blocked/mismatch evidence;
- route/global certification.

## Release validation

The validator recomputes release gates from exported proof summaries:

- CI;
- Linux;
- macOS;
- Windows;
- security review;
- rollback plan.

It also recomputes expected release issues, release readiness and release status.

A manually flipped gate therefore fails validation.

## Review validation

The validator checks:

- route identities;
- eligible/blocked route counts;
- blocker reasons;
- missing release gate count;
- presence of release-gate blockers;
- `READY_FOR_REVIEW` consistency.

## Authority boundary

The validator rejects any export claiming:

- `cutoverAuthorized: true`;
- non-legacy execution authority.

Validated output always reports:

- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

## Authenticity limitation

The result explicitly contains:

`authenticityVerified: false`

This is intentional.

P1B.23 detects tampering/inconsistency but provides no cryptographic signature, trusted timestamp, signer identity or external attestation.

Passing validation must not be interpreted as proof of provenance.

## Pure offline behavior

P1B.23 does not:

- access filesystem;
- use network;
- use IPC;
- use browser storage;
- modify diagnostics UI;
- execute providers;
- route generation;
- authorize cutover.

## Merge gate

Keep stacked until P1B.3–P1B.22 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.