# P1C15 — Explicit Shadow Diagnostic Orchestrator

## Purpose

P1C15 composes the already-governed P1C14 evidence collector with the P1C13 snapshot producer into one explicit diagnostic-only invocation.

It does not add automatic startup behavior, generation routing, provider selection, polling, or cutover authority.

## Pipeline

The orchestrator executes exactly this sequence:

1. call the P1C14 collector for one exact model/backend/resolution context;
2. verify collector authority boundaries;
3. verify that returned evidence context exactly matches the requested context;
4. pass only the collected runtime/model/hardware facts plus the supplied P1C9 registry to P1C13;
5. map P1C13 publication/unchanged/rejection into stable P1C15 result metadata.

P1C15 does not read hardware or runtime state directly. It does not bypass P1C14 or P1C13.

## Exact context binding

The collector evidence must match the requested:

- model id;
- backend;
- width;
- height.

Any mismatch fails closed before the producer is called.

## Failure model

The orchestrator returns stable reason codes only.

Collector and producer exceptions are converted to:

- `ORCHESTRATOR_COLLECTOR_FAILED`
- `ORCHESTRATOR_PRODUCER_FAILED`

Known, allowlisted downstream rejection codes may be preserved for diagnostics. Unknown/arbitrary downstream reason text is replaced by a stable generic code.

Forged collector or producer authority is rejected independently.

## No automatic invocation

P1C15 is not imported by:

- application startup;
- Settings;
- Image Studio;
- Video Studio.

It therefore does not make shadow diagnostics run automatically. A future phase must define an explicit invocation surface if desired.

## No execution authority

P1C15 never authorizes or executes generation.

Every result preserves:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next

P1C16 may expose a narrowly-scoped **diagnostic refresh invocation** to the existing Router Diagnostics UI. That surface must remain user-initiated/read-only and must not become a generation or routing control.
