# ORBI Creative Studio — Phase 0 Status Matrix

Status captured: 2026-09-11

Certified upstream baseline:

- `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- immutable ORBI branch: `upstream-baseline`

Legend:

- **PASS** — executed/verified successfully.
- **PASS / branch** — validated on an isolated ORBI branch, not integrated.
- **CONDITIONAL** — evidence is good but a stated gate remains.
- **BLOCKED / external** — requires hardware, legal clarification or external credentials/certificates.
- **OPEN** — planned work remains.

## Source integrity

| Gate | Status | Evidence |
|---|---|---|
| Exact upstream Git import | **PASS** | commit + root tree verified |
| Submodule pins | **PASS** | all 3 exact commits checked out recursively |
| Upstream drift at check | **PASS** | no newer upstream main commit observed |
| Immutable baseline policy | **PASS** | dedicated `upstream-baseline` retained |

## Build and tests

| Gate | Status | Evidence |
|---|---|---|
| `npm ci` | **PASS** | clean runner |
| Root baseline tests | **PASS** | 17/17 |
| Workspace builds | **PASS** | workflow/agent/design/studio |
| Next.js production build | **PASS** | clean runner |
| Electron/Vite renderer | **PASS** | clean runner |
| Docker build | **PASS** | image built |
| Docker HTTP runtime | **PASS** | live GET / successful |

## Desktop distribution

| Gate | Status | Evidence |
|---|---|---|
| Windows x64 NSIS package | **PASS** | installer generated |
| Windows silent install | **PASS** | clean runner |
| Windows installed app launch | **PASS** | survived 10-second smoke |
| Windows silent uninstall | **PASS** | exit 0 |
| Linux x64 AppImage | **PASS** | artifact + hash |
| Linux x64 DEB | **PASS** | artifact + hash |
| Linux Electron launch | **PASS** | real Electron child/process tree alive after 12 s |
| macOS x64 DMG | **PASS** | artifact + hash |
| macOS arm64 DMG | **PASS** | artifact + hash |
| Windows signing | **BLOCKED / external** | certificate not configured |
| macOS Developer ID/notarization | **BLOCKED / external** | signing identity/notarization not configured |

## Security baseline

| Gate | Status | Evidence |
|---|---|---|
| Obvious committed secret-pattern scan | **PASS** | 0 high-risk pattern hits |
| Baseline full npm audit | **OPEN** | 36 findings |
| Baseline production audit | **OPEN** | 9 findings: 1 critical / 5 high / 3 moderate |
| Security Batch A | **PASS / branch** | production 9 -> 5; critical 1 -> 0; full 36 -> 21 |
| Batch A Docker regression | **PASS / branch** | HTTP smoke |
| Batch A Windows packaging regression | **PASS / branch** | installer generated |
| PostCSS B1a nested override | **REJECTED experiment** | npm retained Next nested 8.4.31 |
| PostCSS B1b direct-spec override | **IN PROGRESS** | tests/build/audit gate passed; Docker/commit pending at capture |
| External-link URL hardening | **PASS / branch** | HTTP(S)-only shell boundary |
| Wan2GP URL hardening | **PASS / branch** | local HTTP/public HTTPS policy |
| URL-policy tests | **PASS / branch** | 22/22 total tests |

## QA

| Gate | Status | Evidence |
|---|---|---|
| Upstream declared `next lint` | **FAIL baseline configuration** | interactive/deprecated |
| Deterministic ESLint inventory | **PASS** | 164 files, 0 errors, 12 warnings |
| Deterministic lint implementation | **PASS / branch** | lint + tests + all builds |
| Warning ceiling | **PASS / branch** | max 12 enforced |

## Local image runtime

| Gate | Status | Evidence |
|---|---|---|
| sd.cpp source selector audit | **PASS** | dynamic selector mapped |
| Linux x64 sd.cpp asset resolution | **PASS** | exact release/asset captured |
| Linux x64 sd-cli execution | **PASS** | help command executed |
| sd.cpp runtime provenance | **PASS** | archive + CLI SHA-256 captured |
| Model exact identity metadata | **PASS** | 8 assets exact bytes/SHA/revision |
| Real model load | **BLOCKED / external** | multi-GB model/hardware test intentionally not consumed in CI |
| Real image generation | **BLOCKED / external** | target-hardware test still required |
| Android/POCO image generation | **OPEN** | SD1-class first experiment recommended |

## Wan2GP / video

| Gate | Status | Evidence |
|---|---|---|
| Static client architecture | **PASS** | endpoints/probe/catalog mapped |
| URL trust policy | **PASS / branch** | validated hardening |
| Real Wan2GP server probe | **BLOCKED / external** | server/GPU required |
| Real video generation | **BLOCKED / external** | GPU/model runtime required |

## Model provenance and licensing

| Gate | Status | Evidence |
|---|---|---|
| Root code MIT | **PASS** | license preserved |
| Vibe Workflow MIT | **PASS** | verified |
| Open AI Design Agent MIT | **PASS** | verified |
| Agents Hub MIT intent | **CONDITIONAL** | README + package.json say MIT; standalone license file missing |
| Local asset bytes/SHA/revision | **PASS** | 8/8 assets |
| DreamShaper exact weight redistribution license | **BLOCKED / external** | exact source repo metadata remains ambiguous |
| Commercial/redistribution policy per weight | **OPEN** | conservative nulls retained |

## ORBI architecture

| Gate | Status |
|---|---|
| Provider/Compute Router design | **PASS design** |
| Provider secret-store design | **PASS design** |
| Android/Edge feasibility | **PASS design** |
| Android exact model weight budget | **PASS design** |
| Dual-history Git integration strategy | **PASS design** |
| Branding/distribution migration inventory | **PASS design** |
| Release gates | **PASS design** |

## Phase 0 interpretation

The upstream application is now demonstrated to be:

- reproducibly importable,
- installable,
- testable,
- web-runnable,
- desktop-packageable across Windows/Linux/macOS,
- desktop-launchable on Windows/Linux smoke environments,
- compatible with the selected Linux sd.cpp runtime binary.

It is **not yet a public-release-ready ORBI product**.

The remaining blockers are intentionally separated into:

1. dependency/security integration,
2. signing/notarization,
3. exact unresolved third-party licensing,
4. real local model generation,
5. real Wan2GP/GPU generation,
6. ORBI branding/integration.

No remaining blocker justifies modifying the immutable upstream baseline.
