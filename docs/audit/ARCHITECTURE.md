# Phase 0 Audit — Upstream Architecture

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

Status: **static audit complete enough for planning; runtime build is NOT yet certified.**

## 1. Root application

The pinned upstream identifies itself as `open-generative-ai` version `2.0.0` under the MIT license.

Primary technologies observed in the root package:

- Next.js 15
- React 19
- Electron 33
- Vite 5
- npm workspaces
- Tailwind/PostCSS

The repository contains overlapping delivery surfaces rather than a single minimal application:

- `app/` — Next.js application/routes and server-side proxy handlers.
- `src/` — Vite/vanilla-JS desktop/web studio implementation.
- `packages/studio/` — React studio package with the largest current feature surface.
- `electron/` — desktop bridge, local inference, IPC and Wan2GP integration.
- `packages/*` — reusable packages and three Git submodules.
- `tests/` — targeted local-inference tests.
- `scripts/` — packaging, local-AI binary staging and provider smoke tests.

## 2. Root workspaces

The root package declares these workspaces:

1. `packages/studio`
2. `packages/Vibe-Workflow/packages/workflow-builder`
3. `packages/Open-Poe-AI/packages/agents`
4. `packages/Open-AI-Design-Agent/packages/design-agent`

The upstream setup script initializes Git submodules recursively before installing dependencies and building workspace packages.

## 3. Studio surface

The React studio package contains a broad creative-product surface including:

- Image Studio
- Video Studio
- Cinema Studio
- Lip Sync Studio
- Audio Studio
- Layers Studio
- Motion Control
- Vibe Motion
- Recast
- Clipping
- Marketing
- AI Influencer
- Agent Studio
- Workflow Studio
- MCP/CLI surface
- Design Agent surface

`packages/studio/src/models.js` is a very large registry and should be treated as cloud-provider/model metadata rather than proof that every model is local or free.

## 4. Generation architecture observed

Current upstream behavior can be represented as:

```text
Studio UI
   |
   +--> MuAPI client/proxy ------------------> api.muapi.ai --> cloud models
   |
   +--> localInferenceClient
           |
           +--> sd.cpp (bundled desktop engine) --> local image models
           |
           +--> Wan2GP HTTP client -----------> user-run Gradio server
                                                  |
                                                  +--> Flux / Qwen Image
                                                  +--> Wan 2.2
                                                  +--> Hunyuan Video
                                                  +--> LTX Video
```

The local and cloud paths are already conceptually separable. This is favorable for an ORBI provider-router architecture.

## 5. Local inference path

### sd.cpp

Desktop-local image inference is implemented under `electron/lib/` and exposed to the renderer through Electron IPC.

Relevant files:

- `electron/lib/localInference.js`
- `electron/lib/localInferenceAssets.js`
- `electron/lib/localInferencePaths.js`
- `electron/lib/localInferenceRuntime.js`
- `electron/lib/modelCatalog.js`
- `electron/preload.js`
- `src/lib/localInferenceClient.js`

The local model directory can be overridden with:

`OPEN_GENERATIVE_AI_LOCAL_AI_DIR`

The asset resolver contains platform handling for macOS ARM64, Windows x64, Linux x86_64 and Linux ARM64/aarch64.

### Wan2GP

Wan2GP is not bundled. The user operates a separate Gradio server and the Electron app communicates with it over HTTP.

Relevant files:

- `electron/lib/wan2gpProvider.js`
- `electron/lib/wan2gpModelAvailability.js`
- `src/lib/localInferenceClient.js`
- `src/lib/localModels.js`

The provider probes Gradio metadata and maps changing endpoint names through aliases/family matching.

## 6. Cloud path

MuAPI is currently the dominant cloud integration.

Observed integration points include:

- `src/lib/muapi.js`
- `packages/studio/src/muapi.js`
- `vite.config.mjs`
- `middleware.js`
- Next.js API proxy routes under `app/api/`
- agent pages/routes under `app/agents/`
- upload flows and generation polling helpers

This means ORBI should not begin by deleting MuAPI calls ad hoc. A provider abstraction should be introduced first, then MuAPI can become one optional adapter.

## 7. Existing tests relevant to Phase 0

Root tests observed:

- `tests/localInferenceAssets.test.js`
- `tests/localInferencePaths.test.js`
- `tests/localInferenceProgress.test.js`
- `tests/wan2gpModelAvailability.test.js`

The root `package.json` does not currently expose a standard `npm test` script. After full import, Phase 0 should explicitly try the Node test runner against these files and record the result.

## 8. Phase 0 conclusion

The upstream architecture is suitable as an ORBI foundation **provided we preserve the baseline and refactor through explicit adapters instead of rewriting studios directly**.

Recommended boundary for ORBI:

```text
ORBI Studios / UI
        |
ORBI Generation API
        |
ORBI Provider + Compute Router
   |        |          |          |
 sd.cpp   Wan2GP   Edge Mesh   Cloud adapters
(local)   (BYO)     (future)   (MuAPI/direct)
```

No functional refactor is authorized by this document. Runtime certification must happen after the history-preserving upstream import.