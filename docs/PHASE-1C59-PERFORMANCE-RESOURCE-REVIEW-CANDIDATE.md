# P1C59 — Performance + Resource Review Candidate

## Purpose

P1C59 combines two previously separate evidence families for one model and resolution:

1. P1C58 repeated-run CPU↔CUDA performance comparison.
2. Existing human-certified P1C8/P1C23 resource profiles.

The result is a review candidate that answers two different questions together:

- which backend was measurably faster in the controlled benchmark;
- what certified RAM/VRAM requirements were approved for each backend.

## Preconditions

P1C59 requires:

- a valid P1C58 performance comparison;
- a certified CPU resource profile;
- a certified CUDA12 resource profile;
- identical model and resolution across all three inputs.

Each resource profile must originate from the existing controlled-benchmark certification path and have at least three benchmark samples.

## Output

A valid result is:

`PERFORMANCE_RESOURCE_REVIEW_READY`

It contains:

- CPU median duration;
- CUDA median duration;
- speedup versus CPU;
- measured faster backend;
- CPU certified RAM requirement;
- CUDA certified RAM requirement;
- CUDA certified VRAM requirement;
- certification context summaries;
- P1C58 aggregate identities.

## What “measured faster backend” means

The field is descriptive benchmark evidence.

It does **not** mean:

- universally faster;
- automatically preferred on every machine;
- production-selected;
- routing-eligible;
- cutover-authorized.

It applies only to the exact model/resolution/evidence context that passed review.

## Human boundary

P1C59 explicitly requires a later human routing review.

The result remains:

- review-only;
- `requiresHumanRoutingReview: true`;
- `productionProfilePromoted: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

A future phase may turn this into a routing proposal, but not into an automatic routing decision.
