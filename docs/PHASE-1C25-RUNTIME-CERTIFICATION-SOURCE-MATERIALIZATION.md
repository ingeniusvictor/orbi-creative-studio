# P1C25 — Runtime Certification Source Materialization Preview

## Purpose

P1C25 converts a valid in-memory P1C24 runtime certification promotion package into the exact next source-controlled certification bundle **in memory only**.

It proves that the proposed source revision can be accepted by the existing P1C9 certified-resource-profile registry contract before any source file is changed.

P1C25 does **not** write files, export artifacts, load the runtime registry, route generation, or authorize cutover.

## Input

P1C25 accepts only an exact controlled target:

- model ID;
- backend;
- width;
- height.

For that target it reads:

1. the current governed P1C18 runtime certification source;
2. the matching P1C24 promotion package already prepared in memory.

## Base-source requirements

The current source must still satisfy the existing P1C18 contract:

- schema version 1;
- source type `source-controlled-static-bundle`;
- source revision 1;
- deeply frozen source object;
- non-authorizing authority fields;
- a P1C9-valid base certification registry.

The current repository remains truthful at revision 1 with zero committed certifications.

## Promotion-package requirements

The P1C24 package must:

- pass `validatePromotionPackage(...)`;
- match the exact requested target;
- name the current source revision as its base revision;
- propose exactly the next source revision.

Any missing, malformed, mismatched, or stale package fails closed.

## Materialized preview

A successful preparation builds an immutable internal object:

`p1c25-runtime-certification-source-materialization`

with status:

`source-commit-required`

The internal proposal contains:

- exact target context;
- base source revision;
- proposed source revision;
- certification count before and after;
- a detached proposed source snapshot;
- the P1C24 P1C8 certification appended to the current certification set;
- explicit non-authorizing boundaries.

The proposed source snapshot is validated by constructing the existing P1C9 registry. Duplicate target contexts or invalid certification entries are rejected.

## Sanitized summary

The public summary exposes only:

- model/backend/resolution;
- base and proposed source revisions;
- certification count before and after;
- whether the candidate registry validated;
- whether source review/commit is still required;
- authority boundaries.

It does not expose:

- reviewer ID;
- review note;
- benchmark hashes;
- source commit from benchmark evidence;
- auxiliary artifact evidence;
- raw P1C8 certification;
- raw proposed source snapshot.

## Source boundary

P1C25 deliberately leaves:

`src/lib/computeRouter/runtimeResourceProfileCertifications.mjs`

unchanged.

It must still contain:

- `const certifications = [];`
- `sourceRevision: 1`

P1C25 performs no filesystem mutation and has no startup or generation integration.

A later phase may add an explicit reviewed handoff/export or deliberate source commit from this materialization. That later action remains separate from runtime activation.

## Authority boundary

Every P1C25 result preserves:

- `materializationOnly: true`;
- `sourceReviewRequired: true`;
- `sourceCommitRequired: true`;
- `sourceMutationApplied: false`;
- `runtimeRegistryLoaded: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

A valid materialization proves only that a proposed source bundle is structurally reviewable. It grants no runtime execution authority.
