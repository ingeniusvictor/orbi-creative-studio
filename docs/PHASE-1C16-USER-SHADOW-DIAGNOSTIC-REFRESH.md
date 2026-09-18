# P1C16 — User-Initiated Shadow Diagnostic Refresh

## Purpose

P1C16 makes the P1C14 → P1C15 diagnostic pipeline explicitly usable from Router Diagnostics without granting any generation, routing, provider-selection, or cutover authority.

The user can request a **local compatibility refresh**. The action reads the existing sanitized Compute Router readiness snapshot, resolves one bounded diagnostic context, runs P1C15, and then Router Diagnostics re-renders the P1C12 in-memory snapshot.

## Context resolution

P1C16 does not silently choose among multiple installed models.

A context is auto-resolved only when:

- the existing Electron readiness bridge is available;
- the runtime reports backend `cpu` or `cuda12`;
- exactly one downloaded sd.cpp model matches a known P1C4 target;
- that target has an explicit width and height.

If zero targets exist, refresh is rejected.

If more than one downloaded target exists, refresh is rejected as `REFRESH_DIAGNOSTIC_CONTEXT_AMBIGUOUS`. A later phase may add an explicit diagnostic target selector.

## Certified-profile boundary

P1C16 deliberately creates an empty governed P1C9 registry by default:

`createCertifiedResourceProfileRegistry({ certifications: [] })`

This means real runtime/model/hardware facts can be observed now, but no resource requirement is invented and no profile is represented as certified.

Until real P1C8 certification records are deliberately loaded into a governed runtime registry, the correct compatibility outcome can remain **unknown / profile not certified**.

## UI action

Router Diagnostics gains one additional button:

**Refresh local compatibility**

The button is marked `diagnostic-only` and:

1. invokes P1C16;
2. disables itself while the request is running;
3. never displays arbitrary downstream error strings;
4. re-renders the existing P1C12 snapshot after completion.

The pre-existing generic Router Diagnostics **Refresh** remains unchanged.

## Security and authority

P1C16 has no:

- direct Electron IPC calls;
- network fetch;
- browser storage;
- filesystem access;
- timers or polling;
- generation dispatch;
- provider selection;
- route mutation;
- cutover control.

Every result remains:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next

P1C17 may add an explicit diagnostic context selector for systems with more than one downloaded local model and/or a governed loader for real P1C8-certified resource profiles. Neither should change generation authority.
