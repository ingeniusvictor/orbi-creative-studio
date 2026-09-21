# P1C49 — Upstream Governance Chain Integrity Certification

## Purpose

P1C49 certifies the upstream-governance system as one connected chain instead of validating each phase only in isolation.

The reviewed chain is:

`P1C32 → P1C33 → … → P1C48`

It covers discovery, security intake, semantic triage, adoption review, explicit decisions, baseline proposal/dry-run/handoff, human approval, policy-PR validation, pre-merge Foundation certification, final merge evidence and explicit human merge decision.

## Global invariants

P1C49 locks the following properties across the chain:

1. Documentation exists continuously for P1C32 through P1C48.
2. Direct upstream source replacement remains disabled.
3. Upstream-governance modules may not grant source/policy/PR/merge authority through an authority flag set to `true`.
4. Upstream-governance GitHub workflows keep repository permissions at `contents: read`.
5. The full Foundation certification can run on the governed policy PR before merge and retains read-only repository permissions.
6. P1C44, P1C47 and P1C48 do not contain repository merge execution logic.
7. A valid P1C48 approval still requires a separate repository merge action and must leave that merge unperformed.

## Scope

This is an integrity certification, not a new mutation stage.

P1C49 does not:

- contact or modify upstream;
- advance the reviewed baseline;
- create a policy branch or PR;
- produce a human approval;
- merge a policy PR;
- grant any new repository permission.

## Why this is the stopping point

At P1C48, every step that can safely be automated has an explicit contract and evidence boundary. The remaining action—merging an actually approved policy PR—is intentionally external to the governance automation.

P1C49 therefore certifies the architecture and prevents later phases or refactors from silently weakening those boundaries.
