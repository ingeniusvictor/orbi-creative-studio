# ORBI ECC Profile v0.1 — Creative Studio Pilot

Status: PROPOSED / NON-AUTHORIZING  
Scope: ORBI Creative Studio only  
Base: `integration/orbi-foundation`  
Adoption model: curated ECC components, not full ECC installation

## Objective

Evaluate Everything Claude Code (ECC) as an engineering workflow layer for ORBI Creative Studio without changing runtime behavior, model routing, provider contracts, certification authority, Electron security boundaries, or generation behavior.

ECC is treated as an upstream engineering toolkit. ORBI remains authoritative for repository policy, release gates, security decisions, runtime certification, and canonical source state.

## Core principles

1. No blind/full ECC installation.
2. No ECC component may override ORBI repository rules or existing certification gates.
3. Skills are preferred over legacy command shims.
4. Hooks are opt-in and staged.
5. Memory/continuous-learning are not canonical truth.
6. External security runners must be reviewed and version-pinned before CI enforcement.
7. No auto-fix security mode during the pilot.
8. No agent receives broader write/shell/network authority merely because ECC supports it.

## DAILY agents

These are the default candidate agents for this repository:

- planner
- architect
- tdd-guide
- code-reviewer
- security-reviewer
- build-error-resolver
- e2e-runner
- refactor-cleaner
- doc-updater
- typescript-reviewer
- harness-optimizer
- loop-operator

Rationale: the repository is a JavaScript/TypeScript + Electron application with governed runtime/model work, extensive test gates, and repeated architecture/security review.

## DAILY skills

Candidate always-available workflow surface:

- agent-sort
- codebase-onboarding
- architecture-decision-records
- coding-standards
- tdd-workflow
- ai-regression-testing
- e2e-testing
- verification-loop
- browser-qa
- eval-harness
- context-budget
- delivery-gate
- git-workflow
- security-scan
- agent-harness-construction

## LIBRARY agents

Load only when repository evidence requires them:

- react-reviewer
- react-build-resolver
- performance-optimizer
- cpp-reviewer
- cpp-build-resolver
- python-reviewer
- mle-reviewer
- rag-pipeline-reviewer

Examples:
- C/C++ reviewers are relevant when touching sd.cpp/native inference boundaries.
- ML reviewers are relevant for benchmark/eval/serving behavior, not routine UI work.
- React-specific reviewers are relevant for renderer/UI changes.

## LIBRARY skills / Stage-2 candidates

Do not activate by default during v0.1:

- continuous-learning-v2
- continuous-agent-loop
- unified-memory
- strategic-compact
- cost-aware-llm-pipeline
- deep-research
- design-system
- content-engine

These can be promoted only after the pilot proves that base agent selection, context usage, hooks, and security boundaries remain predictable.

## ORBI authority boundary

ECC MUST NOT independently:

- mutate the governed runtime certification source;
- approve or apply a P1C runtime certification;
- alter Compute Router authority;
- bypass source-review / dry-run / approval / provenance gates;
- change provider secret handling;
- enable a runtime/model target;
- change cutover authority;
- replace an ORBI canonical document;
- merge a PR;
- auto-apply security fixes during the pilot.

## Security adoption rule

AgentShield/security-scan begins in report-only mode.

Before adding a GitHub Actions enforcement step, ORBI must record:

- selected AgentShield release/version;
- reviewed upstream source/release;
- integrity/pinning strategy;
- exact scan scope;
- expected false-positive handling;
- explicit decision on fail threshold.

Unversioned one-shot execution must not become an ORBI enforced gate.

## Pilot success criteria

The pilot is successful only if it demonstrates all of the following:

1. Agent/skill selection reduces manual orchestration without creating conflicting authority.
2. Existing repository tests/build/lint remain unchanged and GREEN.
3. No runtime behavior changes are introduced by ECC adoption.
4. No new secret exposure or broad shell/network permission is introduced.
5. Context overhead is measurable and acceptable.
6. ECC recommendations respect the ORBI P1C governance model.
7. ECC components can be removed without affecting product runtime.

## Promotion path

`PROPOSED -> REPORT_ONLY -> ASSISTED -> SELECTIVE_ENFORCEMENT`

There is intentionally no direct path from PROPOSED to full ECC installation.

## Current pilot state

- Profile definition: READY FOR REVIEW
- ECC package/plugin installation: NOT STARTED
- Hooks: DISABLED
- Continuous learning: DISABLED
- Unified memory: DISABLED
- AgentShield enforced CI: DISABLED
- Runtime/product changes: NONE
