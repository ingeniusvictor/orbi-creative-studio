# P1C41 — Human Approval Record Validator

## Purpose

P1C41 binds an explicit human approval to one exact P1C40 handoff package.

It closes the gap between "the handoff is ready for review" and "a person approved this exact handoff".

## Identity binding

A deterministic SHA-256 identity is derived from the handoff's baseline pair, target date and P1C40 integrity hashes.

An approval copied to a different baseline target or different handoff fails validation.

## Explicit approval record

A valid approval must contain:

- exact handoff identity SHA-256;
- exact source and target baseline SHAs;
- decision `APPROVE_POLICY_PR`;
- non-empty approver identifier;
- valid approval timestamp;
- non-empty rationale.

## Important boundary

P1C41 does not authenticate the human cryptographically and does not claim a digital signature.

It records and validates an approval assertion supplied through the review process.

Even a valid result keeps:

- `policyMutationAllowed = false`;
- `policyPrCreationAllowed = false`;
- `requiresSeparatePolicyPr = true`.

A later phase may validate the contents of that separate PR, but automatic policy mutation remains prohibited.
