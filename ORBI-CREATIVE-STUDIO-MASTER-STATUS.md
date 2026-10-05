# ORBI Creative Studio — Master Status

Current Phase 2 canonical entering navigation work: `34c730fa8e5c858ecf5e5991355075ef67b69752`.

## Product identity

**ORBI Creative Studio** is the creative AI workstation inside the ORBI ecosystem. The repository originated from Open Generative AI; ORBI development now adds its own governed local-AI compute routing, hardware evidence, Scene3D pilot work, desktop security boundaries, QA gates and ORBI product identity layer.

The product is larger than the Compute Router. The router is infrastructure underneath the creative surfaces.

The repository contains two application surfaces that must not be confused:

```text
ORBI CREATIVE STUDIO
├─ Electron / Vite desktop
│  ├─ Primary creative navigation
│  │  ├─ Image Studio .......... functional, cloud + local
│  │  ├─ Video Studio .......... functional, cloud + local/Wan2GP
│  │  ├─ Cinema Studio ......... functional, cloud
│  │  └─ Lip Sync Studio ....... functional, cloud
│  ├─ Deferred / non-primary desktop routes
│  │  ├─ Workflows ............. placeholder; web capability exists
│  │  ├─ Agents ................ placeholder; web capability exists
│  │  └─ MCP / CLI ............. developer/upstream-oriented surface
│  ├─ Advanced settings
│  │  ├─ Local Models .......... functional
│  │  └─ Router Diagnostics .... functional engineering surface
│  └─ Scene3D .................. governed pilot, default OFF
│
├─ Next / web application
│  ├─ Studio shared shell
│  ├─ Image / Video / Audio and additional Studio modules
│  ├─ Workflow routes
│  ├─ Agent create/edit/runtime routes
│  └─ Assistant route
│
└─ Infrastructure
   ├─ provider credentials / transport
   ├─ local inference
   ├─ Compute Router
   └─ hardware-pilot evidence governance
```

A standalone Audio Studio is **not currently present in the Electron product**. Audio exists in the shared web Studio and must not be advertised as an Electron capability until integrated and verified there.

## Phase 1C — CLOSED

P1C62–P1C70 established and closed the local-AI hardware evidence governance foundation:

- P1C62 — real hardware-pilot evidence bundle.
- P1C63 — governed JSON export.
- P1C64 — explicit export UI.
- P1C65 — trusted import and current-contract revalidation.
- P1C66 — import UI and sanitized intake metadata.
- P1C67 — safe human-review projection.
- P1C68 — explicit approve/reject human decision record.
- P1C69 — evidence-scoped pilot-certified profile.
- P1C70 — Phase 1C Final Lock.

There is no P1C71 continuation.

Even an approved P1C69 profile remains deliberately non-authorizing:

- `reviewerIdentityVerified = false`
- `cryptographicAuthenticityVerified = false`
- `productionProfilePromoted = false`
- `routingEligible = false`
- `cutoverAuthorized = false`
- `executionAuthority = legacy-dispatcher-only`

Compute Router work is maintenance-only unless a concrete product feature requires a change.

## Phase 2 — Creative Product Integration & ORBI UX

### Phase 2A — Product Surface Audit — COMPLETE

Canonical audit: `docs/PHASE-2A-CREATIVE-STUDIO-PRODUCT-AUDIT.md`.

Established the real desktop/web product inventory and ended infrastructure-first planning.

### Phase 2B — ORBI Identity Foundation — COMPLETE

Canonical design: `docs/PHASE-2B-ORBI-IDENTITY-FOUNDATION.md`.

Visible Electron/Vite and Next surfaces now identify as **ORBI Creative Studio** while compatibility-sensitive installer/storage identifiers remain intentionally frozen:

- npm `name` remains `open-generative-ai`;
- Electron Builder `productName` remains `Open Generative AI`;
- Electron Builder `appId` remains `ai.generative.open`.

Those identifiers may change only after a user-data migration gate proves that local models, runtimes and encrypted credentials remain recoverable across upgrade.

### Phase 2C — Navigation & Capability Truth — CURRENT

Canonical design: `docs/PHASE-2C-NAVIGATION-CAPABILITY-TRUTH.md`.

Electron primary navigation is intentionally limited to real desktop creative journeys:

- Image
- Video
- Cinema Studio
- Lip Sync

Workflows, Agents and MCP/CLI remain in the repository but are no longer advertised as finished primary Electron capabilities. Their code is preserved for controlled convergence work.

Phase 2C also establishes:

- Audio is web-available but not yet an Electron Studio;
- Scene3D remains an experimental/default-OFF pilot;
- Local Models and Router Diagnostics remain advanced/settings surfaces;
- the active navigation indicator follows the selected primary page rather than remaining visually pinned to Image.

### Phase 2D — Desktop/Web Convergence Spike — NEXT

Prove **one** shared integration path before scaling convergence.

Recommended first target: Workflows, because the Electron route already exists as a placeholder and the web application already has a dedicated workflow route/shell.

The goal is to answer whether Electron should:

- embed/reuse the existing web surface safely;
- share the underlying workspace package directly;
- or use another narrow integration boundary.

Do not duplicate Workflows or Agents until this spike produces evidence.

### Phase 2E — End-to-End Creative QA

Validate ORBI Creative Studio as one coherent product across:

- core Electron creative generation;
- cloud/local execution paths;
- selected web convergence;
- product identity and capability truth.

## Governance rules

1. Do not create `P1C71`, `P1C72` or other Phase 1C continuation milestones.
2. New work must map to a product outcome in Phase 2 or be an explicit regression/maintenance fix.
3. Do not advertise capabilities that exist only as placeholders.
4. Prefer integrating existing working surfaces over rebuilding them.
5. Keep engineering diagnostics out of the primary creative journey unless a user explicitly opens advanced settings.
6. Phase 2 milestones are outcome-sized; do not split them into dozens of micro-milestones unless correctness/release gating truly requires it.
7. Desktop and web capability claims must remain explicit; existence in one surface does not imply availability in the other.

These rules exist to keep ORBI Creative Studio understandable as a product rather than allowing infrastructure detail to obscure the goal again.
