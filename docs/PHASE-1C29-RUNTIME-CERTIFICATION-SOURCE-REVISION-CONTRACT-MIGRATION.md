# P1C29 — Runtime Certification Source Revision Contract Migration

## Purpose

P1C29 deliberately migrates the runtime certification source contract from supporting only revision 1 to supporting revisions 1 and 2.

This migration exists so a valid P1C28 dry-run for a reviewed revision-2 source proposal can become loader-compatible before any source mutation is attempted.

## Exact supported revision set

The runtime loader exports:

`RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS`

P1C29 changes the closed set from:

`[1]`

to:

`[1, 2]`

No wildcard, range, or future revision is accepted.

Revision 3 remains invalid until a separate explicit migration.

## Compatibility behavior

After P1C29:

- revision 1 remains valid;
- revision 2 becomes valid;
- revision 3 remains rejected with `RUNTIME_CERTIFICATION_SOURCE_IDENTITY_INVALID`.

The source schema remains unchanged:

- `schemaVersion: 1`;
- `sourceType: source-controlled-static-bundle`;
- certifications array;
- non-authorizing authority fields.

## Authority constraints remain unchanged

Supporting revision 2 does not weaken any runtime source authority rule.

Both revisions 1 and 2 still require:

- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`;
- deeply frozen source data.

A source claiming routing, cutover, authenticity, or alternate execution authority is rejected.

## Relationship to P1C28

P1C28 reads the supported revision set dynamically.

Before P1C29, a valid P1C27 proposal for revision 2 produced:

`RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_BLOCKED`

because the loader supported only revision 1.

After P1C29, the same valid guarded proposal can produce:

`RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_READY`

with:

- `runtimeLoaderCompatible: true`;
- `runtimeLoaderMigrationRequired: false`;
- `sourceApplyEligible: true`.

This READY state means only that the guarded dry-run contract sees a loader-compatible proposed revision. It does not write the source.

## Actual runtime source remains unchanged

P1C29 does not modify:

`src/lib/computeRouter/runtimeResourceProfileCertifications.mjs`

The real source remains:

- source revision 1;
- zero committed certifications;
- non-authorizing.

The existing runtime loader therefore continues loading the same empty revision-1 registry after P1C29.

## No activation boundary

P1C29 does not:

- write certification source content;
- create or update Git commits at runtime;
- load a revision-2 production source;
- add UI controls;
- enter application startup;
- enter Image Studio or Video Studio;
- enable compute routing;
- authorize cutover.

It changes only the accepted source-revision contract.

## Next boundary

After P1C29, the revision-contract blocker identified by P1C28 is removed.

A later phase may define the first actual guarded source-apply operation, but that operation must still:

1. use a real reviewed P1C27/P1C28 chain rather than fixture evidence;
2. re-read and compare the exact canonical commit and source blob immediately before mutation;
3. fail closed on stale state;
4. remain separate from routing/cutover activation.
