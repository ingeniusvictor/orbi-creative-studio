# P3 — ECC Agent Sort Audit for ORBI Creative Studio

Status: EVIDENCE-BACKED / CLASSIFICATION-ONLY  
ORBI snapshot: `8cb8f9357f06731c60cc051fdb9bdd14615cd120`  
ECC reference: `2.2.2 @ 91ba9b4cf6c47c8130829004f8bb64762a76ccbb`

This audit applies the ECC `agent-sort` methodology to the real ORBI Creative Studio repository. It does not claim that the ECC runtime itself executed this classification.

## STACK

Repository evidence at the audited snapshot:

- 513 tracked files.
- 210 `.js`, 51 `.mjs`, 23 `.jsx`.
- 0 `.ts` and 0 `.tsx`.
- 75 files under `tests/`.
- 70 GitHub Actions workflows.
- 75 files under `docs/`.
- 26 files under `electron/`.
- 78 files under `src/`.
- 26 files under `app/`.
- 105 files under `packages/`.

Primary stack from repository manifests/configuration:

- Node/npm.
- Next.js 15 + React 19.
- Vite 5 renderer build.
- Electron 33 desktop runtime.
- ESLint 9.
- JavaScript/ES modules rather than TypeScript.
- Docker/Docker Compose surfaces.
- npm workspaces plus three Git submodules.
- local/remote generative-model integration.
- governed Compute Router, benchmark, evidence and runtime-certification layers.

## DAILY agents

These are justified as broad recurring surfaces rather than feature-specific specialists.

| Agent | Evidence | Decision |
|---|---|---|
| `planner` | phased P1B/P1C development and 70 CI workflows | DAILY |
| `architect` | Electron + Next + Vite + provider + Compute Router boundaries | DAILY |
| `code-reviewer` | large multi-surface JS codebase and gated PR workflow | DAILY |
| `security-reviewer` | Electron IPC, provider credentials, local inference, upstream intake | DAILY |
| `tdd-guide` | 75 focused test files and test-first certification phases | DAILY |
| `doc-updater` | 75 docs files plus evidence/governance documentation | DAILY |
| `typescript-reviewer` | ECC defines it for **TypeScript/JavaScript** and requires it for JS/TS changes; this repo has 284 JS/MJS/JSX files | DAILY |

## LIBRARY agents

Useful, but only for matching tasks.

| Agent | Evidence / trigger | Decision |
|---|---|---|
| `build-error-resolver` | invoke only when a build gate fails | LIBRARY |
| `e2e-runner` | UI/desktop end-to-end changes | LIBRARY |
| `react-reviewer` | 23 JSX files + React 19 UI | LIBRARY |
| `react-build-resolver` | React-specific build failures | LIBRARY |
| `performance-optimizer` | benchmark/runtime performance work | LIBRARY |
| `refactor-cleaner` | explicit cleanup/refactor phases | LIBRARY |
| `silent-failure-hunter` | async/provider/fail-closed investigations | LIBRARY |
| `harness-optimizer` | only after agent harness adoption | LIBRARY |
| `loop-operator` | only for explicitly bounded autonomous loops | LIBRARY |

## EXCLUDED / OFF-STACK agents

These should not be loaded into the current project profile:

- `cpp-reviewer`, `cpp-build-resolver`: native model engines are external/bundled boundaries; no C++ source is owned in this repo.
- `python-reviewer`: no Python application source in the audited tree.
- `mle-reviewer`, `rag-pipeline-reviewer`: useful elsewhere in ORBI, but not recurring Creative Studio code surfaces today.

The zero-TS observation does **not** exclude `typescript-reviewer`: ECC 2.2.2 explicitly defines that agent for TypeScript **and JavaScript** and marks it mandatory for JavaScript/TypeScript projects. P3 therefore retains it in DAILY. React-specific review stays LIBRARY and is invoked when JSX/React scope is present.

## DAILY skills

| Skill | Repository evidence |
|---|---|
| `architecture-decision-records` | governed architecture and explicit authority boundaries |
| `coding-standards` | 284 JS/MJS/JSX files across several runtimes |
| `context-budget` | 513-file monorepo-like surface + submodules |
| `delivery-gate` | 70 workflows and integrated PR certification |
| `git-workflow` | feature branches, PRs, canonical integration branch |
| `security-review` | credentials, Electron, local runtime, upstream intake |
| `tdd-workflow` | 75 focused test files |
| `verification-loop` | existing plan -> test -> build -> evidence -> merge discipline |

## LIBRARY skills

Load only for relevant tasks:

- agent-sort
- codebase-onboarding
- security-scan
- browser-qa
- e2e-testing
- ai-regression-testing
- eval-harness
- agent-harness-construction
- contract-first
- error-handling
- frontend-patterns
- react-patterns
- react-testing
- react-performance
- vite-patterns
- nextjs-turbopack
- docker-patterns
- deployment-patterns
- benchmark
- benchmark-methodology
- benchmark-optimization-loop

Important change: `agent-sort` and `codebase-onboarding` are not DAILY after their audit job is complete. Keeping one-time setup skills always loaded would defeat the context-trimming objective.

## DEFERRED / STAGE 2

These remain intentionally disabled:

- continuous-learning-v2
- continuous-agent-loop
- unified-memory
- strategic-compact
- cost-aware-llm-pipeline
- deep-research
- design-system
- content-engine

Continuous learning and memory are deferred until ORBI has a stable harness instruction surface. Neither may become canonical authority.

## INSTALL PLAN

P3 itself performs no ECC installation.

Next controlled step:

1. create one concise ORBI-owned root `AGENTS.md` for Codex-compatible project instructions;
2. keep authority, test and security requirements in that file;
3. rerun AgentShield so a real harness adapter is exercised;
4. do not create hooks or MCP configuration in the same change;
5. only after that, evaluate selective skill materialization.

This preserves one-variable-at-a-time diagnosis.

## VERIFICATION

P3 passes when:

- manifest classifications match this document;
- `typescript-reviewer` is retained for its documented JavaScript scope, not because TypeScript exists in the repo;
- hooks remain disabled;
- continuous learning and unified memory remain disabled;
- no product/runtime source is modified;
- Integrated PR Gate remains GREEN;
- AgentShield remains report-only.

## Result

The useful ECC surface is substantially smaller than the first manual v0.1 profile. This is expected and is the primary outcome of `agent-sort`: reduce always-loaded context while retaining specialized tools as searchable library components.

## Canonical refresh note

P3 was initially drafted against the prior canonical state. During validation, P1C35 advanced `integration/orbi-foundation`. The evidence inventory was refreshed against `8cb8f9357f06731c60cc051fdb9bdd14615cd120`; the stack classification did not change.
