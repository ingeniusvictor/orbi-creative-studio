# INFRA-05 — Retire merged phase PR triggers

## Problem

Phase-specific workflows P1B.3 through P1B.12 remained configured with `pull_request` triggers after their phases were merged into `integration/orbi-foundation`.

This causes two problems on every later PR:

1. CI fan-out grows with every merged phase.
2. Historical static gates may become intentionally obsolete. Example: P1B.5 required Studio components to remain unwired, while P1B.8 later added the certified fail-soft shadow observer wiring. Re-running the P1B.5 static gate against P1B.13 therefore produces a false failure.

## Change

Remove `pull_request` triggers from the merged phase workflows P1B.3 through P1B.12.

Each historical workflow retains:

- its phase branch `push` trigger;
- `workflow_dispatch` for explicit manual revalidation.

## Canonical PR validation

PRs targeting `integration/orbi-foundation` are validated by the single `ORBI Pull Request integrated gate`, which executes:

- exact dependency install;
- Electron syntax checks;
- lint;
- all root tests, including the merged phase tests;
- workspace builds;
- Next build;
- Electron renderer build;
- production dependency audit.

## Policy for P1B.13 and later

New phase-specific workflows must use:

- `push` on the phase branch;
- `workflow_dispatch` for manual reruns.

They must **not** add a broad `pull_request -> integration/orbi-foundation` trigger.

This provides two independent signals without historical fan-out:

1. phase-specific push workflow validates the phase's static safety gates and targeted tests;
2. the integrated PR gate validates the complete repository before merge.

## Safety

This phase changes CI triggers only.

It does not change:

- production JavaScript;
- Studio routing;
- providers;
- credential handling;
- parity evidence;
- execution authority;
- cutover state.

Current authority remains:

- `executionAuthority: legacy-dispatcher-only`;
- `cutoverAuthorized: false`.

## Merge gate

Require the integrated PR gate to execute successfully before merging INFRA-05.