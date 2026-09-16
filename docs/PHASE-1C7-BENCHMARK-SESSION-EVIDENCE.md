# ORBI Creative Studio — Phase 1C7 Benchmark Session Evidence

Status: review-only benchmark session evidence. No production resource profile is promoted.

## Purpose

Bind at least three P1C6 benchmark runs into one exact-context review bundle, including auxiliary artifact integrity for models that require it, and derive a P1C5 resource-certification candidate without granting routing authority.

## Per-run evidence envelope

P1C7 wraps each P1C6 sample in `p1c7-benchmark-run-evidence`.

For Z-Image runs the capture wrapper computes SHA-256 for:

- the LLM/text encoder artifact;
- the VAE artifact.

These hashes live outside the strict P1C5 sample schema, preserving P1C5 compatibility while closing the P1C6 auxiliary-artifact evidence gap.

Every run envelope also preserves:

- `benchmarkOnly: true`
- `productionProfilePromoted: false`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Session validation

`buildBenchmarkSessionEvidence()` requires:

- at least three P1C7 run envelopes;
- every embedded P1C5 sample to be valid;
- exact P1C5 context consistency through the P1C5 candidate builder;
- complete required auxiliary roles for known auxiliary-dependent models;
- identical auxiliary SHA-256 values across every run;
- no auxiliary evidence for models that do not require it;
- an exact ISO review timestamp.

Known Z-Image models currently require the roles:

- `llm`
- `vae`

Any missing, duplicate, malformed, unexpected, or drifting auxiliary evidence fails closed.

## Candidate derivation

After envelope validation, P1C7 passes the embedded samples to P1C5 `buildResourceCertificationCandidate()`.

Therefore the existing rules remain authoritative:

- minimum three samples;
- exact model/backend/resolution;
- exact harness/runtime/source-commit/artifact context;
- unique run indexes;
- maximum observed RAM/VRAM plus explicit safety margin;
- review-only candidate output.

P1C7 does not copy or reimplement those derivation rules.

## Production boundary

A successful session has:

- `status: review-only`
- `requiresHumanCertification: true`
- `productionProfilePromoted: false`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

The embedded P1C5 candidate remains `benchmark-candidate`, not P1C4 `certified`.

The P1C4 resolver therefore continues to reject it as a production resource profile.

## Side-effect boundary

The session builder is pure and does not:

- launch runtimes;
- execute inference;
- access filesystem or network;
- use IPC or browser storage;
- modify provider readiness;
- modify Studio execution;
- write to the P1C4 resource-profile registry;
- authorize cutover.

The Electron-side run-evidence capture helper only composes P1C6 with SHA-256 hashing of required auxiliary files; it has no IPC registration.

## Next step

P1C8 should define an explicit human certification/promotion record for a reviewed P1C7 bundle. Promotion must be a separate, auditable act that:

1. references the exact P1C7 evidence bundle;
2. records reviewer identity as declared metadata without pretending cryptographic identity proof;
3. records the exact approved requirements;
4. never enables routing or cutover by itself;
5. produces a P1C4-compatible certified profile only after strict validation.
