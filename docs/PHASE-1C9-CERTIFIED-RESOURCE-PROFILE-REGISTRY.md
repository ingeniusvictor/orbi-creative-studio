# ORBI Creative Studio — Phase 1C9 Governed Certified Resource Profile Registry

Status: immutable in-memory shadow registry. No routing or cutover authority.

## Purpose

Allow explicitly certified P1C8 resource profiles to be consumed by P1C2 local compatibility evaluation without turning the registry into an execution control plane.

## Accepted entries

The registry accepts only successful P1C8 certification results that preserve:

- `RESOURCE_PROFILE_CERTIFICATION_RECORDED`;
- a P1C4-valid certified profile;
- a matching `p1c8-human-certification-record`;
- `reviewerIdentityVerified: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

The certification record and profile must agree exactly on:

- model ID;
- backend;
- resolution;
- approved system RAM;
- approved VRAM where applicable.

Duplicate model/backend/resolution contexts fail closed.

## Immutability boundary

P1C9 does not retain mutable caller-owned profile objects.

Every accepted certification is copied into a frozen registry snapshot, including nested:

- resolution;
- requirements;
- benchmark evidence;
- session run indexes;
- auxiliary artifact evidence;
- reviewer metadata.

Mutating the caller's source object after registry construction cannot alter registered evidence.

The registry exposes no add/update/delete methods after construction.

## Shadow compatibility consumption

`evaluateShadowCompatibility()` performs an exact lookup by:

- model ID;
- runtime backend;
- width;
- height.

When a match exists, the certified P1C4 profile is passed to the existing P1C2/P1C4-aware compatibility evaluator.

This can produce:

- `COMPATIBILITY_CANDIDATE`;
- `COMPATIBILITY_BLOCKED`;
- `COMPATIBILITY_UNKNOWN`.

A candidate remains diagnostic only.

## Authority boundary

The registry and every shadow evaluation preserve:

- `mode: shadow-diagnostic-only` for evaluations;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

P1C9 does not authorize local generation even when all hardware/runtime/model/resource checks pass.

## Side-effect boundary

P1C9 is pure in-memory logic. It does not:

- read or write files;
- persist profiles;
- use network/IPC/browser storage;
- alter provider readiness automatically;
- modify ImageStudio or VideoStudio;
- change the normal local generation handler;
- call the execution router;
- authorize cutover.

## Next step

P1C10 should expose a sanitized, read-only shadow compatibility snapshot to Router diagnostics so operators can inspect:

- registry match/no-match;
- certified profile context;
- compatibility status/reasons;
- observed versus required RAM/VRAM;
- explicit `routingEligible: false` and `cutoverAuthorized: false` boundaries.

That diagnostic exposure must not add any action capable of executing or switching providers.
