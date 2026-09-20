# P1C31 — Real Evidence Provenance Gate

## Purpose

P1C31 separates two concepts that were previously easy to confuse:

1. **structurally valid benchmark/certification evidence**; and
2. **evidence actually acquired through the trusted Electron controlled-benchmark path**.

Fixtures, synthetic samples, demo data, and manually constructed test objects may continue to satisfy lower-level schema tests, but they must not cross the source-apply execution boundary.

P1C31 adds a provenance gate immediately before P1C30 can proceed.

## Acquisition proof origin

The controlled benchmark already resolves sensitive runtime state in Electron Main:

- installed runtime;
- pinned runtime manifest;
- runtime installation integrity;
- installed model state;
- build/source identity;
- real `sd-cli` benchmark execution;
- runtime/model/auxiliary hashes.

P1C31 uses that existing trusted boundary to emit a separate acquisition proof:

`p1c31-real-benchmark-acquisition-proof`

The proof is not inserted into the historical P1C7 run-evidence schema. It travels separately.

## Why provenance is separate from P1C7

P1C7 remains the evidence contract used by the review/certification pipeline.

Changing the exact P1C7 envelope would unnecessarily invalidate a large set of established contracts.

Instead:

- P1C7 remains unchanged;
- P1C21 stores provenance in a separate in-memory provenance store;
- review evidence remains review evidence;
- P1C31 later requires the separate provenance chain before source apply.

This lets legacy and fixture-shaped tests continue exercising older contracts without gaining production provenance authority.

## Real acquisition proof

Each proof must declare:

- `origin: electron-main-controlled-benchmark`;
- `evidenceClass: real-runtime-measurement`;
- `trustedMainProcess: true`;
- `runtimeIntegrityVerified: true`;
- `runtimeManifestPinned: true`;
- `modelStateResolved: true`;
- `buildIdentityResolved: true`;
- `benchmarkProcessExecuted: true`;
- `fixture: false`;
- `synthetic: false`;
- `demo: false`.

It binds:

- model/backend/resolution;
- run index;
- harness version;
- source commit;
- runtime identity/version;
- runtime binary hash;
- model artifact hash;
- auxiliary artifact hashes.

The proof exposes no filesystem paths.

## Cryptographic limitation

P1C31 does **not** claim a cryptographic signature or remote attestation.

Therefore every proof and attestation preserves:

`cryptographicAuthenticityVerified: false`

The guarantee is provenance through the trusted Electron Main acquisition path and cross-contract binding, not cryptographic non-forgeability outside the running application.

## Three-run requirement

A verified provenance chain requires exactly three acquisition proofs with run indexes:

`[1, 2, 3]`

All three must share one exact benchmark context:

- harness;
- source commit;
- runtime identity/version;
- runtime binary hash;
- model artifact hash;
- auxiliary artifacts.

Any drift is rejected.

## Certification binding

P1C31 validates the P1C24 promotion package and proves that the P1C8/P1C4 certification agrees with the acquisition proofs on:

- target;
- controlled-benchmark method;
- sample count;
- harness version;
- source commit;
- run indexes;
- auxiliary hashes.

A structurally valid certification constructed from unrelated evidence is rejected.

## Source-plan binding

P1C31 also validates the P1C28 dry-run plan.

The exact promoted certification entry must still be present in the deterministic proposed source module.

A source plan whose contents diverge from the bound certification is rejected.

## P1C31 attestation

Successful verification creates:

`p1c31-real-evidence-provenance-attestation`

with status:

`real-evidence-provenance-verified`

The attestation is bound to the exact P1C28 plan:

- base commit SHA;
- source blob SHA;
- base source revision;
- base certification count;
- proposed source revision;
- proposed certification count.

This prevents an attestation from being reused for a later/different source plan for the same model.

## P1C30 integration

P1C30 now requires a valid P1C31 attestation before:

- accepting source-apply approval as executable;
- reading final repository/source state;
- invoking the external writer.

Missing provenance returns:

`SOURCE_APPLY_REAL_EVIDENCE_PROVENANCE_MISSING`

Invalid or stale provenance returns:

`SOURCE_APPLY_REAL_EVIDENCE_PROVENANCE_INVALID`

The writer is never invoked in either case.

## Fixtures remain useful but non-promotable

Tests can still construct fixture P1C7/P1C8/P1C24 objects to validate contract logic.

Those objects do not automatically receive P1C31 acquisition proofs.

Therefore:

- fixture tests remain useful;
- fixture evidence can exercise lower-level contracts;
- fixture evidence cannot cross P1C31 into source apply.

## Sanitized public summary

The public provenance summary exposes only:

- target;
- run count/indexes;
- origin/evidence class;
- real-vs-fixture flags;
- acquisition checks;
- certification/source-plan binding checks;
- base/proposed source revisions;
- safety/authority boundaries.

It does not expose:

- runtime/model/auxiliary hashes;
- source module contents;
- reviewer identity;
- review notes;
- raw certification records.

## Authority boundary

P1C31 preserves:

- `sourceMutationApplied: false`;
- `runtimeRegistryLoaded: false`;
- `authenticityVerified: false`;
- `cryptographicAuthenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

P1C31 verifies provenance. It does not write the source, load the runtime registry, or activate routing.

## Actual runtime source

The governed runtime source must remain:

- revision 1;
- zero committed certifications;

until a real three-run benchmark is captured through the trusted Electron path, explicitly reviewed/certified, and later applied through a deliberately connected external source-control implementation.
