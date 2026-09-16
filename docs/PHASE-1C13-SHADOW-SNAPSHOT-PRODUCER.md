# P1C13 — Explicit Shadow Snapshot Producer

## Purpose

P1C13 adds a single explicit orchestration function that converts already-provided shadow compatibility inputs into a sanitized P1C10 snapshot and publishes that snapshot through the governed P1C12 in-memory handoff.

It remains deliberately **off-path**. Nothing calls this producer automatically.

## Inputs

The producer receives:

- a P1C9-compatible immutable shadow registry;
- runtime evidence;
- model evidence;
- hardware evidence;
- exact width and height;
- exact ISO `capturedAt`.

It does not obtain any of those inputs itself.

## Pipeline

The producer performs exactly this sequence:

1. validate the registry authority boundary;
2. call `registry.evaluateShadowCompatibility(...)`;
3. call `createShadowCompatibilityDiagnostics(...)`;
4. require a valid P1C10 sanitized snapshot;
5. publish only that snapshot through the P1C12 handoff.

The producer returns only stable metadata about the operation. It does not return raw registry records, reviewer data, artifact hashes, filesystem paths, or arbitrary exception text.

## Fail-closed behavior

P1C13 rejects:

- invalid registry authority;
- invalid resolution;
- evaluator exceptions;
- P1C10 diagnostic rejection;
- P1C12 stale/conflicting/invalid publication;
- publisher exceptions;
- a publisher result that claims routing or cutover authority.

Exception messages are never reflected into the result.

## No evidence acquisition

P1C13 has no:

- hardware probing;
- filesystem access;
- browser storage;
- database access;
- fetch/network access;
- Electron IPC;
- timers/background polling.

Therefore this phase does not yet make the diagnostics self-populating.

## Authority boundary

Every producer result preserves:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next

P1C14 may define a bounded **diagnostic evidence collector** that gathers only the existing read-only runtime/model/hardware evidence required by P1C13. It must remain separate from generation execution and must not change provider readiness, routing, or cutover.
