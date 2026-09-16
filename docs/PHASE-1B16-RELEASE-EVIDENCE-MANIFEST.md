# ORBI Creative Studio — Phase 1B.16 Release Evidence Manifest

Status: stacked on P1B.15. Evidence contract only. No cutover authority.

## Purpose

Formalize the release evidence required by the P1B.14 release gates and bind every item to one exact Git commit SHA.

The manifest module lives at:

`src/lib/computeRouter/releaseEvidenceManifest.mjs`

## Exact commit binding

A manifest requires a 40-character Git commit SHA.

Every evidence item must reference the same SHA:

- CI result;
- Linux platform result;
- macOS platform result;
- Windows platform result;
- security review;
- rollback plan.

Evidence for another commit fails closed even when its status says passed/approved.

## Required evidence

### CI

Requires:

- matching source commit;
- status `passed`;
- non-empty run ID;
- valid completion timestamp.

### Platform matrix

Requires independent matching evidence for:

- `linux`;
- `macos`;
- `windows`.

Every platform must be passed. Missing/unavailable/failed evidence makes `platformMatrixGreen` false.

### Security review

Requires:

- matching source commit;
- `approved: true`;
- non-empty review ID;
- valid review timestamp.

### Rollback plan

Requires:

- matching source commit;
- `approved: true`;
- non-empty plan ID;
- valid review timestamp.

## Timestamp safety

Evidence timestamps must be positive and cannot be more than 60 seconds in the future relative to manifest generation time.

This prevents obviously future-dated evidence from creating a green gate.

## Derived release gates

The manifest derives exactly the four P1B.14 gates:

- `ciGreen`;
- `platformMatrixGreen`;
- `securityReviewApproved`;
- `rollbackPlanApproved`.

`extractReleaseGates()` recomputes those booleans from normalized evidence rather than trusting stored `releaseGates` values.

Changing the four gate booleans manually therefore cannot turn failed evidence green.

## Manifest status

The manifest exposes:

- `RELEASE_EVIDENCE_COMPLETE`;
- `RELEASE_EVIDENCE_INCOMPLETE`.

A complete manifest requires all four derived gates true and zero evidence issues.

## Authority boundary

Every valid manifest preserves:

- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

`extractReleaseGates()` rejects manifests that claim cutover authority or non-legacy execution authority.

## Evidence issues

The manifest reports fail-closed issues such as:

- commit mismatch;
- failed/unavailable status;
- missing proof ID;
- invalid timestamp;
- missing approval.

## Current repository state

The current GitHub Actions runs still fail before executing workflow steps and expose no logs.

Therefore there is currently no truthful evidence that can satisfy `ciGreen` for this stack.

## Scope boundary

P1B.16 does not:

- query GitHub;
- query CI providers;
- approve security review;
- approve rollback plans;
- execute providers;
- alter Studio routing;
- persist release approval;
- authorize cutover.

It defines how independently obtained release evidence must be represented and validated.

## Merge gate

Keep stacked until P1B.3–P1B.15 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.