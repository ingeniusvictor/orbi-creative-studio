# ORBI Creative Studio — Phase 1B.11 Parity Diagnostic Evidence Report

Status: stacked on P1B.10. Read-only diagnostics. No persistence, no control surface, no cutover.

## Purpose

Turn the current in-memory parity evidence into a human-readable diagnostic report that explains:

- what routes were observed;
- how many samples were collected;
- which models were covered;
- how many observations were `match`, `blocked`, or `mismatch`;
- which certification targets are satisfied;
- why a target is not certified;
- when the first and latest evidence for each route was observed.

The report is derived from P1B.10 session evidence and P1B.9 certification results.

## Diagnostic module

`src/lib/computeRouter/parityDiagnostics.mjs` provides:

- `buildParityDiagnosticReport()`
- `formatParityDiagnosticText()`
- `summarizeEvidenceByRoute()`
- `diagnosticStatus()`

The module is pure and has no renderer, network, storage, or provider-execution dependencies.

## Session integration

P1B.10 now exposes module-internal helpers:

- `buildStudioParityDiagnosticReport(targets, options)`
- `formatStudioParityDiagnosticReport(targets, options)`

These helpers:

1. read the in-memory P1B.10 ledger;
2. evaluate the requested P1B.9 targets;
3. build the diagnostic report;
4. optionally format it as readable text.

No evidence is written to disk or browser storage.

## Target statuses

A requested route is reported as one of:

- `certified`
- `mismatch`
- `blocked`
- `insufficient-samples`
- `insufficient-model-coverage`
- `not-certified`

Mismatch and blocked evidence take precedence over simple coverage gaps so the report surfaces the most important safety issue first.

## Observed routes vs certification targets

The report contains two separate views:

### Certification targets

Only the explicitly requested P1B.9 targets can contribute to the certification result.

### Observed routes

Every route present in current session evidence is still shown, including routes that were not requested as certification targets.

This prevents diagnostic evidence from disappearing merely because a route was omitted from a target set.

Untargeted routes do not silently expand certification scope.

## Report totals

The diagnostic report includes:

- observed route count;
- total samples;
- total matches;
- total blocked observations;
- total mismatches;
- target count;
- certification reason.

These totals cover all observed session evidence, not only requested targets.

## Evidence windows

For each observed route the report records:

- first observation timestamp;
- last observation timestamp;
- latest parity state.

For targeted routes the same evidence window is attached when observations exist.

## Privacy

The report is generated from already-normalized P1B.9 evidence and therefore contains only routing diagnostics:

- route key;
- provider IDs;
- operation;
- model IDs;
- parity counts/state;
- timestamps;
- certification thresholds/reasons.

It does not contain:

- prompts;
- uploaded media;
- API keys;
- MuAPI bodies or balance;
- filesystem paths;
- Wan2GP LAN URL;
- generation payloads.

## Text format

The text formatter produces a deterministic local diagnostic view headed by:

`ORBI Compute Router — Parity Diagnostic Report`

It is suitable for a future diagnostics panel or explicit user-requested export, but P1B.11 itself does not create files or expose a UI.

## Scope boundary

P1B.11 does **not**:

- write files;
- use `localStorage`, `sessionStorage`, or IndexedDB;
- send telemetry;
- attach a global diagnostics API;
- change ImageStudio;
- change VideoStudio;
- select providers;
- authorize cutover;
- execute generation.

A future phase may add a read-only diagnostics surface after this report format is certified.

## Merge gate

Keep stacked until P1B.3–P1B.10 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no steps/logs.
