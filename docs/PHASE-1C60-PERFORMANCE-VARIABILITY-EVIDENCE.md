# P1C60 — Performance Variability Evidence

## Purpose

P1C60 adds consistency evidence beside P1C58 speed evidence.

A backend can have an attractive median and still exhibit wide run-to-run variation. P1C60 therefore derives relative dispersion from the already-governed P1C58 aggregate.

## Metrics

For each backend P1C60 records:

- min / median / P90 / max duration;
- absolute range;
- range as a percentage of the median;
- P90 divided by median;
- max divided by median;
- mean-to-median delta percentage.

## No hidden stability policy

P1C60 deliberately does **not** label a backend stable or unstable.

It records:

`stabilityThresholdApplied: false`

This avoids inventing a universal threshold before real ORBI hardware evidence exists.

## Comparison

CPU and CUDA12 variability may be compared for the same model/resolution.

The comparison reports descriptively:

- backend with lower relative range;
- backend with lower P90 tail relative to its median.

These are measurements, not routing decisions.

## Authority boundary

P1C60 remains:

- descriptive-only;
- benchmark-only;
- requires human interpretation;
- production-profile promoted = false;
- routing eligible = false;
- cutover authorized = false;
- execution authority = `legacy-dispatcher-only`.
