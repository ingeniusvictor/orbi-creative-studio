# P1C20 — Controlled Benchmark Sample Bridge

## Purpose

P1C20 introduces the first explicit Electron capability able to execute one bounded P1C6 controlled benchmark sample and return P1C7 review evidence.

This is **not** a generation route, production profile promotion, automatic benchmark session, or certification action.

## Trust boundary

The renderer may provide only:

- `modelId`;
- `backend` (`cpu` or `cuda12`);
- exact target `width`;
- exact target `height`;
- `runIndex` from 1 to 3.

The renderer cannot provide:

- executable paths;
- model paths;
- auxiliary paths;
- output directories;
- shell commands;
- runtime identity/version;
- build/source commit;
- hashes.

All filesystem paths and execution identity are resolved in the trusted Electron main process.

## Execution chain

`orbiBenchmark.runSample(request)`

1. invokes the dedicated `compute-router:controlled-benchmark-sample` IPC channel;
2. authenticates the sender with the existing trusted-sender guard;
3. resolves local runtime/model state internally;
4. requires pinned runtime context and verified installed runtime integrity;
5. requires the exact downloaded target model and required auxiliary assets;
6. binds the sample to the packaged build identity source commit;
7. invokes the existing P1C6 `runLocalBenchmark()` harness;
8. hashes required auxiliary artifacts;
9. returns one P1C7 `p1c7-benchmark-run-evidence` envelope.

The response contains evidence hashes but never local filesystem paths.

## Bounded execution

- one sample per invocation;
- run index is limited to 1–3;
- only one benchmark may be active at a time;
- the existing P1C6 harness keeps its bounded timeout and no-shell execution;
- output images remain disposable and are removed by P1C6;
- arbitrary exception text is not returned to the renderer.

## Authority boundary

Every success and rejection keeps:

- `benchmarkOnly: true`;
- `productionProfilePromoted: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

P1C20 does not add or modify a runtime certified profile.

## UI boundary

P1C20 intentionally adds **no UI action**.

Router Diagnostics, Settings, Image Studio and Video Studio do not import or invoke the benchmark capability. A later phase may add an explicit user-initiated benchmark review workflow.

## Certification boundary

One successful P1C20 result is only one P1C7 run envelope.

A reviewable P1C7 benchmark session still requires at least three exact-context runs. P1C8 still requires a separate explicit human certification decision. No phase automatically converts benchmark evidence into a runtime certified profile.
