# ORBI Creative Studio — Licensing and Attribution Baseline

Baseline root repository:

- `Anil-matcha/Open-Generative-AI`
- pinned commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root license file: MIT
- copyright notice: Open Generative AI Contributors

## Root repository

The root MIT license permits use, copying, modification, merging, publication, distribution, sublicensing, and sale, subject to preservation of the copyright and permission notice.

ORBI must retain the upstream MIT notice in copies or substantial portions derived from the root project.

## Submodule 1 — Vibe Workflow

- repository: `SamurAIGPT/Vibe-Workflow`
- pinned commit: `c65ce897e82bf73659c2725528c8492cd609d831`
- license file observed: MIT
- copyright: Vibe Workflow Contributors

Status: **compatible for ORBI derivation, attribution required.**

## Submodule 2 — Open AI Agents Hub / historical Open-Poe-AI path

- .gitmodules URL: `Anil-matcha/Open-Poe-AI`
- GitHub currently resolves repository metadata to: `Anil-matcha/open-ai-agents-hub`
- pinned commit: `3e21ebc92d93bd699ffc6000bbcf980eaa8830cb`
- README at the pinned commit states: `License: MIT`
- `packages/agents/package.json` at the same pinned commit also declares `"license": "MIT"`
- no root `LICENSE`, `LICENSE.md`, or `LICENSE.txt` file was found at the pinned commit
- GitHub repository metadata currently reports no detected SPDX license

Status: **MIT license intent is corroborated by two independent files at the pinned commit, but the standalone license text/copyright notice is missing.**

ORBI policy:

- keeping the dependency as an external pinned Git submodule is acceptable for Phase 0 development
- do not vendor/copy the source into an ORBI-owned subtree until the missing standalone license notice is clarified
- preserve upstream attribution and repository linkage
- public/commercial redistribution should carry an explicit third-party notice and should not invent a copyright holder that the upstream does not state

## Submodule 3 — Open AI Design Agent

- repository: `Anil-matcha/Open-AI-Design-Agent`
- pinned commit: `ebc0ce7650baad0d13797ccd471c883e78be3161`
- license file observed: MIT
- copyright: Anil Chandra Naidu Matcha

Status: **compatible for ORBI derivation, attribution required.**

## Model and weight licenses

The application code license does **not** automatically grant rights over model weights.

The baseline local catalog downloads models from multiple Hugging Face repositories, including:

- Z-Image
- Qwen3 text encoder
- FLUX VAE
- DreamShaper
- Realistic Vision
- Anything
- SDXL

Before ORBI distributes or bundles any weight, each model must receive a separate provenance/license record.

Recommended future manifest fields:

```
model_id
display_name
source_repository
source_revision
filename
sha256
runtime
weight_license
commercial_use
redistribution_allowed
attribution
notes
```

## Branding

MIT permits modification and commercial use of the code. It does not automatically grant rights to upstream trademarks, logos, names, or third-party service marks.

ORBI should:

- use its own branding
- describe Open Generative AI as upstream/derived work
- avoid implying endorsement by Higgsfield, MuAPI, model vendors, or upstream contributors
- preserve legal notices independently from ORBI product branding

## Phase 0 licensing exit criteria

- [x] root MIT license verified
- [x] Vibe Workflow MIT license verified
- [x] Open AI Design Agent MIT license verified
- [~] Open AI Agents Hub MIT intent corroborated by README + package.json; standalone license notice still missing
- [ ] model-weight license inventory created
- [ ] third-party notices file generated
- [ ] redistribution policy decided before public/commercial release
