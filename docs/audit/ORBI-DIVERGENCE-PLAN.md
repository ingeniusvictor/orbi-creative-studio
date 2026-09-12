# ORBI Creative Studio — Controlled Divergence Plan

Baseline source: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

This plan describes **where ORBI should diverge after Phase 0 certification**. It is not authorization to alter the baseline branch.

## Principle

Preserve upstream studio functionality first. Introduce ORBI behavior behind stable boundaries so future upstream changes can still be reviewed selectively.

## Stage 1 — Provider abstraction

Create a provider-neutral generation contract above MuAPI, sd.cpp and Wan2GP.

Initial adapters:

- `muapi`
- `sdcpp`
- `wan2gp`

Future adapters can include direct cloud APIs or ORBI Edge Mesh without rewriting every Studio.

Expected benefit: model/provider choice becomes infrastructure instead of UI-specific branching.

## Stage 2 — Compute Router

Introduce an ORBI routing layer that can choose execution based on:

- task/media type
- model requirement
- node capabilities
- online/offline status
- local preference
- memory estimate
- user budget
- privacy policy
- latency preference

Default ORBI policy:

1. prefer capable local execution;
2. then user-owned network/edge compute;
3. use paid cloud only when requested or required;
4. make expected cost/privacy boundary visible before paid or third-party execution.

## Stage 3 — Provider-neutral persistence

Replace provider-named application state such as `muapi_pending_jobs` and `muapi_uploads` with neutral schemas.

Persist enough information to resume jobs across providers without coupling the UI to one backend.

## Stage 4 — Secret storage

Move provider credentials out of generic browser-accessible storage where possible.

Target surfaces:

- OS keychain/credential store for desktop
- server-side secret storage for hosted mode
- node-local encrypted storage for edge workers

## Stage 5 — ORBI identity

Only after functional parity is established:

- ORBI branding/theme
- ORBI Creative Studio naming
- Spanish/English localization policy
- ORBI onboarding
- local/cloud status indicators
- explicit cost indicators

Do not perform mass string replacement before provider/runtime tests pass.

## Stage 6 — ORBI Edge Mesh bridge

Define a constrained worker protocol shared by desktop, Android and future GPU nodes.

A node should advertise capability, not receive arbitrary code.

Potential node classes:

- `cpu-general`
- `android-arm64`
- `desktop-vulkan`
- `nvidia-cuda`
- `amd-rocm`
- `wan2gp-server`

## Stage 7 — AI Director

Add an orchestration layer capable of turning a creative objective into a governed workflow:

```text
Objective
  -> plan/storyboard
  -> asset requirements
  -> provider/node selection
  -> cost/privacy preflight
  -> generation
  -> review/retry
  -> export
```

The AI Director should never bypass routing/cost/privacy policy.

## Stage 8 — ORBI Shorts workflow

A high-value first vertical workflow for ORBI:

```text
Topic
 -> exact narration
 -> 3 x 10 s storyboard
 -> 9:16 prompts
 -> reference consistency
 -> generate clips
 -> review/retry
 -> package publication assets
```

This can become a reusable workflow rather than hard-coded application behavior.

## Suggested branch sequence

After baseline import/certification:

1. `feature/provider-abstraction`
2. `feature/compute-router`
3. `feature/provider-neutral-storage`
4. `feature/secret-storage`
5. `feature/orbi-branding`
6. `feature/edge-worker-protocol`
7. `feature/ai-director`

Each stage should have tests and a rollback point.

## Explicit non-goals for initial ORBI release

- running heavy video models directly on Android
- replacing every commercial model with a local equivalent
- removing all cloud providers
- building a public multi-tenant billing system
- aggressively merging every upstream release

## Upstream sync policy

Keep upstream as a reviewable source, not an automatic dependency update stream.

For every future upstream update:

1. inspect commit range;
2. classify security/fix/features;
3. test against ORBI provider abstraction;
4. cherry-pick or merge intentionally;
5. record accepted/rejected changes.

## Success criterion

ORBI Creative Studio succeeds when the Studio can execute the same user intent across local, edge and paid-cloud backends **without the creative UI needing to know provider-specific implementation details**.