# ORBI Creative Studio — Phase 1B.15 Cutover Review Report

Status: stacked on P1B.14. Review/reporting only. No cutover implementation.

## Purpose

Convert the P1B.14 cutover eligibility assessment into a deterministic review artifact that clearly explains whether the stack is ready for human cutover review and exactly what still blocks it.

The report module lives at:

`src/lib/computeRouter/cutoverReviewReport.mjs`

## Authority boundary

P1B.15 accepts only non-authorizing P1B.14 assessments.

It rejects any input where:

- global `cutoverAuthorized` is not `false`;
- global execution authority is not `legacy-dispatcher-only`;
- any route claims `cutoverAuthorized: true`;
- any route claims a non-legacy execution authority.

The report itself always returns:

- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Review states

The report exposes only:

- `READY_FOR_REVIEW`
- `BLOCKED`

`READY_FOR_REVIEW` is not cutover approval. It means the P1B.14 evidence set is complete enough to enter a later explicit review/approval phase.

## Global blockers

The report surfaces:

- eligibility assessment not eligible;
- certification profile mismatch;
- certification schema problems;
- weakened freshness policy;
- parity certification failure;
- duplicate certification routes;
- duplicate provider readiness descriptors;
- missing release gates.

## Route blockers

Each route retains:

- route key;
- provider;
- operation;
- certified model IDs;
- review eligibility;
- exact fail-closed reasons;
- non-authorizing legacy execution boundary.

## Summary

The report includes:

- total route count;
- eligible route count;
- blocked route count;
- missing release gate count;
- current release gate states.

## Text format

`formatCutoverReviewText()` emits a deterministic text view headed by:

`ORBI Compute Router — Cutover Review Report`

The text always prints execution authority and `Cutover authorized: NO` for valid reports.

## Current infrastructure implication

Because GitHub Actions still fails before executing any workflow step, the current stack cannot truthfully satisfy the P1B.14 `ciGreen` gate. Therefore a real current-state review report must remain `BLOCKED`.

## No execution coupling

P1B.15 does not import or call:

- Studio dispatchers;
- Compute Router selection;
- local generation;
- MuAPI generation;
- IPC;
- network fetch;
- browser storage;
- global browser APIs.

ImageStudio and VideoStudio do not import this report module.

## Scope boundary

P1B.15 does not:

- approve cutover;
- change provider selection;
- enable fallback;
- persist approval;
- add an execution toggle;
- change generation behavior.

## Merge gate

Keep stacked until P1B.3–P1B.14 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.