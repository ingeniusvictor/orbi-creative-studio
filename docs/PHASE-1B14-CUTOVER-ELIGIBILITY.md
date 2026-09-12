# ORBI Creative Studio — Phase 1B.14 Cutover Eligibility Contract

Status: stacked on P1B.13. Eligibility-for-review contract only. No cutover implementation.

## Purpose

Define the complete fail-closed conditions that must be true before the current Studio routing stack can even be considered for a future cutover review.

The contract lives at:

`src/lib/computeRouter/cutoverEligibility.mjs`

## Critical authority boundary

P1B.14 never authorizes cutover.

Every assessment returns:

- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

The strongest possible result is:

`ELIGIBLE_FOR_CUTOVER_REVIEW`

That result means only that the evidence is complete enough for a later explicit review phase.

## Required parity scope

The certification route set must match the P1B.12 `studio-image-video-v1` profile exactly.

All 9 routes must be present and unique. Missing, extra, duplicated, or wrong-profile certification scope fails closed.

## Per-route parity requirements

Each route must preserve or exceed the P1B.12 evidence floor:

- minimum 10 samples;
- minimum 1 distinct model;
- route `certified: true`;
- all samples are matches;
- zero blocked evidence;
- zero mismatch evidence;
- concrete certified model IDs are present.

A route cannot become review-eligible merely because the outer certification object claims green.

## Certification freshness requirements

P1B.14 rejects a certification configuration weaker than P1B.9 defaults:

- maximum evidence age must be positive and no greater than 7 days;
- maximum future clock skew must be non-negative and no greater than 60 seconds;
- certification schema version must be `1`;
- global reason must be `PARITY_CERTIFIED`.

## Current provider readiness requirements

Parity history alone is insufficient.

For each route, the expected provider must currently exist and satisfy:

- `health: ready` exactly;
- credentials `available` or `not-required`;
- current capability includes the route operation;
- every certified model ID still exists in the provider's current capability set.

`degraded` is intentionally rejected for cutover review even though the normal Compute Router may consider degraded providers usable.

## Duplicate readiness evidence

Duplicate provider descriptors fail closed. Ambiguous current provider state cannot be used for cutover review.

## Required release gates

All release gates default to `false` and must be explicitly supplied as true:

- `ciGreen`
- `platformMatrixGreen`
- `securityReviewApproved`
- `rollbackPlanApproved`

Because GitHub Actions is currently failing before runner assignment, `ciGreen` cannot truthfully be asserted for the current stack.

## Result semantics

Global result:

- `ELIGIBLE_FOR_CUTOVER_REVIEW`
- `NOT_ELIGIBLE_FOR_CUTOVER_REVIEW`

Each route independently reports:

- `eligibleForCutoverReview`
- certified model IDs
- fail-closed reasons
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## No execution coupling

P1B.14 does not import or call:

- Studio dispatchers;
- `routeGenerationRequest()`;
- local generation;
- MuAPI generation;
- IPC;
- network fetch;
- global browser APIs.

ImageStudio and VideoStudio do not import the eligibility module.

## Scope boundary

P1B.14 does not:

- switch execution to Compute Router;
- add fallback;
- persist approval;
- provide an enable toggle;
- add a cutover button;
- alter provider selection;
- alter generation payloads.

## Merge gate

Keep stacked until P1B.3–P1B.13 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.