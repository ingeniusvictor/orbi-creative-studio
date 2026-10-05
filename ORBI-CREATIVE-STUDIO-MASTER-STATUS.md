# ORBI Creative Studio — Master Status

Last canonical checkpoint before this closeout: `c6d7df62750d64552b4dfe3261d7f28e455b9c41`.

## Product identity

ORBI Creative Studio is the creative AI workstation inside the ORBI ecosystem. The repository originated from Open Generative AI, but ORBI development adds its own governed local-AI compute routing, hardware evidence, Scene3D pilot work, desktop security boundaries, QA gates, and future ORBI product/brand integration.

The product is larger than the Compute Router. The router is infrastructure underneath the creative surfaces.

```text
ORBI CREATIVE STUDIO
├─ Image creation / editing
├─ Video creation / composition
├─ Audio / voice workflows
├─ Lip-sync / cinema / workflow surfaces inherited from the base application
├─ Scene3D pilot
├─ Desktop application shell
└─ Compute Router
   ├─ cloud-provider readiness
   └─ local-AI execution governance
```

## Why Phase 1C became so large

Phase 1C concentrated on one narrow but safety-critical question: when ORBI sees a local model and a local machine, what evidence is required before that combination can ever be trusted for later routing decisions?

The phase therefore accumulated many small gates around benchmark collection, provenance, resource observations, export/import, review, and non-authorizing certification. Those milestones are infrastructure work, not separate products.

## Phase 1C final closeout

P1C62–P1C66 established the current hardware-pilot evidence loop:

- P1C62 — build the real hardware-pilot evidence bundle.
- P1C63 — export governed evidence to JSON.
- P1C64 — expose explicit export in Router Diagnostics.
- P1C65 — import and revalidate exported JSON in trusted Electron Main.
- P1C66 — expose explicit import and sanitized intake metadata in Router Diagnostics.

This closeout intentionally ends the phase with four bounded milestones:

- **P1C67 — Human Review Projection:** derive a safe review projection from imported evidence without returning the raw bundle to the renderer.
- **P1C68 — Human Decision Record:** require an explicit approve/reject decision plus review note and retain one immutable decision per imported file SHA-256.
- **P1C69 — Pilot-Certified Local Profile:** an approval may produce an evidence-scoped profile containing observed timing/resource envelopes. It is not a production runtime profile.
- **P1C70 — Phase 1C Final Lock:** Phase 1C is closed. There is no P1C71 continuation.

## Authority boundary at P1C70

Even an approved P1C69 profile remains deliberately non-authorizing:

- `reviewerIdentityVerified = false`
- `cryptographicAuthenticityVerified = false`
- `productionProfilePromoted = false`
- `routingEligible = false`
- `cutoverAuthorized = false`
- `executionAuthority = legacy-dispatcher-only`

P1C70 therefore does **not** switch generation traffic, activate a provider, promote a runtime profile, or grant cutover authority.

## What comes next

The next workstream is **Phase 2 — Creative Product Integration & ORBI UX**.

Its first action should be a product-facing audit rather than more local-router milestones:

1. inventory the visible Studio surfaces that currently work in the ORBI fork;
2. identify inherited Open Generative AI branding and UX that must become ORBI-native;
3. verify Image, Video, Audio/Lip Sync, Scene3D and desktop workflows end-to-end;
4. define the ORBI Creative Studio navigation and design system;
5. prioritize user-visible gaps before adding new infrastructure;
6. keep Compute Router changes in maintenance mode unless a concrete product feature requires them.

## Governance rule

Do not create `P1C71`, `P1C72`, or other Phase 1C continuation milestones. A new requirement must be classified as either:

- a Phase 1C maintenance fix/regression, or
- a new Phase 2 product/integration milestone.

This rule exists specifically to prevent infrastructure work from obscuring the Studio product again.
