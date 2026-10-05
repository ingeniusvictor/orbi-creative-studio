# Phase 2A — ORBI Creative Studio Product Surface Audit

Canonical starting point: `4147512695eb0ad94afd5f488a4c530dfeefc94f`.

## Purpose

Phase 2A restores product-level control after the long Phase 1C Compute Router closeout. It inventories what a user can actually reach today across the Electron desktop shell and the Next/web surface, separates functioning Studio capabilities from placeholders and pilots, and defines the first user-visible priorities for ORBI Creative Studio.

This phase does not reopen Phase 1C and does not introduce P1C71 or later milestones.

## Product topology

The repository currently contains two user-facing application surfaces:

1. **Electron/Vite desktop shell** — routed through `src/main.js` and `src/components/*`.
2. **Next/web application** — routed through `app/*`, with workspace packages for Studio, Workflow Builder, Agents and Design Agent.

A capability may therefore be functional on web while still appearing as a placeholder in the Electron shell.

## Desktop surface inventory

| Surface | Current state | Execution path | Phase 2 interpretation |
| --- | --- | --- | --- |
| Image Studio | Functional | MuAPI cloud + local image inference | Core product; preserve and ORBI-brand |
| Video Studio | Functional | MuAPI cloud + Wan2GP/local video models when available | Core product; preserve and ORBI-brand |
| Cinema Studio | Functional | MuAPI `nano-banana-pro` image generation with camera/lens/focal/aperture prompt builder | Core creative surface |
| Lip Sync Studio | Functional | MuAPI image/video + audio lip-sync workflows | Core creative surface |
| Workflows | Placeholder in Electron | Displays web-only notice | Integrate existing web workflow capability rather than rebuild |
| Agents | Placeholder in Electron | Displays web-only notice | Integrate existing web agent capability rather than rebuild |
| MCP / CLI | Informational and interactive documentation | MuAPI/SamurAIGPT-oriented commands and external links | Upstream surface; needs ORBI product decision/reframing |
| Local Models | Functional settings surface | sd.cpp + Wan2GP configuration/catalog | Infrastructure exposed to user; keep concise |
| Router Diagnostics | Functional engineering surface | Compute Router diagnostics and hardware pilot review | Advanced/diagnostic surface, not primary product navigation |
| Scene3D | Governed pilot/diagnostics only | Electron bridge + sidecar; feature and execution default OFF | Promote later only after deliberate product UX design |
| Standalone Audio Studio | Not present | No `AudioStudio` desktop route/component found | Product gap; do not claim as shipping feature |

## Web / Next surface inventory

The web application has capabilities that the Electron navigation does not yet expose as full experiences:

- `/studio/[[...slug]]` mounts the shared `StandaloneShell`.
- `/workflow/[id]` mounts the shared `StandaloneShell` for workflow routes.
- `/agents/create`, `/agents/edit`, and `/agents/[agent_id]` provide agent-oriented routes.
- `/assistant` exists as a dedicated application route.

This means the Phase 2 desktop plan should prefer **integration and shared-shell reuse** over implementing duplicate Workflow or Agent products from scratch.

## Branding / product identity audit

ORBI-specific engineering exists, but the visible application identity is still predominantly upstream Open Generative AI / MuAPI:

- root npm package name remains `open-generative-ai`;
- Electron `productName` remains `Open Generative AI`;
- Electron `appId` remains `ai.generative.open`;
- Electron window/error text still says `Open Generative AI`;
- `index.html` title, description and keywords identify Open Generative AI;
- `index.html` still references the default Vite favicon;
- desktop header uses a generic geometric icon rather than ORBI Creative Studio identity;
- web route metadata still uses `Open Generative AI`;
- README is still primarily the upstream Open Generative AI/MuAPI project description;
- MCP/CLI surface teaches `muapi` and upstream repositories directly.

This is the largest immediate user-visible mismatch: internally the repository contains substantial ORBI engineering, while externally it still looks like the upstream application.

## What is already strong

Phase 2 is not a restart. The existing fork already contains substantial usable product capability:

- real image generation with cloud and local options;
- real video generation including local Wan2GP catalog integration;
- multi-image and image/video transformation modes;
- advanced image controls such as negative prompt, steps, seed, dimensions, style/reference strength and LoRA selection;
- Cinema camera/lens/focal/aperture authoring with generation history and download;
- image- and video-based lip sync with audio input;
- persistent mounted desktop pages so asynchronous jobs survive tab changes;
- secure Electron credential and provider boundaries;
- mature local-AI diagnostics and evidence governance;
- governed Scene3D sidecar architecture already present behind explicit feature flags.

The next phase should expose and unify this value rather than add more invisible infrastructure.

## Product gaps and priorities

### Priority 0 — ORBI Identity Foundation

Make the application visibly and technically identify as **ORBI Creative Studio** while preserving license/attribution obligations for upstream code.

Scope:

- package/product metadata;
- Electron window and error titles;
- web/Vite title and metadata;
- desktop header wordmark/identity;
- route metadata;
- README front matter and architecture explanation;
- installer-facing identity where safe;
- attribution retained separately and clearly.

### Priority 1 — Navigation and capability truth

The navigation must tell the truth about capability state.

- Core: Image, Video, Cinema, Lip Sync.
- Web-integrated / pending desktop integration: Workflows, Agents.
- Experimental: Scene3D.
- Advanced: Local Models / Diagnostics.
- MCP/CLI requires a product decision: ORBI developer tooling surface vs upstream documentation.
- Do not advertise standalone Audio until it exists as a real Studio surface.

### Priority 2 — Desktop/Web convergence

Reuse existing Next/workspace capabilities for Workflows and Agents instead of maintaining dead-end desktop placeholders.

The preferred architecture should define whether those modules are:

- embedded/shared inside Electron,
- opened as authenticated web surfaces,
- or rebuilt from the same workspace packages behind a shared product shell.

Do not choose implementation before an integration spike verifies packaging, routing, authentication and offline expectations.

### Priority 3 — Scene3D productization

Keep Scene3D default OFF until a user-facing experience is defined. The existing trusted bridge, dry-run review and execution controls should be reused. Productization should add an actual creative surface rather than exposing sidecar configuration details.

### Priority 4 — Standalone Audio decision

Audio is not currently a desktop Studio. Decide later whether ORBI needs:

- a dedicated Audio Studio,
- audio tools embedded into Video/Lip Sync/Shorts workflows,
- or both.

This is a product decision, not a Phase 2A blocker.

## Phase 2 execution map

To prevent another unbounded phase, Phase 2 is divided by product outcome rather than dozens of micro-milestones:

- **Phase 2A — Product Surface Audit**: this document and master-status alignment.
- **Phase 2B — ORBI Identity Foundation**: visible product rename/rebrand with attribution preserved.
- **Phase 2C — Navigation & Capability Truth**: organize core, web-integrated, experimental and advanced surfaces.
- **Phase 2D — Desktop/Web Convergence Spike**: prove one shared integration path for Workflows/Agents before scaling it.
- **Phase 2E — End-to-End Creative QA**: exercise Image, Video, Cinema, Lip Sync, local generation and selected web integration as a coherent product.

No Phase 2 milestone should be split further unless a concrete correctness or release gate requires it.

## Definition of Phase 2A complete

Phase 2A is complete when:

1. the desktop/web inventory above is accepted as canonical;
2. the master status points to Phase 2B as the next action;
3. no new Compute Router scope is opened;
4. the next code-changing PR is ORBI Identity Foundation, not another infrastructure milestone.
