# P1C35 — Upstream Change Triage

## Purpose

P1C35 adds semantic triage on top of the authority classification introduced by P1C32 and the live drift scanner from P1C33/P1C34.

The system now answers two separate questions for every upstream change:

1. **Who owns this path?** — ORBI authority classification.
2. **What kind of change is this?** — semantic triage.

These dimensions remain intentionally separate. A UI change can still require `SECURITY_REVIEW`, and a model metadata change can be an `UPSTREAM_CANDIDATE` without being automatically adoptable.

## File triage kinds

- `ORBI_CONFLICT`: upstream touched a path governed by ORBI.
- `SECURITY`: trust-boundary/API/credential/upload/security surface.
- `NEW_MODEL`: model, provider, registry, parameter or capability metadata.
- `UI`: user-facing studio/application component.
- `DOCUMENTATION`: documentation/static explanatory material.
- `REVIEW`: conservative fallback.

## Commit triage kinds

Commit subjects are independently classified as:

- `SECURITY`
- `BUGFIX`
- `NEW_MODEL`
- `DOCUMENTATION`
- `REVIEW`

Security semantics take precedence over generic bugfix wording.

## Actions

- `MANUAL_ADAPT`: upstream code cannot replace the ORBI-owned path; useful logic must be manually adapted.
- `SECURITY_REVIEW`: requires explicit security review.
- `CANDIDATE_REVIEW`: suitable for focused product/technical review.
- `REVIEW_ONLY`: informational or unclassified change requiring human review.

No action permits automatic adoption.

## Outputs

The live scanner adds:

- `artifacts/upstream-drift/open-generative-ai-triage.json`
- `artifacts/upstream-drift/open-generative-ai-triage.md`

These outputs are designed to become the input to a later adoption-manifest phase without allowing that phase to mutate source code automatically.
