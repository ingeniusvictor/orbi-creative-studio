# ORBI Creative Studio — Master Status

Current Phase 2 canonical entering identity work: `1c77d101dfbce481c9443c75a63cfea02e297e08`.

## Product identity

**ORBI Creative Studio** is the creative AI workstation inside the ORBI ecosystem. The repository originated from Open Generative AI; ORBI development now adds its own governed local-AI compute routing, hardware evidence, Scene3D pilot work, desktop security boundaries, QA gates and product identity layer.

The product is larger than the Compute Router. The router is infrastructure underneath the creative surfaces.

The repository currently contains two application surfaces:

```text
ORBI CREATIVE STUDIO
├─ Electron / Vite desktop
│  ├─ Image Studio ............. functional, cloud + local
│  ├─ Video Studio ............. functional, cloud + local/Wan2GP
│  ├─ Cinema Studio ............ functional, cloud
│  ├─ Lip Sync Studio .......... functional, cloud
│  ├─ Workflows ................ desktop placeholder / web capability exists
│  ├─ Agents ................... desktop placeholder / web capability exists
│  ├─ MCP / CLI ................ upstream-oriented developer information
│  ├─ Local Models ............. functional advanced settings
│  ├─ Router Diagnostics ....... functional engineering surface
│  └─ Scene3D .................. governed pilot, default OFF
│
├─ Next / web application
│  ├─ Studio shared shell
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

A standalone Audio Studio is **not currently present** in the Electron product and must not be described as shipping functionality.

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

The audit established four product truths:

1. Image, Video, Cinema and Lip Sync are already substantial working creative surfaces; Phase 2 is not a restart.
2. Workflows and Agents are placeholders only in the Electron shell; real web/workspace implementations already exist and should be integrated rather than rebuilt blindly.
3. Scene3D has governed backend infrastructure but is still a default-OFF pilot without a primary creative surface.
4. Visible identity remained predominantly Open Generative AI / MuAPI despite substantial ORBI engineering underneath.

### Phase 2B — ORBI Identity Foundation — CURRENT

Canonical design: `docs/PHASE-2B-ORBI-IDENTITY-FOUNDATION.md`.

This phase introduces an explicit ORBI product identity across active desktop and web surfaces while preserving compatibility-sensitive legacy installer/storage identifiers until migration is proven.

Current Phase 2B scope:

- canonical `shared/productIdentity.json`;
- Electron window/error identity;
- desktop ORBI wordmark/header identity;
- Vite title and metadata;
- Next root and route metadata;
- package description/homepage;
- explicit upstream attribution boundary;
- CI lock preventing accidental rename of storage-sensitive legacy identifiers.

Compatibility boundary for this pass:

- npm `name` remains `open-generative-ai`;
- Electron Builder `productName` remains `Open Generative AI`;
- Electron Builder `appId` remains `ai.generative.open`.

Those fields may change only after a user-data migration gate proves that local models, runtimes and encrypted credentials remain recoverable across upgrade.

README top-level reframing and installer/storage identity migration remain separate attribution/migration work and must not be done by blind string replacement.

### Phase 2C — Navigation & Capability Truth — NEXT AFTER 2B

After visible identity is stable, reorganize navigation around actual capability:

- Core creative: Image, Video, Cinema, Lip Sync.
- Web-integrated/pending desktop convergence: Workflows, Agents.
- Experimental: Scene3D.
- Advanced: Local Models, Router Diagnostics.
- Developer surface: MCP/CLI only after an ORBI product decision.

### Phase 2D — Desktop/Web Convergence Spike

Prove one shared integration path for Workflows/Agents before scaling it. Do not duplicate existing web applications without evidence that shared integration is unsuitable.

### Phase 2E — End-to-End Creative QA

Validate the product as a coherent ORBI experience across core creative generation, local/cloud paths and selected web integration.

## Governance rules

1. Do not create `P1C71`, `P1C72` or other Phase 1C continuation milestones.
2. New work must map to a product outcome in Phase 2 or be an explicit regression/maintenance fix.
3. Do not advertise capabilities that exist only as placeholders.
4. Prefer integrating existing working surfaces over rebuilding them.
5. Keep engineering diagnostics out of the primary creative journey unless a user explicitly opens advanced settings.
6. Phase 2 milestones are outcome-sized; do not split them into dozens of micro-milestones unless correctness/release gating truly requires it.

These rules exist to keep ORBI Creative Studio understandable as a product rather than allowing infrastructure detail to obscure the goal again.
