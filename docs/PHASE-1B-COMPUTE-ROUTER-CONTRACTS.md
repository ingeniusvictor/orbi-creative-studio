# ORBI Creative Studio — Phase 1B Compute Router Contracts

Status: contract-only implementation candidate. No Studio/provider wiring in this phase.

Related: #4

## Purpose

Define the stable internal language ORBI will use to describe generation intent, provider capability, readiness and deterministic provider selection before replacing any working upstream execution path.

## Contracts

### GenerationRequest

A request describes intent, not implementation:

- capability: `t2i`, `i2i`, `t2v`, `i2v`, `v2v`, `lipsync`, or `audio`
- optional preferred model
- prompt/inputs
- output constraints
- privacy policy
- cost policy
- latency policy
- explicit fallback permission

### ProviderDescriptor

A provider declares facts:

- stable provider ID
- execution class: device / LAN / Edge / cloud
- trust boundary
- metering mode
- health
- credential readiness
- one or more model capability descriptors
- optional measured latency and queue depth

Provider and model identities are required.

## Hard filters

A provider is rejected before scoring when any of these fail:

1. runtime health is not executable,
2. privacy policy is violated,
3. cost policy is violated,
4. required credentials are missing,
5. requested operation/model/output constraints do not match.

This prevents scoring from overriding a safety or policy constraint.

## Privacy policy

- `device-only`: same-device trust boundary only.
- `trusted-lan`: same-device or explicitly trusted network; third-party cloud is rejected.
- `cloud-ok`: cloud may be considered, subject to all other filters.

There is no implicit cloud fallback.

## Cost policy

- `free-only`: currently accepts local-compute metering only.
- `prefer-free`: local compute receives a scoring preference.
- `metered-ok`: metered providers may compete normally.

The router does not equate API monetary cost with total energy/compute cost; that accounting is a later layer.

## Deterministic scoring

After hard filtering, eligible providers are ranked using:

- execution locality,
- trust boundary,
- metering,
- health,
- preferred model,
- measured latency,
- queue depth.

Equal scores are resolved by stable provider ID, making decisions reproducible.

## Result shape

Routing returns either:

- `SELECTED` with selected candidate + ordered candidates + rejected candidates, or
- `NO_ELIGIBLE_PROVIDER` with structured rejection reasons.

## Current non-goals

This branch does not:

- call MuAPI,
- invoke sd.cpp,
- invoke Wan2GP,
- touch Studio UI,
- discover hardware,
- download models,
- implement distributed inference,
- add automatic fallbacks,
- change billing behavior.

## Next implementation step

After this contract layer passes CI, create provider adapters that describe current behavior without changing it:

1. MuAPI adapter,
2. sd.cpp adapter,
3. Wan2GP adapter.

Only after parity tests should Studio provider decisions move behind this router.
