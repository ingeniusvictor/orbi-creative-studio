# ORBI Creative Studio — Phase 1B.18 Cutover Review Bundle

Status: stacked on P1B.17. Review composition only. No cutover implementation.

## Purpose

Compose the commit-bound evidence chain into one deterministic review bundle:

1. P1B.17 parity certification build binding;
2. P1B.16 release evidence manifest;
3. current provider readiness;
4. P1B.14 cutover eligibility assessment;
5. P1B.15 cutover review report.

The compositor lives at:

`src/lib/computeRouter/cutoverReviewBundle.mjs`

## Exact source commit

The bundle requires a 40-character source commit SHA.

The release evidence manifest must reference the same exact commit.

The P1B.17 parity binding is extracted using that same expected commit.

A cross-commit evidence chain is rejected before eligibility evaluation.

## Composition flow

`buildStudioCutoverReviewBundle()` performs:

- exact release-manifest commit/profile validation;
- parity binding extraction and integrity revalidation;
- release gate extraction from commit-bound evidence;
- current provider readiness evaluation through P1B.14;
- deterministic P1B.15 review report generation.

## Bundle states

The bundle reports:

- `READY_FOR_REVIEW`;
- `BLOCKED`.

`READY_FOR_REVIEW` requires:

- all four P1B.16 release gates true;
- P1B.14 eligibility true;
- P1B.15 report ready for review.

## Authority boundary

Every bundle preserves:

- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

Review readiness remains evidence for a later explicit approval phase, never execution authority.

## Validation from source evidence

`validateStudioCutoverReviewBundle()` requires the original:

- expected source commit;
- parity binding;
- release evidence manifest;
- current provider descriptors.

The validator rebuilds the bundle using the original evidence and compares:

- release gates;
- eligibility assessment;
- review report;
- status/readiness flags;
- source/profile/binding identity;
- execution authority.

Stored fields therefore cannot be trusted in isolation.

Manual modification of `releaseGates`, embedded eligibility, or embedded review state is detected.

## Current provider state remains live input

Release and parity evidence can be complete while the bundle remains blocked if a current provider is:

- degraded;
- offline;
- misconfigured;
- missing credentials;
- missing a certified model/capability.

This prevents historical evidence from overriding current readiness.

## Current repository implication

GitHub Actions is still failing before executing workflow steps.

Therefore a truthful current P1B.16 manifest cannot set `ciGreen: true`, so any real current P1B.18 bundle must remain `BLOCKED`.

## Scope boundary

P1B.18 does not:

- collect CI evidence;
- determine the Git SHA automatically;
- persist the bundle;
- approve cutover;
- change routing;
- execute providers;
- modify Studio UI;
- add fallback.

## Merge gate

Keep stacked until P1B.3–P1B.17 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.