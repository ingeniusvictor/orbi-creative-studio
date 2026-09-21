# P9 — ORBI ECC Pilot Certification

Status: SELECTIVE ADOPTION READY  
Pilot repository: `ingeniusvictor/orbi-creative-studio`  
Canonical branch: `integration/orbi-foundation`

## Purpose

Close the Creative Studio ECC pilot with an evidence-backed decision on what ORBI should reuse elsewhere.

The result is **not** "install ECC everywhere".

The result is a small ORBI-owned engineering layer inspired by ECC and validated against a real repository.

## Upstream references

- ECC: `2.2.2 @ 91ba9b4cf6c47c8130829004f8bb64762a76ccbb`
- AgentShield: `1.6.0 @ b0891303bdcd6037376a94263d45cfd2ff3dfb98`

## Pilot history

| Phase | PR | Result |
|---|---:|---|
| P1 | #103 | curated ECC profile, documentation-only baseline |
| P2 | #105 | pinned AgentShield report-only baseline |
| P3 | #106 | evidence-backed DAILY/LIBRARY agent-sort |
| P4 | #109 | Codex `AGENTS.md` harness surface |
| P5 | #113 | `orbi-verification-loop` |
| P6 | #114 | `orbi-security-review` |
| P7 | #115 | `orbi-context-budget` + deterministic auditor |
| P8 | #116 | `orbi-agent-harness` + observation contract/validator |

All listed phases were merged only after their repository validation surfaces completed successfully.

## Materialized ORBI layer

### Root instructions

`AGENTS.md`

Provides:
- source-of-truth ordering;
- exact repository gate commands;
- review lanes;
- security rules;
- ECC pilot boundaries.

### Project skills

- `orbi-verification-loop`
- `orbi-security-review`
- `orbi-context-budget`
- `orbi-agent-harness`

### Deterministic tooling

- `scripts/ecc-context-budget.mjs`
- `scripts/validate-agent-observation.mjs`
- `.orbi/agent-observation-v1.schema.json`

These are development/audit tools only. Product runtime does not depend on them.

## Security outcome

AgentShield remains:

- SHA-pinned;
- `contents: read`;
- report-only;
- non-fixing;
- non-blocking.

The Creative Studio baseline contains a known false-positive class where npm `integrity: sha512-...` lockfile values are classified as Azure storage keys.

That baseline is **repository-specific** and must not be copied into another ORBI repository as an accepted finding.

Future repositories must create their own scanner baseline.

## Context-budget outcome

Post-P8 measured repository surfaces:

| Surface | Lines | Approx. prose tokens |
|---|---:|---:|
| `AGENTS.md` | 104 | ~785 |
| `orbi-verification-loop` | 191 | ~1,265 |
| `orbi-security-review` | 202 | ~1,265 |
| `orbi-context-budget` | 107 | ~590 |
| `orbi-agent-harness` | 170 | ~746 |

P7 model:

- estimated persistent repository instruction overhead: **~785 tokens**;
- discoverable skills if every skill were fully read: **~3,866 tokens**.

The important result is not the exact token estimate. It is the loading model: project skills are discoverable/on-demand and are not treated as permanent context solely because they exist.

## What is portable

### Portable with minor review

- context-budget loading model;
- observation/recovery contract;
- fail-closed retry/stop-condition rules;
- evidence-backed completion model.

### Must be adapted

- root `AGENTS.md`;
- verification commands;
- security checklist/trust boundaries;
- AgentShield path filters and accepted baseline;
- authority-domain list.

## What remains deliberately disabled

- ECC full installation;
- bulk agent installation;
- bulk skill installation;
- hooks;
- MCP;
- continuous-learning-v2;
- unified-memory runtime;
- autonomous loops;
- Codex multi-agent roles.

These are not rejected permanently. They remain separate future experiments.

## Portability order for another ORBI repository

1. inventory stack, tests, CI and authority boundaries;
2. define repository-owned `AGENTS.md`;
3. run AgentShield report-only with a fresh baseline;
4. apply agent-sort methodology;
5. adapt verification;
6. adapt security;
7. add context-budget tooling;
8. add harness contract;
9. certify before considering memory/hooks/automation.

## Recommended next target

**ORBI PVMetrics** is the strongest next pilot because it has:

- explicit governed data contracts;
- substantial automated testing;
- commissioning/BESS workflows;
- strong evidence/readiness boundaries;
- a mature phase/gate development process.

It should not receive the Creative Studio profile verbatim. It should receive the **portable profile** plus PVMetrics-specific adaptations.

## Certification conclusion

Creative Studio demonstrates that ECC can be used as an upstream engineering reference without becoming an ORBI runtime dependency.

The approved ORBI pattern is:

`ECC reference -> ORBI adaptation -> repository evidence -> selective skill -> CI/security validation -> canonical merge`

not:

`ECC full install -> trust everything upstream`.
