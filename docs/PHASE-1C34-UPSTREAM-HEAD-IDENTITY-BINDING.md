# P1C34 — Upstream Head Identity Binding

## Purpose

P1C33 proved that the live scanner can compare the reviewed Open-Generative-AI baseline against upstream `main`. During the first canonical live run, GitHub returned an `identical` compare payload without a populated `head_commit`, so the report correctly showed no drift but displayed the current upstream head as `unknown`.

P1C34 removes that ambiguity.

## Change

The scanner now performs two read-only GitHub requests:

1. Resolve the exact commit currently referenced by the tracked upstream branch.
2. Compare the pinned baseline against that branch.

The resolved branch identity is then bound into the report as:

- `headSha`
- `headDate`
- `headMessage`

The report schema advances from version 1 to version 2.

## Fallback

If a caller constructs a report directly without an explicit head SHA and GitHub says the compare status is `identical`, the report safely resolves the head to the pinned baseline SHA. The live scanner still requires an explicit branch-head lookup and fails closed if GitHub does not return a SHA.

## Safety

This phase remains observation-only. It does not advance the reviewed baseline, modify ORBI source from upstream, or enable direct replacement.

The P1C32 authority boundary and P1C33 no-write design remain unchanged.
