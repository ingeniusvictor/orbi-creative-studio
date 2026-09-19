# P1C22 — Benchmark Review Package

## Purpose

P1C22 converts an explicitly completed three-sample P1C21 benchmark session into the existing P1C7 review-only benchmark-session evidence bundle.

It does not certify or promote a resource profile.

## Explicit safety margin

P1C5 requires an explicit safety margin between 0% and 100%.

P1C22 does not choose a hidden default. The user must enter the margin in Router Diagnostics before the review package can be prepared.

The candidate requirements remain derived exclusively from:

- maximum observed system RAM;
- maximum observed NVIDIA VRAM for CUDA12;
- the explicitly declared safety margin;
- upward rounding to whole MiB.

## Evidence chain

P1C22 reads the detached in-memory P1C21 run envelopes and calls the existing P1C7 `buildBenchmarkSessionEvidence()`.

A valid review requires exactly three P1C21 samples for the selected model/backend/resolution.

The resulting P1C7 session is validated immediately with the existing P1C8 `validateReviewableSession()` contract. This verifies that a future human-certification step can consume the package without P1C22 invoking certification itself.

## Storage

The complete P1C7 session result is stored only in process memory for later explicit P1C8 review.

No filesystem, browser storage, network service or IPC is used by the P1C22 review builder.

## Sanitized UI summary

Router Diagnostics receives only:

- model/backend/resolution context;
- run count;
- declared safety margin;
- maximum observed system RAM;
- recommended minimum system RAM;
- for CUDA12, maximum observed VRAM;
- recommended minimum VRAM;
- review-only authority boundaries.

The UI never receives or renders:

- runtime/model SHA-256 values;
- auxiliary artifact hashes;
- runtime identity/version;
- source commit;
- harness version;
- raw run evidence;
- reviewer identity;
- review notes;
- certification records.

## User action boundary

The **Prepare review package** action is available only after P1C21 reaches 3/3 samples and a valid safety margin has been explicitly entered.

P1C22 adds no automatic loop or timer.

## Human certification boundary

A successful result is:

- review-only;
- `requiresHumanCertification: true`;
- `productionProfilePromoted: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

P1C22 does not call `certifyResourceProfile()`, does not write `runtimeResourceProfileCertifications.mjs`, and does not change the P1C18 runtime registry.

## Next

A later phase may provide an explicit P1C8 human certification form that consumes the internal P1C22 review session. That phase must keep certification as a separate auditable user act and must not automatically write or activate a runtime certification.
