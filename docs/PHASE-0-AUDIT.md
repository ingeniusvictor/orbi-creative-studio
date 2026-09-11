# ORBI Creative Studio — Phase 0 Static Audit

Status: **IN PROGRESS**

Baseline upstream:

- Repository: `Anil-matcha/Open-Generative-AI`
- Branch: `main`
- Pinned commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- Root tree SHA: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- Baseline date: 2026-09-11
- Root package version observed: `2.0.0`
- Root license: MIT

## Repository inventory

The pinned root tree contains:

- 299 total tree entries
- 233 blobs
- 63 directories/trees
- 3 Git submodule links
- ~29.8 MB of root-repository blob content

Git submodules pinned by the baseline:

1. `packages/Vibe-Workflow`
   - source: `SamurAIGPT/Vibe-Workflow`
   - commit: `c65ce897e82bf73659c2725528c8492cd609d831`
2. `packages/Open-Poe-AI`
   - source path in .gitmodules: `Anil-matcha/Open-Poe-AI`
   - GitHub currently resolves the repository to `Anil-matcha/open-ai-agents-hub`
   - commit: `3e21ebc92d93bd699ffc6000bbcf980eaa8830cb`
3. `packages/Open-AI-Design-Agent`
   - source: `Anil-matcha/Open-AI-Design-Agent`
   - commit: `ebc0ce7650baad0d13797ccd471c883e78be3161`

## Technology baseline

Root application:

- Next.js 15
- React 19
- Electron 33
- Vite 5
- npm workspaces
- Tailwind CSS
- Docker / docker-compose support

Declared workspaces:

- `packages/studio`
- `packages/Vibe-Workflow/packages/workflow-builder`
- `packages/Open-Poe-AI/packages/agents`
- `packages/Open-AI-Design-Agent/packages/design-agent`

## Provider topology

The application currently exposes three materially different execution paths.

### 1. MuAPI cloud path

`src/lib/muapi.js` and multiple Next.js route handlers communicate with:

`https://api.muapi.ai`

This path is responsible for much of the multi-model cloud catalog.

Observed characteristics:

- API key authentication
- client key stored in browser local storage
- proxy routes for browser/CORS use
- polling-based async generation lifecycle
- cloud file upload path
- image/video/lip-sync/agent/workflow integrations

### 2. sd.cpp local path

The Electron application embeds a local image inference surface backed by `stable-diffusion.cpp`.

Observed local image catalog includes:

- Z-Image Turbo
- Z-Image Base
- DreamShaper 8
- Realistic Vision v5.1
- Anything v5
- SDXL Base 1.0

Weights are downloaded from public Hugging Face repositories.

The local engine binary is either bundled or downloaded from:

- the upstream Open Generative AI releases for a custom macOS arm64 build, or
- `leejet/stable-diffusion.cpp` releases for supported platforms.

### 3. Wan2GP local-network path

Video and selected large image models are not embedded in the desktop process. The UI connects to a user-operated Wan2GP Gradio server over HTTP/HTTPS.

Current catalog includes:

- FLUX.1 Dev
- Qwen Image
- Wan 2.2 text-to-video
- Wan 2.2 image-to-video
- Hunyuan Video
- LTX Video

The client dynamically probes Gradio endpoint metadata and attempts to resolve version-dependent API names.

## Platform observations

The upstream application has explicit Electron packaging for:

- macOS
- Windows x64
- Linux x64

There is code and tests for Linux arm64 local inference asset resolution, but the packaged desktop target configuration is not yet a complete Android/Termux target.

Therefore the POCO/Android path should be treated as a later ORBI divergence, not as an upstream-supported baseline capability.

## Baseline tests present

Root tests observed:

- `tests/localInferenceAssets.test.js`
- `tests/localInferencePaths.test.js`
- `tests/localInferenceProgress.test.js`
- `tests/wan2gpModelAvailability.test.js`

The root `package.json` does not currently declare a generic `test` script.

## Build status

**Not yet certified.**

A full build has not been executed because the ORBI repository does not yet contain the complete upstream tree and the current environment cannot directly network-clone GitHub outside the GitHub connector.

This audit is therefore a **static source audit**, not a build certification.

## Key ORBI architectural opportunity

The upstream already separates local and cloud generation enough that ORBI does not need to rewrite the creative UI from scratch.

Recommended future abstraction:

```
ORBI Creative Studio
        |
   Provider Router
   /      |       \
sd.cpp  Wan2GP   Cloud Providers
local    LAN       optional
```

A later ORBI Compute Router can extend this with:

- ORBI Edge Mesh nodes
- Android/Termux experimental nodes
- desktop CPU/GPU nodes
- future dedicated GPU nodes
- optional cloud providers

## Phase 0 remaining blockers

- import exact upstream tree into ORBI Git history
- initialize all three submodules at pinned commits
- install dependencies
- execute root/package builds
- execute available node tests
- inspect submodule builds independently
- inventory runtime environment variables
- run dependency/security audit after import
- verify Electron local inference on at least one supported desktop target
- verify Wan2GP contract against a real server when hardware is available

## Phase 0 rule

Do not rebrand functional code, remove MuAPI, add Android support, or change model routing until the baseline import and build certification are complete.
