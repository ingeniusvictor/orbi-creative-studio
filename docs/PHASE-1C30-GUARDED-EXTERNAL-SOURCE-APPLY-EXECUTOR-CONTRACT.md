# P1C30 — Guarded External Runtime Certification Source Apply Executor Contract

## Purpose

P1C30 defines the first executor boundary capable of handing an exact, reviewed P1C28 source-update plan to an external writer.

The module itself still has no filesystem, Git, GitHub, Electron IPC, or runtime-registry mutation capability.

Its default executor is intentionally non-operational because both the final-state reader and external writer are configured as `null`.

## Preconditions

Execution requires all of the following:

1. a valid P1C28 plan with status `guarded-source-apply-ready`;
2. `sourceApplyEligible: true`;
3. runtime loader compatibility already established by P1C29;
4. a valid P1C31 real-evidence provenance attestation bound to the exact plan;
5. explicit human source-apply approval;
6. a configured final-state reader;
7. a configured external writer;
8. final repository/source state still matching the exact P1C28 expectation.

## P1C31 provenance precondition

Before source-apply approval can become executable, P1C30 requires:

`p1c31-real-evidence-provenance-attestation`

The attestation must match the exact target and P1C28 plan identity. Missing, invalid, fixture, synthetic, demo, or stale provenance prevents the final-state read and prevents writer invocation.

This check preserves `cryptographicAuthenticityVerified: false`; it validates trusted acquisition provenance and chain binding, not a cryptographic signature.

## Explicit apply approval

Before reading final state, P1C30 requires:

- `sourceApplyApproved: true`;
- operator ID;
- operator display name;
- non-empty approval note;
- explicit approval timestamp.

The operator identity remains represented truthfully as:

`operatorIdentityVerified: false`

Missing or rejected approval prevents both final-state reading and writer invocation.

## Final state revalidation

Immediately before constructing the external write request, P1C30 revalidates:

- base commit SHA;
- source blob SHA;
- source revision;
- certification count.

Each dimension has an independent stale-state rejection:

- `SOURCE_APPLY_FINAL_BASE_COMMIT_STALE`;
- `SOURCE_APPLY_FINAL_SOURCE_BLOB_STALE`;
- `SOURCE_APPLY_FINAL_SOURCE_REVISION_STALE`;
- `SOURCE_APPLY_FINAL_CERTIFICATION_COUNT_STALE`.

The external writer is never invoked when any final-state dimension is stale.

## External write request

A successful preflight creates exactly one immutable request:

`p1c30-external-source-control-update-request`

The request contains:

- operation type `replace-source-controlled-file`;
- exact target path;
- exact expected base commit/blob/revision/count;
- exact proposed source revision/count/content;
- expected mutation count of 1;
- explicit apply approval;
- non-authorizing runtime boundaries.

The source content remains internal and is passed only to the injected writer.

## Injected writer only

P1C30 does not import or call any concrete writer.

The factory accepts:

`applySourceUpdate`

as an injected callback.

The default executor has:

- `readCurrentState = null`;
- `applySourceUpdate = null`.

Therefore the application/runtime cannot mutate the repository through P1C30 unless a later phase deliberately wires an external implementation.

Tests use fake in-memory callbacks only to certify control flow.

## Exactly-once attempt semantics

P1C30 records an execution attempt **before** invoking the external writer.

After writer invocation:

- a valid receipt completes the attempt;
- a thrown writer or invalid receipt is treated as indeterminate;
- automatic retry is permanently blocked for that exact plan identity.

This is deliberate. If transport fails after an external write may have occurred, automatically retrying could produce a second mutation.

The caller must reconcile repository state externally before any later recovery mechanism is designed.

## External receipt validation

A successful external receipt must prove:

- `applied: true`;
- exactly one mutation;
- exact target path;
- exact previous base commit SHA;
- exact previous source blob SHA;
- valid new commit SHA;
- valid new source blob SHA;
- exact proposed source revision;
- exact proposed certification count.

Malformed or contradictory receipts are treated as indeterminate, not success.

## Sanitized result

A successful result exposes only:

- target;
- previous commit/blob identity;
- new commit/blob identity reported by the external writer;
- resulting source revision/count;
- mutation count;
- guard/authority state.

It does not expose:

- proposed source content;
- operator ID;
- operator display name;
- approval note;
- raw P1C8 certification evidence.

## Runtime authority remains unchanged

Even when an injected test writer reports success:

- `sourceMutationAppliedByModule: false`;
- `runtimeRegistryLoaded: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`;
- `sourceControlAuthority: external-injected-writer-only`.

P1C30 can validate and invoke an injected source-control boundary. It cannot itself become a source-control implementation or compute-routing authority.

## Actual governed source

P1C30 must not change:

`src/lib/computeRouter/runtimeResourceProfileCertifications.mjs`

Until a real reviewed certification exists and a deliberately connected source-control implementation is introduced, the source remains revision 1 with zero certifications.
