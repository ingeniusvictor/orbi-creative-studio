# P1C58 — Performance Aggregation & Backend Comparison Evidence

## Purpose

P1C58 converts isolated P1C57 duration observations into repeated-run performance evidence.

A single fast or slow run is not sufficient evidence for routing. P1C58 therefore requires several controlled observations in one exact benchmark context before it produces an aggregate.

## Aggregate rule

The default minimum is:

`3 runs per backend`

Every observation in one aggregate must share the exact:

- protocol version;
- model;
- resolution;
- harness version;
- source commit;
- runtime identity/version/hash;
- model artifact hash;
- auxiliary artifact hashes.

Run indexes must be unique.

## Statistics

Each backend aggregate records:

- run count;
- minimum duration;
- median duration;
- P90 duration;
- maximum duration;
- arithmetic mean.

Median is used for CPU↔CUDA comparison because it is less sensitive to one unusually slow run.

## CPU vs CUDA comparison

P1C58 compares one CPU aggregate with one CUDA12 aggregate only when their model/resolution/harness/source/model/auxiliary context is comparable.

Runtime hashes are intentionally backend-specific and remain inside each aggregate.

The comparison reports:

- CPU median;
- CUDA median;
- speedup versus CPU;
- percent duration reduction;
- faster measured backend.

Example:

`CPU median 1000 ms / CUDA median 200 ms = 5× speedup`

## Authority boundary

P1C58 remains benchmark evidence only.

Even when one backend is measurably faster:

- production profile promotion = false;
- routing eligibility = false;
- cutover authorization = false;
- execution authority remains `legacy-dispatcher-only`.

A later review phase may combine performance with resource usage and stability evidence before any routing recommendation is eligible.
