# P1C24 — Runtime Certification Promotion Package

## Purpose

P1C24 introduces a governed promotion package that bridges an explicit in-memory P1C23 human certification toward a future source-controlled runtime registry update.

It does **not** mutate the runtime certification source, load the runtime registry, enable generation routing, or authorize cutover.

## Input

The phase accepts only an exact diagnostic target:

- model ID;
- backend;
- width;
- height.

The matching P1C23 certification is read from the existing in-memory certification store.

## Validation

Before a promotion package can be prepared, P1C24 requires:

1. a valid P1C23 certification for the exact selected target;
2. the existing P1C9 certification-entry validator to accept that certification;
3. a one-entry P1C9 registry to be constructible from the certification without gaining routing or cutover authority.

This proves the entry is structurally suitable for the governed runtime registry without loading it.

## Promotion package

The internal immutable package contains:

- package identity `p1c24-runtime-certification-promotion-package`;
- exact model/backend/resolution context;
- source type `source-controlled-static-bundle`;
- base source revision `1`;
- proposed source revision `2`;
- the detached P1C8 certification entry;
- explicit source-review requirement;
- non-authorizing boundaries.

The raw package remains internal. Router Diagnostics receives only a sanitized summary.

## User action

Router Diagnostics adds one explicit **Prepare runtime promotion package** action.

The action is available only after the selected target has a valid P1C23 certification summary.

The UI shows only:

- target;
- proposed source revision transition;
- certified RAM;
- certified VRAM when applicable;
- source review required;
- runtime registry not loaded.

It does not render:

- reviewer ID;
- review note;
- certification record;
- benchmark hashes;
- source commit;
- auxiliary evidence;
- raw promotion package.

## Source boundary

P1C24 intentionally leaves:

`src/lib/computeRouter/runtimeResourceProfileCertifications.mjs`

unchanged.

The runtime certification array remains empty and `sourceRevision` remains `1`.

A later source-review phase may deliberately materialize an approved P1C24 package into that file.

## Authority boundary

Every promotion result preserves:

- `promotionOnly: true`;
- `sourceReviewRequired: true`;
- `sourceMutationApplied: false`;
- `runtimeRegistryLoaded: false`;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

A promotion package is evidence for source review, not permission to route or execute local generation.
