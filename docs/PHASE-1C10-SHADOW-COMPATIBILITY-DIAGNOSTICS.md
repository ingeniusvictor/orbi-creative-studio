# P1C10 — Sanitized Shadow Compatibility Diagnostics

## Purpose

P1C10 defines a strict, read-only diagnostic snapshot over the P1C9 certified-resource-profile registry and the existing local compatibility evaluator.

It exists to make shadow compatibility observable without exposing benchmark provenance, reviewer metadata, auxiliary artifact hashes, mutable registry internals, or any generation authority.

## Exact context binding

P1C9 now returns the exact model/backend/resolution context used for each shadow evaluation. P1C10 requires the caller-supplied requested context to match that context exactly.

A diagnostic snapshot cannot therefore be relabeled as a different model, backend, width, or height.

## Sanitized output

The snapshot contains only:

- exact model/backend/resolution context;
- registry match and certified-profile state;
- compatibility status and allowlisted reason codes;
- backend hardware state;
- required and observed system RAM;
- required and observed VRAM;
- capture timestamp;
- immutable authority boundaries.

P1C10 does **not** expose:

- reviewer identity or review note;
- runtime/model/LLM/VAE SHA-256 hashes;
- benchmark run timestamps or run indexes;
- raw hardware probe output;
- filesystem paths;
- registry mutation methods;
- arbitrary error strings.

Unknown or unapproved reason/state values fail closed rather than being reflected.

## Authority boundary

P1C10 is diagnostic only:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

It does not modify provider readiness, select a provider, execute a model, call generation, persist data, use IPC, or write browser/filesystem storage.

## Next

P1C11 may expose this already-sanitized snapshot through the existing Router Diagnostics surface as a read-only view. That UI phase must not gain generation, registry mutation, routing, or cutover controls.
