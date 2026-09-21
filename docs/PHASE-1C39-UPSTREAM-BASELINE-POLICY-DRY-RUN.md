# P1C39 — Upstream Baseline Policy Update Dry Run

## Purpose

P1C39 is the final non-mutating step of the upstream-governance chain.

It takes a valid P1C38 baseline advancement proposal and previews the exact source change that a later, separately approved policy PR would make to `src/lib/upstreamDriftPolicy.mjs`.

P1C39 never edits that file in place.

## Governed fields

Only two fields may change:

- `OPEN_GENERATIVE_AI_UPSTREAM.baselineSha`
- `OPEN_GENERATIVE_AI_UPSTREAM.baselineDate`

The dry run verifies that each declaration exists exactly once, that the current baseline matches the P1C38 proposal source baseline, and that reversing the two preview substitutions reproduces the original source byte-for-byte.

This guards against accidental edits outside the baseline identity.

## Stale-plan protection

A dry-run plan is blocked if the current policy baseline no longer matches the proposal's `fromBaselineSha`.

This prevents a reviewed proposal from being silently applied after another baseline advancement has already occurred.

## CLI

```text
node scripts/preview-upstream-baseline-policy-update.mjs \
  --proposal artifacts/upstream-baseline-proposal/baseline-advance-proposal.json \
  --policy src/lib/upstreamDriftPolicy.mjs \
  --out-dir artifacts/upstream-baseline-policy-dry-run
```

Outputs:

- `baseline-policy-update-plan.json`
- `baseline-policy-dry-run.md`
- `upstreamDriftPolicy.preview.mjs` when the plan is valid

The preview is written to the artifact directory, never over the real policy file.

## Boundary

After P1C39, a real baseline movement requires explicit human approval and a separate policy PR. No automatic executor is introduced by this phase.
