# P1C44 — Human Policy PR Request Manifest

## Purpose

P1C44 converts a valid P1C43 human review packet into a precise, non-authorizing request manifest for the separate upstream baseline policy PR.

It answers the operational question: **what exactly should the human-created policy PR look like?**

## Output

A valid request is `READY_FOR_HUMAN_POLICY_PR_REQUEST` and records:

- repository;
- canonical base branch;
- suggested human-created head branch;
- PR title;
- source and target upstream baselines;
- approved proposed-policy SHA-256;
- P1C40 handoff identity;
- the only file allowed in the policy PR;
- the only policy fields expected to change;
- the final human review instructions.

## Exact policy scope

The request permits review of only:

`src/lib/upstreamDriftPolicy.mjs`

and expects only these fields to change:

- `OPEN_GENERATIVE_AI_UPSTREAM.baselineSha`
- `OPEN_GENERATIVE_AI_UPSTREAM.baselineDate`

This mirrors the byte-level guarantees already established by P1C39/P1C42.

## Boundary

P1C44 still grants no repository mutation authority.

It explicitly declares:

- policy mutation = false;
- automatic branch creation = false;
- automatic PR creation = false;
- automatic merge = false.

A person must create the policy branch and PR, verify the actual diff, wait for CI/certification, and make the separate merge decision.

P1C44 does not weaken P1C43. It turns the approved review packet into a clearer handoff instruction for the human-only action that P1C43 deliberately leaves outside automation.
