# P1C21 — User Benchmark Session

## Purpose

P1C21 turns the P1C20 one-sample benchmark capability into an explicit, user-controlled evidence collection workflow inside Router Diagnostics.

The phase collects benchmark evidence only. It does not create a resource certification, promote a production profile, change routing, or authorize cutover.

## One click, one sample

The benchmark control is deliberately bounded:

- one user click launches at most one P1C20 sample;
- each exact target can collect at most three samples;
- the fourth invocation is a no-op that reports the session as ready for review;
- no loop, timer, polling cycle, or automatic multi-run sequence exists;
- only one benchmark capture may be active at a time.

This keeps CPU/GPU consumption under explicit user control.

## Exact-context sessions

Sessions are keyed by:

- model id;
- backend;
- width;
- height.

Evidence for different targets is stored separately in memory.

Before a second or third sample is accepted, P1C21 requires the same:

- protocol version;
- harness version;
- source commit;
- runtime identity/version;
- runtime binary hash;
- model artifact hash;
- required auxiliary artifact roles/hashes.

Measured RAM/VRAM may differ across runs and are intentionally not required to be identical.

If execution context drifts, the new sample is rejected and previously accepted evidence remains unchanged.

## In-memory only

The renderer session collector uses only the P1C20 `window.orbiBenchmark` capability.

It does not use:

- filesystem APIs;
- direct Electron IPC;
- network fetch;
- localStorage/sessionStorage/IndexedDB;
- timers;
- background jobs.

The full run evidence remains in memory for a later explicit review phase. Router Diagnostics receives only sanitized session state:

- exact target;
- sample count;
- required sample count;
- ready-for-review boolean;
- non-authorizing boundaries.

Hashes, paths, raw benchmark evidence and arbitrary errors are not rendered.

## Router Diagnostics

P1C21 reuses the P1C17 target selector and adds one action:

**Run benchmark sample**

Router Diagnostics now has exactly:

- generic diagnostics refresh;
- local compatibility refresh;
- benchmark sample capture;
- one existing target selector.

When multiple local targets exist, the user must select one before benchmarking.

The button is disabled while a sample is running and once 3/3 samples have been captured.

## Review boundary

At 3/3 samples, the session status becomes:

`USER_BENCHMARK_SESSION_READY_FOR_REVIEW`

This means only that evidence collection is complete.

P1C21 does **not** call `buildBenchmarkSessionEvidence()`, because that later review step requires an explicit safety-margin declaration and review timestamp. P1C21 also does not invoke P1C8 human certification.

## Authority boundary

All state preserves:

- `benchmarkOnly: true`;
- `productionProfilePromoted: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

A future phase may transform the three frozen run envelopes into a review-only P1C7 session candidate, but only through another explicit user action.
