# P1C48 — Explicit Human Merge Decision Validator

## Purpose

P1C48 records and validates the final human decision that follows a complete P1C47 merge-evidence packet.

It separates **decision** from **execution**.

A reviewer may explicitly choose:

- `APPROVE_MERGE`
- `REJECT_MERGE`

The record is cryptographically bound to the exact P1C47 evidence identity and therefore to the reviewed policy PR head, integrated CI run and pre-merge Foundation certification.

## Required decision fields

A valid human decision requires:

- exact P1C47 evidence identity SHA-256;
- repository;
- PR number;
- PR head SHA;
- explicit decision;
- reviewer identity;
- ISO decision timestamp;
- non-empty rationale.

A stale or substituted PR head/evidence identity fails closed.

## Approval state

A valid approval becomes:

`HUMAN_MERGE_APPROVAL_RECORDED`

A valid rejection becomes:

`HUMAN_MERGE_REJECTION_RECORDED`

## Critical boundary

P1C48 never executes the GitHub merge.

Even for `APPROVE_MERGE`:

- automatic merge = false;
- merge execution = false;
- `mergeExecutionAllowed = false`;
- a separate repository merge action remains required;
- the merge must remain unperformed by this phase.

This keeps the human governance decision auditable without silently converting a validated record into repository mutation authority.

## Why stop execution here?

The upstream baseline is repository policy. Advancing it changes which upstream commit ORBI considers reviewed. The decision record can be automated and validated, but the actual merge remains a separately authorized human repository action.

No real P1C48 approval should be fabricated when no upstream drift/policy PR exists.
