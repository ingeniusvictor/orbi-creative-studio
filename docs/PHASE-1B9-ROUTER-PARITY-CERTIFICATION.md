# ORBI Creative Studio — Phase 1B.9 Router Parity Certification

Status: stacked on P1B.8. Pure certification logic only. No cutover, no persistence, no Studio wiring.

## Purpose

Turn P1B.8 shadow reports into an explicit, fail-closed certification decision.

The certification core lives at:

`src/lib/computeRouter/parityCertification.mjs`

It does not observe Studio directly. It receives already-sanitized `shadow-only` reports and evaluates parity by route.

## Route identity

A certification route is:

`<expectedProviderId>:<operation>`

Supported provider IDs:

- `sdcpp-device`
- `wan2gp-lan`
- `muapi-cloud`

Supported operations:

- `t2i`
- `i2i`
- `t2v`
- `i2v`
- `v2v`
- `lipsync`
- `audio`

## Default thresholds

- minimum samples per requested route: **10**
- minimum distinct models per requested route: **1**
- maximum evidence age: **7 days**
- maximum accepted future clock skew: **60 seconds**

Targets can explicitly require higher sample or model-diversity thresholds.

There is intentionally no implicit "full Studio" target set in code. A future cutover proposal must name the exact routes it intends to certify.

## Hard failure semantics

A route can certify only when all fresh evidence for that requested route is `match`.

Any fresh:

- `blocked` report, or
- `mismatch` report

makes that route non-certified, even if the minimum sample count has already been reached.

This prevents averages from hiding routing divergences.

## Evidence validation

Certification accepts only reports with:

- `mode: shadow-only`
- a recognized provider ID
- a supported operation
- an explicit model ID
- internally consistent parity state

Impossible evidence is rejected. Examples:

- `match` but a different provider was selected
- `blocked` but a provider was selected
- `mismatch` without a different selected provider
- unknown provider ID
- evidence timestamp too far in the future

## Freshness

Evidence older than the configured maximum age is pruned before evaluation.

Old successful observations therefore cannot certify current behavior indefinitely.

## Privacy

The ledger retains only routing evidence:

- expected provider ID
- selected provider ID
- operation
- model ID
- parity state
- observation timestamp

It does not retain:

- prompt content
- uploaded media
- API keys
- provider payloads
- filesystem paths
- LAN endpoints
- MuAPI response bodies

## Explicit targets

`ledger.evaluate(targets)` requires a non-empty target list.

No targets means:

`NO_CERTIFICATION_TARGETS`

and certification is false.

Each route is evaluated independently. A multi-route certification passes only when every requested route passes.

## Scope boundary

P1B.9 does **not**:

- listen to `orbi:compute-router-shadow`
- persist evidence
- change ImageStudio
- change VideoStudio
- change provider selection
- enable fallback
- authorize cutover
- execute generation

A later phase may collect session evidence into this ledger, but certification must still remain separate from execution authorization.

## Merge gate

Keep stacked until P1B.3–P1B.8 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no steps/logs.
