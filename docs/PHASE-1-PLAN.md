# ORBI Creative Studio — Phase 1 Plan

Status: prepared after Phase 0 foundation hardening.

Phase 1 begins only from the certified `integration/orbi-foundation` lineage.

## Objective

Turn the hardened upstream application into an ORBI-owned architecture without losing the working image/video/studio capabilities already certified.

## Phase 1A — Provider credential boundary

### S1 — compatibility abstraction

Goal:

- Studio/client code no longer reads/writes `muapi_key` directly.

Status:

- implementation branch: `security/provider-credential-access-s1`
- PR #13
- preserves current behavior while introducing `providerCredentials` abstraction.

### S2 — complete compatibility boundary

Migrate remaining raw browser access in:

- `components/StandaloneShell.js`
- Agent client pages
- any root/hosted compatibility code

Acceptance:

- no production component accesses raw provider key storage directly,
- only the credential service/session adapter owns compatibility storage.

### S3 — Electron secure store

Introduce narrow preload/main-process APIs:

- get provider credential readiness,
- set/update credential,
- delete credential.

Requirements:

- renderer must not get arbitrary OS secret-store access,
- keychain/backend implementation hidden in main process,
- one-time migration from legacy browser storage,
- no plaintext fallback without explicit policy.

### S4 — hosted web session model

Separate hosted-web identity from provider credentials.

Provider API keys should not be used as browser-readable session cookies.

## Phase 1B — Compute Router foundation

Implement typed internal contracts before adding new providers.

Core objects:

- `GenerationJob`
- `ProviderCapability`
- `ProviderReadiness`
- `ExecutionCandidate`
- `RoutingDecision`
- `ExecutionResult`

First adapters:

1. current MuAPI,
2. local sd.cpp,
3. Wan2GP.

Routing inputs:

- media type,
- required model/capability,
- privacy requirement,
- cost policy,
- local/remote availability,
- hardware capability,
- provider readiness.

Do not make model UI depend directly on provider implementation details.

## Phase 1C — Local backend capability detection

The runtime provenance manifest answers which bytes are trusted.

This phase answers which backend the current node can actually run.

Desktop probe should determine:

- CPU architecture,
- OS,
- NVIDIA/CUDA availability,
- Vulkan availability,
- AMD/ROCm eligibility where feasible,
- RAM,
- GPU memory where available,
- selected/certified runtime variant.

Output should feed the Compute Router.

No silent hardware guessing from total RAM alone.

## Phase 1D — Model/runtime integrity

Extend the runtime integrity work to model weights.

Use the existing model provenance manifest to:

- pin revision-specific download URLs,
- validate exact byte size,
- validate SHA-256 after download,
- expose provenance in diagnostics,
- reject altered/incomplete model files.

DreamShaper remains excluded from ORBI redistribution until its exact license relationship is resolved.

## Phase 1E — Real-generation certification

### Desktop image

First target:

- Windows/Linux sd.cpp CPU using an SD 1.x-class model.

Record:

- model load,
- generation success,
- resolution,
- latency,
- peak RAM,
- output file,
- repeated-run stability.

Then test accelerated backends.

### Android / ORBI Edge

First visual experiment:

- small SD 1.x workload,
- not Z-Image/SDXL as initial target.

POCO node should first be treated as:

- orchestration node,
- LLM/speech node,
- capability-advertising Edge node.

### Video

Wan2GP remains the first serious video-runtime path.

Require a real trusted GPU server before advertising local/private video generation.

## Phase 1F — ORBI branding

Only after the foundation and provider/runtime seams are stable.

One dedicated branding batch should update coherently:

- product name,
- appId,
- executable,
- Windows install path,
- Linux package/command/AppArmor identity,
- icons,
- page metadata,
- i18n copy,
- updater/publisher endpoints.

Upstream attribution remains in legal/provenance notices even after product branding changes.

## Phase 1G — ORBI Edge protocol

Design the node protocol around measured capability.

Minimum node advertisement:

- node identity/trust state,
- OS/architecture,
- RAM,
- available backends,
- installed/certified models,
- privacy/network scope,
- active workload,
- health/readiness.

The Compute Router decides whether a job:

- runs on the local desktop,
- runs on an ORBI Edge node,
- runs on Wan2GP,
- falls back to a cloud provider,
- or is rejected because no eligible provider exists.

## Ordering rule

Do not start visual rebranding first.

Recommended order:

1. credential boundary,
2. Compute Router contracts,
3. local capability probe,
4. model/runtime integrity,
5. real-generation certification,
6. ORBI branding,
7. Edge expansion.

This order keeps the already-working upstream product usable while ORBI progressively takes ownership of its security, routing and execution architecture.
