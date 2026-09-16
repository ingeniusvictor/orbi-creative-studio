# ORBI Creative Studio — Phase 1C8 Explicit Resource Profile Certification

Status: explicit human certification record. Resource evidence may become P1C4-certified, but routing and cutover remain unauthorized.

## Purpose

Create the first explicit transition from a reviewed P1C7 benchmark session to a P1C4-compatible certified model resource profile.

P1C8 makes that transition a deliberate human approval act rather than an automatic consequence of benchmark completion.

## Required input

`certifyResourceProfile()` requires:

- a P1C7 session in `BENCHMARK_SESSION_READY_FOR_REVIEW` state;
- explicit decision `approve`;
- declared reviewer ID and display name;
- exact ISO certification timestamp;
- non-empty review note.

Sessions claiming prior promotion, routing eligibility, cutover authorization, or non-legacy execution authority are rejected.

## No requirement override

The reviewer cannot supply alternate RAM/VRAM requirements.

P1C8 copies the exact requirements produced by the P1C5 candidate embedded in the reviewed P1C7 session.

This prevents a certification action from silently lowering measured requirements or substituting an undocumented estimate.

## P1C4 profile output

A successful approval creates a profile with P1C4's existing strict schema:

- `status: certified`
- exact model/backend/resolution
- exact evidence-derived `minSystemRamMiB`
- exact evidence-derived `minVramMiB` for CUDA12
- `method: controlled-benchmark`
- sample count
- harness version
- source commit
- certification timestamp
- safety margin

The generated profile is passed through P1C4 `validateCertifiedResourceProfile()` before it can be returned.

## Human review metadata boundary

The separate P1C8 certification record stores declared reviewer metadata and the review note.

It explicitly preserves:

- `reviewerIdentityVerified: false`
- `authenticityVerified: false`

The reviewer ID/display name are declared audit metadata only. P1C8 does not provide cryptographic identity proof, signature verification, trusted timestamping, or provenance attestation.

## Authority boundary

Even when a P1C4 resource profile becomes technically `certified`, the P1C8 result still preserves:

- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

Resource certification means only that a measured hardware-requirement profile has passed the defined evidence/review process.

It does not authorize the Compute Router to execute generation.

## Side-effect boundary

P1C8 is pure logic. It does not:

- write the certified profile to a registry;
- persist reviewer records;
- use filesystem/network/IPC/storage;
- alter provider readiness automatically;
- modify ImageStudio or VideoStudio;
- route or execute generation;
- authorize cutover.

A later phase must define how certified profiles are registered and consumed in shadow compatibility evaluation while retaining `routingEligible: false`.

## Next step

P1C9 should define a governed certified-resource-profile registry that accepts only valid P1C8 outputs and exposes exact profiles to P1C2 compatibility evaluation in shadow mode.

The registry must not itself authorize generation or cutover.
