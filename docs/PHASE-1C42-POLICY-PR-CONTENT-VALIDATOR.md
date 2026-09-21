# P1C42 — Upstream Policy PR Content Validator

## Purpose

P1C42 verifies that the bytes proposed for a future upstream-baseline policy PR are exactly the bytes reviewed in the P1C39/P1C40 preview and approved through P1C41.

## Inputs

- valid P1C40 handoff;
- valid P1C41 approval result;
- current policy source;
- proposed policy source.

## Validation

The validator requires:

1. approval bound to the exact handoff identity;
2. current policy SHA-256 equal to the P1C40 current-policy hash;
3. proposed policy SHA-256 equal to the P1C40 preview-policy hash.

Any byte difference in the proposed policy causes validation to fail.

## Boundary

A valid result means only `POLICY_PR_CONTENT_VALIDATED`.

It does not create a PR, edit source, authorize merge, or authenticate the reviewer cryptographically.

The validator always returns:

- `policyMutationAllowed = false`;
- `policyPrCreationAllowed = false`;
- `mergeAllowed = false`;
- `requiresSeparatePolicyPr = true`.
