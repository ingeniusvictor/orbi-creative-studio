# P1C17 — Explicit Shadow Diagnostic Target Selector

## Purpose

P1C17 extends the P1C16 user-initiated diagnostic refresh so systems with more than one downloaded local model can be diagnosed without hidden target selection.

P1C17 remains diagnostic-only. Selecting a target does not select a generation provider, modify routing, or authorize cutover.

## Target listing

The existing P1C16 controller now exposes `listUserShadowDiagnosticTargets()`.

The target list is derived only from the existing sanitized readiness bridge and includes:

- downloaded sd.cpp models only;
- model identities already present in the fixed P1C4 default target set;
- current runtime backend only when it is `cpu` or `cuda12`;
- the fixed target width and height.

The list is deterministic and sorted by model id.

It contains no hardware details, paths, hashes, prompts, reviewer information, or provider secrets.

## Explicit context refresh

`runUserShadowDiagnosticRefresh(requestedContext)` now accepts an optional explicit context.

If a context is supplied, it must exactly match one currently downloaded diagnostic target:

- model id;
- backend;
- width;
- height.

Unavailable or malformed selections are rejected before P1C15 is invoked.

If no selection is supplied, P1C16 behavior remains unchanged:

- one target: refresh can proceed;
- zero targets: reject;
- multiple targets: reject as ambiguous.

## Router Diagnostics behavior

Router Diagnostics still has exactly two buttons:

1. generic Router Diagnostics refresh;
2. diagnostic-only local compatibility refresh.

P1C17 adds a `<select>` control only when more than one diagnostic target is available.

On the first compatibility refresh with multiple targets:

1. the current target list is read;
2. no diagnostic is run;
3. the UI requests explicit target selection.

After a target is selected, pressing the same compatibility refresh button runs only that exact target.

The selector is marked `diagnostic-only` and uses textContent for option labels.

## Authority boundary

All target-list and refresh results remain:

- `diagnosticOnly: true`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

The default P1C16 registry remains empty and governed. P1C17 does not load or invent certified resource profiles.

## Next

P1C18 can address the next real limitation: loading deliberately approved P1C8 certification records into a governed runtime registry so selected diagnostic targets can be evaluated against certified RAM/VRAM requirements rather than remaining “profile not certified.”
