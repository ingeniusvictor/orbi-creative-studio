# P1C45 — Human Policy PR Envelope Validator

## Purpose

P1C45 validates the actual shape of a human-created upstream baseline policy pull request against the non-authorizing P1C44 request manifest.

It is designed for the point after a person has created the branch and PR, but before any merge decision.

## Inputs

- valid P1C44 request manifest;
- pull request metadata;
- exact changed-file list;
- exact proposed `src/lib/upstreamDriftPolicy.mjs` source.

## Validation

The validator requires an exact match for:

- repository;
- canonical base branch;
- requested head branch;
- PR title;
- open/non-draft state;
- changed files;
- approved proposed-policy SHA-256.

The changed-file set must be exactly:

`src/lib/upstreamDriftPolicy.mjs`

No additional file is accepted.

## Output

A valid result is:

`HUMAN_POLICY_PR_ENVELOPE_VALIDATED`

This means only that the PR envelope matches the reviewed governance chain.

It does not mean the PR may be merged.

## Final boundary

Even after P1C45 validation:

- policy mutation authority is not granted to automation;
- automatic PR creation remains forbidden;
- automatic merge remains forbidden;
- required CI must be green;
- Foundation certification must be green;
- a separate human merge decision is still required.

P1C45 therefore validates the human PR without turning validation into authorization.
