# P1C11 — Read-only Shadow Diagnostics UI

## Purpose

P1C11 adds a read-only rendering surface for the already-sanitized P1C10 compatibility snapshot inside the existing Router Diagnostics panel.

This phase intentionally does **not** add a new snapshot source, registry connection, IPC bridge, persistence mechanism, routing action, or cutover control.

## Trust boundary

The panel accepts an optional `shadowCompatibilitySnapshot`.

Before any snapshot values are rendered, P1C11 calls `validateShadowCompatibilitySnapshot()`, which requires the exact P1C10 shape and rejects:

- extra top-level fields;
- reviewer/provenance additions;
- unknown reason codes;
- invalid compatibility/resource/hardware states;
- inconsistent certification state;
- forged routing/cutover authority;
- invalid timestamps or contexts.

The panel uses DOM `textContent` through existing text helpers. Snapshot data is never inserted as executable HTML.

## Read-only UI

The section displays:

- model / backend / resolution;
- compatibility status;
- certified resource-profile state;
- observed / required system RAM;
- observed / required VRAM;
- allowlisted diagnostic reasons;
- execution authority.

When no valid snapshot is supplied, the section displays a neutral unavailable state.

## Action boundary

The existing **Refresh** button remains the only `.onclick` action in `RouterDiagnosticsPanel`.

P1C11 adds no:

- profile selection;
- profile editing;
- benchmark controls;
- provider selection;
- generation controls;
- fallback controls;
- routing controls;
- cutover controls.

## Authority boundary

The rendered snapshot remains:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

## Next

P1C12 may define a governed **read-only snapshot handoff** into the diagnostics surface. That handoff must provide only a P1C10-validated snapshot and must not expose the underlying registry, benchmark evidence, reviewer metadata, or execution capabilities.
