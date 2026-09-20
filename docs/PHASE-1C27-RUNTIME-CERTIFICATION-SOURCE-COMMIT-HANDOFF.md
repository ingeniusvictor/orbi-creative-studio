# P1C27 — Explicit Reviewed Runtime Certification Source Commit Handoff

## Purpose

P1C27 turns a valid P1C26 deterministic source-review artifact into an explicit, human-approved handoff for a later source-controlled commit.

P1C27 does not write Git, GitHub, or the filesystem. It packages the exact proposed source content together with the exact Git/source identity that a later commit phase must re-check before applying anything.

## Preconditions

P1C27 requires the full governed chain to remain valid:

1. a valid P1C25 source materialization;
2. a valid matching P1C26 deterministic source-review artifact;
3. the current governed runtime certification source;
4. explicit human source-review approval;
5. an exact 40-character base commit SHA;
6. an exact 40-character current source blob SHA.

The requested target must still match model, backend, width, and height exactly.

## Explicit human source review

The handoff cannot be prepared unless the caller supplies:

- `sourceReviewApproved: true`;
- reviewer ID;
- reviewer display name;
- non-empty review note;
- explicit review timestamp.

Reviewer identity remains unverified by P1C27 and is represented truthfully as:

`reviewerIdentityVerified: false`

Rejected or empty states never claim that source review was approved.

## Exact base identity

P1C27 binds the proposed commit to four base-state values:

- base Git commit SHA;
- current source-file blob SHA;
- current source revision;
- current certification count.

These values form the stale-source guard for any later source mutation.

For the current canonical baseline, the expected identity at the start of P1C27 is:

- canonical commit: `f4667a70ccb7bacb96927b709fe400341ff8686f`;
- source blob: `9f5004a13941a5ea33d876a68d3da703ec6902d9`;
- source revision: `1`;
- certification count: `0`.

These values are not hard-coded into the implementation. They are explicit inputs to the handoff and must be re-read by the future source-apply phase.

## Stale protection

P1C27 exports a reusable state validator:

`validateRuntimeCertificationSourceCommitHandoffAgainstState(...)`

It independently rejects:

- changed base commit;
- changed source blob;
- changed logical source revision;
- changed certification count.

A future source-apply phase must run this validation against the repository state immediately before any write.

## Handoff artifact

A successful preparation produces the internal immutable artifact:

`p1c27-runtime-certification-source-commit-handoff`

with status:

`external-source-commit-required`

The handoff contains:

- exact target;
- target source path;
- content format;
- exact base Git/source identity;
- proposed source revision;
- proposed certification count;
- exact P1C26 deterministic source content;
- explicit human review record;
- non-authorizing authority boundaries.

The raw source content and review text remain internal.

## Sanitized summary

The public summary exposes:

- target context;
- target path;
- base commit SHA;
- source blob SHA;
- base/proposed source revisions;
- before/after certification counts;
- deterministic/candidate-registry markers;
- source review approved state;
- stale protection state;
- authority boundaries.

It does not expose:

- source module contents;
- reviewer ID;
- reviewer display name;
- review note;
- P1C8 certification contents.

## Source and execution boundary

P1C27 deliberately has no capability to:

- update `runtimeResourceProfileCertifications.mjs`;
- write files;
- call GitHub or Git;
- create commits or refs;
- use Electron IPC;
- enter Router Diagnostics or Settings;
- load the runtime certification registry;
- influence Image Studio or Video Studio;
- enable routing;
- authorize cutover.

The runtime source therefore remains unchanged at revision 1 with zero committed certifications.

## Authority boundary

A successful P1C27 handoff preserves:

- `handoffOnly: true`;
- `sourceReviewApproved: true`;
- `sourceCommitRequired: true`;
- `requiresExternalSourceCommit: true`;
- `baseIdentityBound: true`;
- `staleProtectionRequired: true`;
- `sourceMutationApplied: false`;
- `runtimeRegistryLoaded: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

P1C27 authorizes only a reviewed handoff to a later source-controlled commit step. It does not perform that commit and does not grant runtime execution authority.
