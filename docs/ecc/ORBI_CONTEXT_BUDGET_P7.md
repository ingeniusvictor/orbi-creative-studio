# P7 — ORBI Context Budget

Status: CONTROLLED / REPRODUCIBLE AUDIT

## Goal

Prevent ECC/agent adoption from gradually turning Creative Studio into a context-heavy repository.

## Upstream adaptation

ECC `context-budget` is useful conceptually but is Claude-oriented and may describe agents, skills and MCP schemas as though their loading behavior were uniform.

ORBI P7 makes a stricter distinction:

- always-loaded/always-applicable repository instructions;
- discoverable project skills;
- configuration references;
- live external tool schemas, which cannot be inferred exactly from repository files.

## Deterministic auditor

`scripts/ecc-context-budget.mjs`

Properties:

- read-only;
- no network;
- no repository mutation;
- JSON or human-readable output;
- only known harness surfaces are scanned;
- skills are not counted as persistent merely because they exist.

## Baseline before P7

Measured from canonical after P6:

| Surface | Lines | Words | Prose estimate |
|---|---:|---:|---:|
| `AGENTS.md` | 104 | 604 | ~785 tokens |
| `orbi-verification-loop` | 191 | 973 | ~1,265 tokens |
| `orbi-security-review` | 202 | 973 | ~1,265 tokens |
| `.orbi/ecc-profile.json` | 186 | 321 | ~417 tokens |

Only the instruction surface is treated as persistent repository instruction overhead by the P7 model.

The two skills remain discoverable/on-demand surfaces.

## Tests

`tests/eccContextBudget.test.js` verifies:

- skills/config are excluded from persistent-instruction totals;
- loading classes are deterministic;
- large-file flags are advisory rather than arbitrary blockers.

## Non-goals

P7 does not:

- measure the hidden/internal model context window;
- claim exact Codex token usage;
- add MCP;
- enable hooks;
- enable memory or continuous learning;
- remove security/governance instructions merely to reduce size.

## Exit criteria

- focused P7 tests GREEN;
- AgentShield report-only GREEN;
- Integrated PR Gate GREEN;
- no product/runtime source changes.
