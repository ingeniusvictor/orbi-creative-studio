# Phase 0 Audit — Submodules & License Status

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

The root repository is MIT licensed. The pinned baseline also references three Git submodules, which must be treated as separately versioned dependencies.

## 1. Vibe Workflow

- Path: `packages/Vibe-Workflow`
- Declared URL: `https://github.com/SamurAIGPT/Vibe-Workflow.git`
- Pinned gitlink: `c65ce897e82bf73659c2725528c8492cd609d831`
- License at pinned commit: **MIT**
- Copyright: 2024 Vibe Workflow Contributors
- Status: **verified**

## 2. Open Poe AI

- Path: `packages/Open-Poe-AI`
- Declared URL: `https://github.com/Anil-matcha/Open-Poe-AI.git`
- Pinned gitlink: `3e21ebc92d93bd699ffc6000bbcf980eaa8830cb`
- License: **not yet verified**
- Repository state: GitHub API request to the declared repository returned a permanent redirect; direct LICENSE retrieval at the pinned commit did not succeed during the pre-import audit.
- Status: **legal/availability follow-up required**

Do not assume the root MIT license automatically resolves this submodule's licensing. Verify the exact redirected repository and license before ORBI redistributes or materially modifies this component.

## 3. Open AI Design Agent

- Path: `packages/Open-AI-Design-Agent`
- Declared URL: `https://github.com/Anil-matcha/Open-AI-Design-Agent`
- Pinned gitlink: `ebc0ce7650baad0d13797ccd471c883e78be3161`
- License at pinned commit: **MIT**
- Copyright: 2023 Anil Chandra Naidu Matcha
- Status: **verified**

## 4. ORBI policy for third-party code

ORBI Creative Studio should maintain a machine-readable dependency/attribution inventory containing at least:

- component name
- source repository
- pinned commit/tag
- license identifier
- copyright notice
- modification status
- redistribution obligations

## 5. Import rule

The history-preserving upstream import should retain `.gitmodules` and the exact gitlink SHAs before any submodule update is attempted.

Do **not** run an unqualified `git submodule update --remote` during baseline certification, because that would move dependencies away from the pinned upstream state.

Correct Phase 0 behavior after import:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

Then verify each checked-out submodule SHA matches the gitlink stored in the pinned baseline.

## 6. Release gate

ORBI public/commercial distribution remains blocked on legal inventory completion until the `Open-Poe-AI` submodule license/repository redirect is resolved and all bundled assets/dependencies with redistribution implications have been reviewed.