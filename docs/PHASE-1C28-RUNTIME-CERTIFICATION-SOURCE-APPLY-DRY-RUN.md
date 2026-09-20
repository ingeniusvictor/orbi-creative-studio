# P1C28 — Guarded Runtime Certification Source Apply Dry-Run

## Purpose

P1C28 converts a valid P1C27 source-commit handoff into an exact guarded source-apply operation **without performing any source mutation**.

Its job is to answer two separate questions before any future write:

1. Is the P1C27 handoff still bound to the exact current repository/source state?
2. Would the proposed source revision be accepted by the current runtime loader contract?

A dry-run is considered apply-eligible only when both conditions hold.

## Loader compatibility after P1C29

P1C28 originally discovered that the runtime loader accepted only source revision 1.

P1C29 deliberately migrates the loader contract to:

`RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS = [1, 2]`

The real governed source remains revision 1 and empty, but a reviewed P1C27 proposal for revision 2 is now loader-compatible.

Therefore the default P1C28 result for a valid revision-2 proposal is:

`RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_READY`

with:

- `runtimeLoaderCompatible: true`;
- `runtimeLoaderMigrationRequired: false`;
- `sourceApplyEligible: true`.

This still does not perform or authorize a source mutation by itself.

## Preconditions

P1C28 requires:

- exact target;
- valid current runtime certification source;
- matching P1C25 materialization;
- matching valid P1C26 review artifact;
- matching valid P1C27 source-commit handoff;
- exact current base commit SHA;
- exact current source blob SHA;
- a valid loader capability list.

## Guarded state validation

P1C28 reuses:

`validateRuntimeCertificationSourceCommitHandoffAgainstState(...)`

immediately during planning.

The dry-run is rejected if any of these changed:

- base commit SHA;
- source blob SHA;
- source revision;
- certification count.

No plan is stored when stale state is detected.

## Handoff/review binding

P1C28 revalidates the P1C26 artifact against its P1C25 materialization.

It then proves that the P1C27 handoff and P1C26 review artifact still agree on:

- exact target;
- proposed source revision;
- proposed certification count;
- exact proposed source content.

A divergent or tampered handoff is rejected before operation planning.

## Loader compatibility gate

P1C28 normalizes the declared supported source revisions and checks the proposed revision against that list.

If the proposed revision is not supported:

- `runtimeLoaderCompatible: false`;
- `runtimeLoaderMigrationRequired: true`;
- `sourceApplyEligible: false`;
- plan status is `runtime-loader-migration-required`.

With P1C29, revision 2 is explicitly supported:

- `runtimeLoaderCompatible: true`;
- `runtimeLoaderMigrationRequired: false`;
- `sourceApplyEligible: true`;
- plan status is `guarded-source-apply-ready`.

P1C28 still tests the blocked state by injecting an older capability list that omits revision 2, so the migration guard remains fail-closed.

## Internal dry-run plan

A prepared plan is:

`p1c28-runtime-certification-source-apply-dry-run`

The exact operation is:

`replace-source-controlled-file`

with:

- target path;
- content format;
- write strategy `external-source-control-update`;
- expected mutation count of 1;
- expected current base commit SHA;
- expected current source blob SHA;
- expected current source revision;
- expected current certification count;
- proposed source revision;
- proposed certification count;
- exact proposed source content.

The raw proposed source remains internal.

## Sanitized summary

The summary exposes:

- target context;
- target path;
- base commit SHA;
- source blob SHA;
- base/proposed source revisions;
- before/after certification counts;
- declared supported source revisions;
- handoff/stale/review/candidate-registry guard status;
- loader compatibility;
- loader migration requirement;
- source apply eligibility;
- authority boundaries.

It does not expose:

- proposed source module contents;
- reviewer ID;
- reviewer display name;
- review note;
- raw P1C8 certification evidence.

## Mutation boundary

P1C28 has no capability to:

- write files;
- update GitHub;
- create commits or refs;
- change the governed runtime source;
- use Electron IPC;
- load the runtime certification registry;
- enter Settings or Router Diagnostics;
- influence Image Studio or Video Studio;
- enable routing;
- authorize cutover.

The real source remains revision 1 with zero committed certifications.

## Authority boundary

Every P1C28 plan preserves:

- `dryRunOnly: true`;
- `guardedApplyRequired: true`;
- `sourceMutationApplied: false`;
- `runtimeRegistryLoaded: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

P1C28 does not authorize a write merely because a P1C27 handoff exists. It additionally requires the runtime loader to support the proposed source revision.
