# P1C36 — Governed Upstream Adoption Manifest

## Purpose

P1C36 converts P1C35 semantic triage into a machine-readable review manifest. It is intentionally a review artifact, not an execution plan.

Every changed upstream path receives an initial decision of `PENDING_REVIEW`. The generated manifest cannot authorize source mutation, direct adoption, or baseline advancement.

## Entry fields

Each entry records:

- upstream head SHA
- ORBI authority class
- semantic triage kind
- triage action
- initial review decision
- required review domains
- whether the path is structurally eligible to be considered a direct adoption candidate

A direct adoption candidate is only a candidate for human review. It is not approved for copying.

## Required reviews

The manifest derives review requirements conservatively:

- every change: `TECHNICAL`
- security-sensitive change: `SECURITY`
- model/provider metadata: `LICENSE` + `PRODUCT`
- UI change: `PRODUCT`

ORBI-owned paths can never be direct adoption candidates.

## Manifest state

- `NO_DRIFT`: no changed files, no review entries.
- `REVIEW_REQUIRED`: one or more changed files require explicit decisions.

At creation time:

- automatic adoption = false
- source mutation = false
- baseline advancement eligible = false
- every decision = `PENDING_REVIEW`

## Outputs

The live upstream scanner adds:

- `artifacts/upstream-drift/open-generative-ai-adoption-manifest.json`
- `artifacts/upstream-drift/open-generative-ai-adoption-manifest.md`

A later phase may consume this manifest together with explicit human decisions, but must not reinterpret a generated `PENDING_REVIEW` entry as approval.
