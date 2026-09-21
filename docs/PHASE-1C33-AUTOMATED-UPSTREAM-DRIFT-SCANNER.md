# P1C33 — Automated Upstream Drift Scanner

## Status

Implemented after P1C32 established the upstream authority boundary.

## Purpose

P1C33 turns the P1C32 policy into an observation mechanism. It checks the public GitHub compare endpoint for `Anil-matcha/Open-Generative-AI`, comparing the pinned reviewed baseline against upstream `main`, and produces a classified report.

The scanner is deliberately observational. It does not cherry-pick, merge, download model weights, update ORBI source files, or alter the P1C32 baseline.

## Data flow

1. Read the pinned upstream repository, branch and baseline from `src/lib/upstreamDriftPolicy.mjs`.
2. Request GitHub's compare result for `baseline...main`.
3. Convert every changed path into the P1C32 intake class.
4. Emit JSON and Markdown reports under `artifacts/upstream-drift/`.
5. Publish the Markdown report to the GitHub Actions step summary.
6. Upload the report directory as a workflow artifact.

## Outputs

- `artifacts/upstream-drift/open-generative-ai-drift.json`
- `artifacts/upstream-drift/open-generative-ai-drift.md`

The JSON output is structured for future ORBI automation. The Markdown output is intended for human review.

## Safety properties

- No upstream path is directly replaceable.
- `ORBI_OWNED` paths stay under ORBI authority.
- `SECURITY_REVIEW` paths always require security review.
- `UPSTREAM_CANDIDATE` means eligible for focused review, not automatic import.
- Unknown paths default to `REVIEW`.
- The scanner has no write path into the repository.
- The workflow runs with `contents: read`.

## Schedule

The dedicated workflow runs daily and can also be dispatched manually. Pull requests that modify the scanner or its policy run the deterministic unit tests, but the live network scan is reserved for scheduled/manual runs to avoid making PR validation depend on upstream availability.

## Promotion rule

When drift is detected, ORBI should review the report and open a separate, scoped phase/PR for selected upstream changes. The P1C32 baseline must only move after that review is complete and the selected changes are either adopted, adapted, or explicitly rejected.
