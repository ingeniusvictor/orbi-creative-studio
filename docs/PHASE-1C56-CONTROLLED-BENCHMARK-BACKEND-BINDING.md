# P1C56 — Controlled Benchmark Backend Binding

## Purpose

P1C56 makes the controlled benchmark measure the backend it claims to measure.

Before this phase, benchmark requests were labelled `cpu` or `cuda12`, but the benchmark harness did not pass an explicit `--backend` argument to the pinned sd.cpp runtime. A CUDA-labelled benchmark could therefore depend on sd.cpp automatic placement rather than being cryptographically/contextually tied to the activated backend.

The benchmark harness also still carried CLI flags removed from the pinned runtime.

## Changes

### Verified backend activation is required

The Electron benchmark resolver now requires:

- pinned runtime manifest match;
- installation integrity verified;
- P1C54 backend activation verified;
- exact selected device name returned by `sd-cli --list-devices`.

If activation evidence is absent, the sample is rejected as:

`BENCHMARK_BACKEND_ACTIVATION_UNVERIFIED`

### Exact device binding

The resolved internal benchmark plan includes a trusted main-process-only:

`backendDeviceName`

For example:

`CUDA0`

The renderer cannot inject this field because benchmark requests retain the exact P1C20 request shape.

The harness validates the device name against the declared backend family and runs:

`sd-cli ... --backend CUDA0`

A mismatched device fails with:

`BENCHMARK_BACKEND_DEVICE_INVALID`

### Current pinned CLI contract

The benchmark harness no longer emits:

- `--sd-version`
- `--flux`

matching the P1C51 production inference fix and the pinned stable-diffusion.cpp CLI.

### Harness identity

The harness version advances from:

`orbi-local-benchmark-harness-0.1.0`

to:

`orbi-local-benchmark-harness-0.2.0`

Existing benchmark evidence remains structurally valid, but the existing same-context rules prevent 0.1.0 and 0.2.0 samples from being combined into one certification candidate.

## Authority boundary

P1C56 still produces benchmark-only evidence.

It does not:

- promote a resource profile;
- grant routing eligibility;
- authorize cutover;
- change the production dispatcher;
- expose internal device names in exported run evidence.
