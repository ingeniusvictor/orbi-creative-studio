# ORBI Creative Studio — Master Status

Current Phase 2A starting canonical: `4147512695eb0ad94afd5f488a4c530dfeefc94f`.

## Product identity

**ORBI Creative Studio** is the creative AI workstation inside the ORBI ecosystem. The repository originated from Open Generative AI and still contains substantial upstream Open Generative AI / MuAPI identity, while ORBI development has added its own governed local-AI compute routing, hardware evidence, Scene3D pilot work, desktop security boundaries and QA gates.

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

Phase 1C answered one narrow but safety-critical question: what evidence is required before a local model/hardware combination can ever be considered for later routing decisions?

P1C62–P1C70 established and closed that governance foundation:

- P1C62 — real hardware-pilot evidence bundle.
- P1C63 — governed JSON export.
- P1C64 — explicit export UI.
- P1C65 — trusted import and current-contract revalidation.
- P1C66 — import UI and sanitized intake metadata.
- P1C67 — safe human-review projection.
- P1C68 — explicit approve/reject human decision record.
- P1C69 — evidence-scoped pilot-certified profile.
- P1C70 — final Phase 1C lock.

There is no P1C71 continuation.

Even an approved P1C69 profile remains deliberately non-authorizing:

- `reviewerIdentityVerified = false`
- `cryptographicAuthenticityVerified = false`
- `productionProfilePromoted = false`
- `routingEligible = false`
- `cutoverAuthorized = false`
- `executionAuthority = legacy-dispatcher-only`

Compute Router work is now maintenance-only unless a concrete product feature requires a change.

## Phase 2 — Creative Product Integration & ORBI UX

### Phase 2A — Product Surface Audit — CURRENT

Canonical audit: `docs/PHASE-2A-CREATIVE-STUDIO-PRODUCT-AUDIT.md`.

The audit establishes four important truths:

1. Image, Video, Cinema and Lip Sync are already substantial working creative surfaces; Phase 2 is not a restart.
2. Workflows and Agents are placeholders only in the Electron shell; real web/workspace implementations already exist and should be integrated rather than rebuilt blindly.
3. Scene3D has meaningful governed backend infrastructure but is still a default-OFF pilot without a primary creative surface.
4. The largest immediate mismatch is identity: the application still presents itself broadly as Open Generative AI / MuAPI even though significant ORBI engineering now exists underneath.

### Phase 2B — ORBI Identity Foundation — NEXT

The next code-changing workstream is a bounded product rebrand/foundation pass:

- ORBI Creative Studio package/product identity;
- Electron window/error identity;
- Vite/web metadata and favicon/branding surface;
- desktop header identity;
- Next route metadata;
- README top-level product explanation;
- installer-visible identity where migration is safe;
- explicit upstream license and attribution preservation.

This phase must not rename provider APIs, third-party model names, upstream license ownership, or other technical identifiers that need compatibility.

### Phase 2C — Navigation & Capability Truth

After identity is stable, reorganize navigation around actual capability:

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

1. Do not create P1C71, P1C72 or other Phase 1C continuation milestones.
2. New work must map to a product outcome in Phase 2 or be an explicit regression/maintenance fix.
3. Do not advertise capabilities that exist only as placeholders.
4. Prefer integrating existing working surfaces over rebuilding them.
5. Keep engineering diagnostics out of the primary creative journey unless a user explicitly opens advanced settings.
6. Phase 2 milestones are outcome-sized; do not split them into dozens of micro-milestones unless correctness/release gating truly requires it.

These rules exist to keep ORBI Creative Studio understandable as a product rather than allowing infrastructure detail to obscure the goal again.
