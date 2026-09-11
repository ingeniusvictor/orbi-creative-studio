# ORBI Creative Studio — Compute Router Design Draft

Status: **architecture draft only — no implementation in Phase 0**

Related issue: #4

## Goal

Decouple creative intent from any specific model provider.

The UI should request a capability. The router should choose an execution target that satisfies policy and readiness constraints.

Current upstream providers:

- MuAPI cloud
- sd.cpp same-machine inference
- Wan2GP network inference

Future ORBI targets:

- desktop local inference
- dedicated LAN GPU node
- ORBI Edge Mesh PC nodes
- Android/Termux edge nodes
- optional third-party cloud providers

## Core rule

UI components must not decide where inference runs.

Bad:

```
ImageStudio -> if local use sd.cpp else call MuAPI
```

Target:

```
ImageStudio
   -> GenerationRequest
      -> CapabilityRegistry
         -> ComputeRouter
            -> ProviderAdapter
```

## GenerationRequest

Conceptual shape:

```ts
type GenerationRequest = {
  capability: "t2i" | "i2i" | "t2v" | "i2v" | "v2v" | "lipsync" | "audio";
  modelPreference?: string;
  prompt?: string;
  inputs?: MediaInput[];
  output: {
    aspectRatio?: string;
    resolution?: string;
    durationSeconds?: number;
  };
  policy: {
    privacy: "device-only" | "trusted-lan" | "cloud-ok";
    cost: "free-only" | "prefer-free" | "metered-ok";
    latency: "interactive" | "batch";
    allowFallback: boolean;
  };
};
```

## Provider descriptor

```ts
type ProviderDescriptor = {
  id: string;
  execution: "device" | "lan" | "edge" | "cloud";
  trustBoundary: "same-device" | "trusted-network" | "third-party";
  metering: "local-compute" | "credits" | "subscription" | "unknown";
  capabilities: CapabilityDescriptor[];
  health: ProviderHealth;
};
```

## Capability descriptor

A model entry should describe facts rather than UI assumptions:

```ts
type CapabilityDescriptor = {
  modelId: string;
  operations: string[];
  inputTypes: string[];
  outputTypes: string[];
  aspectRatios?: string[];
  resolutions?: string[];
  durationRange?: [number, number];
  hardware?: {
    minRamGB?: number;
    minVramGB?: number;
    backends?: string[];
  };
  provenance?: {
    source?: string;
    revision?: string;
    license?: string;
    sha256?: string;
  };
};
```

## Health model

Every executable provider/node should expose a probe.

Suggested states:

- `unknown`
- `probing`
- `ready`
- `degraded`
- `busy`
- `offline`
- `misconfigured`
- `unsupported`

A healthy catalog entry is not the same thing as a healthy runtime.

## Routing filters

Apply hard constraints before scoring:

1. capability supported
2. required model available
3. runtime healthy
4. privacy policy satisfied
5. cost policy satisfied
6. input/output parameters supported
7. sufficient hardware/storage state
8. provider credentials available if required

If no candidate survives, return a structured explanation. Do not silently send a private job to cloud.

## Routing preferences

After filtering, score surviving candidates.

Example priorities:

### Free-first

1. same-device free
2. trusted-LAN free
3. ORBI Edge free
4. metered cloud

### Privacy-first

1. same-device
2. explicitly trusted LAN
3. no cloud unless user changes policy

### Speed-first

Use measured rolling latency and queue depth instead of a hard-coded provider order.

## Cost model

Do not use only labels such as "free".

Store an estimate:

```ts
type CostEstimate = {
  currency?: "USD";
  amount?: number;
  credits?: number;
  confidence: "exact" | "estimated" | "unknown";
  source: "provider" | "local-policy" | "unknown";
};
```

Local compute can report monetary API cost as zero while still recording compute/energy metadata separately.

## ORBI Edge node contract

An edge node should advertise capabilities:

```json
{
  "node_id": "edge-node-id",
  "protocol_version": "1",
  "platform": "android-termux",
  "health": "ready",
  "resources": {
    "ram_total_mb": 12288,
    "ram_available_mb": 6400
  },
  "engines": [
    {
      "id": "local-engine",
      "capabilities": ["t2i-lite"]
    }
  ]
}
```

No assumption should be made that every node can execute every model.

## Job lifecycle

Normalize all providers into one job model:

```
QUEUED
 -> PREPARING
 -> RUNNING
 -> SUCCEEDED

or

 -> FAILED
 -> CANCELLED
 -> TIMED_OUT
```

Cloud polling, local child processes, and Wan2GP SSE should all adapt to this lifecycle.

## Provider adapters

Initial adapters after Phase 0:

- `SdCppProviderAdapter`
- `Wan2GpProviderAdapter`
- `MuApiProviderAdapter`

Later:

- `OrbiEdgeProviderAdapter`
- additional cloud provider adapters only when justified

Adapters own provider-specific request/response translation.

They do not own routing policy.

## Secret boundary

Provider adapters request secrets through a secret store interface.

They must not read arbitrary `localStorage` keys directly.

Conceptual:

```ts
interface SecretStore {
  get(providerId: string, key: string): Promise<string | null>;
}
```

Desktop and web deployments can use different secret-store implementations.

## Observability

Record for every generation:

- request ID
- selected provider
- selected model
- routing reason
- fallback events
- start/end timestamps
- queue time
- generation time
- estimated/actual cost where known
- node/runtime health snapshot
- failure category

Do not log prompts or user media by default in privacy-sensitive modes.

## Failure policy

Fallback must be explicit.

Example:

```
local model OOM
   |
allowFallback?
   +-- no --> return local failure
   |
   +-- yes
        |
privacy allows cloud?
   +-- no --> try another trusted local node
   +-- yes --> evaluate cloud candidates
```

Never turn a local-only request into a cloud request merely to make the job succeed.

## Relationship to current upstream

The existing code already gives us useful seams:

- `localInferenceClient.js` centralizes local calls
- local models have provider labels
- Wan2GP already has health/probe logic
- MuAPI already centralizes much of its API client logic
- pending jobs already demonstrate async lifecycle persistence

The ORBI work should consolidate these seams rather than rewrite every Studio component at once.

## Recommended implementation sequence after Phase 0

1. Define typed provider/capability contracts.
2. Wrap current behavior with adapters without changing output.
3. Add parity tests comparing old vs adapter paths.
4. Move UI provider decisions into router.
5. Introduce secret-store boundary.
6. Add trusted-node registry.
7. Add ORBI Edge protocol.
8. Add Android/Termux node only after capability probes exist.
9. Add cost-aware cloud routing last.

## Non-goals for first implementation

- no automatic arbitrary model downloading
- no distributed tensor/model execution across phones
- no promise that Android can generate modern HD video
- no hidden provider fallback
- no removal of working upstream providers until parity is demonstrated

## Success criterion

A user should be able to request an operation such as:

"Generate a 9:16 image locally if possible; otherwise tell me the cheapest available option."

The UI should not need to know whether the result comes from sd.cpp, a trusted ORBI node, Wan2GP, or an authorized cloud provider.
