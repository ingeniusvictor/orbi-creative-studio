# P1C38 — Upstream Baseline Advancement Proposal Builder

## Purpose

P1C38 converts a completed P1C37 review into an auditable proposal to move the reviewed upstream baseline.

It does not edit the baseline itself.

## Inputs

The proposal builder consumes:

1. the P1C33/P1C34 drift report;
2. the P1C36 adoption manifest;
3. an explicit P1C37 decision submission.

The P1C37 evaluator runs first. A proposal can only become valid when the review result is valid and baseline-advance eligible.

## Proposal contents

A valid proposal records:

- current reviewed baseline SHA;
- proposed upstream baseline SHA;
- upstream head date and message;
- counts of `ADOPT`, `ADAPT`, and `REJECT`;
- verified ORBI implementation commit SHAs for adopted/adapted changes;
- all resolved decisions.

## Safety

A valid proposal has:

- state `READY_FOR_HUMAN_APPROVAL`;
- `policyMutationAllowed = false`;
- `requiresHumanApproval = true`;
- `requiresSeparatePolicyPr = true`.

P1C38 cannot update `src/lib/upstreamDriftPolicy.mjs`.

A separate human-approved policy PR is required to actually move the baseline.

## CLI

A read-only proposal builder is provided:

```text
node scripts/build-upstream-baseline-proposal.mjs \
  --drift <drift.json> \
  --manifest <adoption-manifest.json> \
  --decisions <review-decisions.json> \
  --out-dir artifacts/upstream-baseline-proposal
```

When review is incomplete, the CLI writes a blocked proposal for auditability and exits non-zero.
