# P1C18 — Governed Runtime Certified Resource Profile Registry

## Purpose

P1C18 replaces the temporary “create an empty registry directly inside P1C16” behavior with a governed runtime source and loader for P1C8-certified resource-profile records.

This phase deliberately does **not** add any certification record. There is currently no real P1C8 record that should be represented as approved runtime evidence.

## Static certification source

`runtimeResourceProfileCertifications.mjs` contains the only default runtime source:

- source type: `source-controlled-static-bundle`;
- source revision: `1`;
- deeply frozen;
- no dynamic parameters;
- no filesystem, network, browser storage, IPC, environment, URL or JSON ingestion;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

The certification array is intentionally empty.

Synthetic, demo and test-fixture certification records must never be inserted into this runtime source.

## Loader

`loadRuntimeCertifiedResourceProfileRegistry()` accepts no arguments.

It:

1. validates the exact static source shape;
2. requires the source to be deeply frozen;
3. rejects any authenticity, routing, cutover or non-legacy authority claim;
4. passes the complete certification array into the existing P1C9 `createCertifiedResourceProfileRegistry()`;
5. returns the resulting immutable P1C9 shadow registry plus source metadata.

P1C18 does not bypass P1C8/P1C9 validation.

## Diagnostic integration

P1C16/P1C17 user diagnostics now use the P1C18 loader as the default registry provider.

Because the source contains zero real certification records today, the runtime registry size remains zero and the correct diagnostic result remains **profile not certified / compatibility unknown**.

This is expected and truthful.

## What P1C18 does not prove

Source control inclusion is not application-level provenance or identity verification.

P1C18 explicitly keeps:

- `authenticityVerified: false`;
- reviewer identity verification unchanged from P1C8;
- no cryptographic provenance claim;
- no trusted timestamp claim.

A future record may enter this source only after the existing controlled benchmark + human certification chain has produced a genuine P1C8 record and that exact record is deliberately reviewed and committed.

## Authority boundary

P1C18 still cannot:

- execute a local model;
- select a generation provider;
- modify generation routing;
- promote benchmark evidence automatically;
- authorize cutover.

All downstream diagnostics remain shadow-only under the legacy dispatcher.

## Next

The next meaningful phase should not fabricate a “first certified profile.” It should either:

1. run the real P1C5–P1C8 process on an actual machine/model/backend target and produce genuine evidence; or
2. build a controlled export/import review artifact for such evidence while keeping runtime loading source-controlled and non-authorizing.

Until then, the source should remain empty.
