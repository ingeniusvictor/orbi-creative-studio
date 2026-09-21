# P1C40 — Upstream Baseline Policy Handoff Package

## Purpose

P1C40 packages the already-reviewed P1C38 proposal and P1C39 policy dry run into an integrity-bound handoff artifact for a future human-reviewed baseline policy PR.

It remains non-mutating.

## Inputs

- valid P1C38 baseline advancement proposal;
- valid P1C39 dry-run plan;
- current `src/lib/upstreamDriftPolicy.mjs` source;
- P1C39 preview policy source.

## Integrity

The handoff records SHA-256 hashes for the current policy, preview policy, proposal and dry-run plan. This lets a reviewer detect stale or substituted inputs before opening a policy PR.

## State

A valid package is `READY_FOR_HUMAN_POLICY_PR`.

That state does **not** authorize a policy change. The package always declares:

- `sourceMutationAllowed = false`;
- `policyPrAuthorized = false`;
- `requiresHumanApproval = true`;
- `requiresSeparatePolicyPr = true`.

## Boundary

P1C40 creates no branch, commit, PR or policy edit. A later phase may validate an explicitly human-approved policy PR request, but automatic baseline mutation remains outside this phase.
