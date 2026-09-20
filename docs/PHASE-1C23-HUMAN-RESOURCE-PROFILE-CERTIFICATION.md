# P1C23 — Explicit Human Resource-Profile Certification

## Purpose

P1C23 exposes the existing P1C8 human certification contract as an explicit user action in Router Diagnostics.

The phase records a P1C8 certification in memory only. It does **not** activate that profile in the runtime registry.

## Preconditions

Certification is available only after:

1. the exact local target is selected;
2. P1C21 has captured three exact-context benchmark samples;
3. P1C22 has prepared a valid P1C7 review package with an explicit safety margin.

## Explicit human act

The reviewer must provide:

- reviewer ID as declared metadata;
- reviewer display name;
- a non-empty review note;
- an explicit approval checkbox.

The UI then submits a fixed decision of `approve` to the existing P1C8 `certifyResourceProfile()` implementation.

No default approval exists.

## Reviewer and authenticity boundary

P1C23 intentionally preserves:

- `reviewerIdentityVerified: false`;
- `authenticityVerified: false`.

The reviewer fields are declared metadata, not cryptographic identity proof.

Source control, GitHub signatures, Electron build identity, or local execution do not upgrade those flags.

## Result

A successful certification contains internally:

- a valid P1C8 `p1c8-human-certification-record`;
- a P1C4-compatible `certified` resource profile;
- the exact P1C7 session reference data and approved requirements.

The complete certification remains in process memory for a later governed activation/export phase.

## Sanitized UI

Router Diagnostics renders only:

- reviewer display name;
- certified minimum RAM;
- certified minimum VRAM for CUDA12;
- reviewer identity verified: No;
- certification authenticity verified: No;
- loaded into runtime registry: No.

It never renders:

- reviewer ID;
- review note;
- P1C8 record payload;
- source commit;
- runtime/model/auxiliary hashes;
- raw benchmark evidence.

## Runtime activation boundary

P1C23 does not:

- modify `runtimeResourceProfileCertifications.mjs`;
- mutate the P1C18 runtime certification source;
- reload or update the runtime registry;
- grant provider-selection authority;
- route generation;
- authorize cutover.

The public result explicitly reports:

- `certificationOnly: true`;
- `runtimeRegistryLoaded: false`;
- `reviewerIdentityVerified: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

## Next

A later phase may create a deterministic, reviewable **activation proposal/export** from the in-memory P1C8 certification.

That later phase must remain separate from certification and must not silently write or activate a production runtime profile.
