# P1C32 — Upstream Security & Drift Intake

## Status

Implemented on the P1C32 feature branch for review before promotion to `integration/orbi-foundation`.

## Upstream reviewed

- Repository: `Anil-matcha/Open-Generative-AI`
- Upstream branch: `main`
- Reviewed baseline: `69b7fccaa946161473c765facebdb7c5f3f74d5d`
- Upstream commit date: 2026-09-19
- Root license observed at the baseline: MIT

The upstream repository is a reference source. It is not authoritative over ORBI Creative Studio.

## Baseline comparison

At the reviewed baseline, every one of the 233 upstream blob paths was already present in ORBI Creative Studio. Of those, 207 were byte-identical and 26 had ORBI changes. ORBI also carried 260 additional blob paths.

This makes the canonical ORBI branch a functional superset of the reviewed upstream snapshot. A whole-repository copy, reset, subtree replacement, or blind synchronization is therefore prohibited by this phase.

## Security intake: persisted history DOM XSS

Upstream issue #309 documented persisted history values being interpolated into `thumb.innerHTML` in the legacy Image, Video, Cinema and LipSync studios.

P1C32 removes the inherited sink in ORBI by constructing the media element, overlay, action button and SVG through DOM APIs. Persisted `entry.url`, `entry.prompt`, and translated labels are assigned through element properties such as `.src`, `.alt`, and `.textContent` rather than interpreted as markup.

This phase does not claim to close every possible XSS surface in the application. It closes the four inherited history-rendering sinks that were specifically identified and adds regression coverage to prevent those sinks from returning.

## Drift intake classes

`src/lib/upstreamDriftPolicy.mjs` classifies upstream paths into four review classes:

- `ORBI_OWNED`: ORBI has authority. Upstream changes may be studied but must be manually adapted. Electron trust-boundary code, Compute Router, ORBI workflows, phase documentation and tests fall here.
- `SECURITY_REVIEW`: code that handles renderer UI, API routes, uploads, provider communication, or other externally influenced data. No direct import.
- `UPSTREAM_CANDIDATE`: primarily model/parameter/registry metadata and selected static content that may be useful to import after focused review.
- `REVIEW`: conservative default for everything not covered above.

No classification permits blind replacement. `directUpstreamReplacementAllowed()` intentionally returns `false`.

## Invariants

1. `integration/orbi-foundation` remains the canonical ORBI authority.
2. Upstream commits are inspected as candidate changes, never merged wholesale.
3. Electron main/preload, secret handling, MuAPI transport, URL policy, runtime provenance, benchmark evidence, certification and Compute Router are ORBI-owned.
4. Security-sensitive upstream changes require adaptation and regression tests.
5. Model catalogs and provider metadata may be harvested selectively, but model/provider licenses and external terms remain separate review items.
6. Upstream drift must never weaken an already-certified ORBI invariant in order to restore parity with upstream.

## Validation

Dedicated P1C32 tests:

```text
node --test tests/historyDomSafety.test.js tests/upstreamDriftPolicy.test.js
```

The dedicated GitHub Actions workflow runs the same gate on changes to the P1C32 surface.
