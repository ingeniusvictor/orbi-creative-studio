# ORBI Creative Studio — P1B Final Certification and Freeze

Status: **P1B FUNCTIONAL BASELINE FROZEN**

Freeze date: 2026-09-16

## Certified functional baseline

- Canonical branch: `integration/orbi-foundation`
- P1B functional baseline commit: `16c26781e2c899a055439e651dc2fafd6c6004fb`
- Final merged phase: P1B.25 / PR #67
- Final phase PR head validated by:
  - `ORBI Evidence integrity report P1B25 validation` — GREEN
  - `ORBI Pull Request integrated gate` — GREEN

The squash merge commit itself did not receive a new pull-request workflow run. This freeze therefore records the validated PR head and the resulting canonical merge commit separately rather than claiming a post-merge platform run that did not occur.

## Phase scope closed

P1B now contains the complete controlled Compute Router readiness chain:

1. Compute Router contracts
2. Provider adapters
3. Provider readiness
4. Electron readiness snapshot
5. Studio router shadow
6. MuAPI readiness health
7. Async readiness probes
8. Studio shadow observer
9. Router parity certification
10. Router parity session
11. Router parity diagnostics
12. Studio parity target profile
13. Router diagnostics panel
14. Cutover eligibility
15. Cutover review report
16. Release evidence manifest
17. Parity build binding
18. Cutover review bundle
19. Build identity injection
20. Session build binding
21. Build-bound diagnostics
22. Evidence export
23. Evidence export validator
24. Evidence fingerprint
25. Evidence integrity report

There is no P1B.26 in the frozen roadmap.

## Execution boundary at freeze

P1B readiness and evidence do **not** transfer generation authority.

Required invariants remain:

- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`
- evidence integrity is not signer authenticity or provenance
- Router evidence must not trigger generation, provider execution, storage mutation, IPC, download, or network side effects

Any future change that transfers execution authority requires a separately reviewed controlled-cutover phase.

## CI hygiene follow-up in this freeze PR

Historical P1B.14–P1B.17 workflows were added after INFRA-02 and still contained broad pull-request triggers targeting the canonical branch.

This maintenance change removes those PR triggers while retaining:

- their original phase-branch push trigger
- `workflow_dispatch`
- all original validation jobs and safety gates

Normal PR validation remains centralized in:

- `.github/workflows/orbi-pr-integrated-gate.yml`

A regression test protects this rule.

## Runtime impact

This freeze maintenance changes CI configuration, tests, and documentation only.

It does not change:

- Compute Router runtime logic
- providers
- Image Studio or Video Studio execution
- Electron IPC
- build identity behavior
- credentials
- generation paths
- cutover authorization

## Next architectural block

The next existing phase is P1C — Desktop Hardware Capability Probe.

P1C remains observation-only. Its follow-up should expose a sanitized capability snapshot to the readiness layer and then add runtime/model provenance and compatibility without changing execution authority.
