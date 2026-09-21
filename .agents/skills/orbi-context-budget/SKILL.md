---
name: orbi-context-budget
description: Audit ORBI Creative Studio agent-instruction overhead without assuming every installed skill or config file is permanently loaded. Use after adding AGENTS instructions, project skills, Codex/MCP configuration, or when agent context becomes noisy or sluggish.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC context-budget 2.2.2
  rollback_strategy: Remove this skill, its audit script/tests, and its ORBI ECC profile registration. No product runtime depends on it.
---

# ORBI Context Budget

Use this skill to keep the ORBI agent surface small and intentional.

## Core rule

Do **not** count a repository file as permanent context merely because it exists.

Classify surfaces first:

- **always-instructions**: root/harness instruction files expected to shape the session;
- **discoverable-skill**: SKILL.md files available for on-demand use;
- **config-reference**: manifests/configuration that should be read only when relevant.

The deterministic auditor is:

```bash
node scripts/ecc-context-budget.mjs
node scripts/ecc-context-budget.mjs --json
```

## What to inspect

Current governed surfaces include:

- `AGENTS.md`;
- optional `CLAUDE.md` or `.codex/AGENTS.md` if introduced later;
- `.agents/skills/*/SKILL.md`;
- `.mcp.json`;
- `.codex/config.toml`;
- `.orbi/ecc-profile.json`.

Do not scan the whole documentation tree and call it agent overhead.

## Interpretation

Token values are estimates, not model telemetry.

Use them to compare repository revisions and spot growth, not to claim exact Codex context-window consumption.

The script intentionally reports separately:

1. estimated persistent instruction overhead;
2. total size of discoverable skills if fully read;
3. config-reference size if fully read.

This prevents the main ECC failure mode we want to avoid: assuming hundreds of available skills must all be injected into every task.

## Review rules

When overhead grows:

1. shorten always-loaded instruction text before deleting useful on-demand skills;
2. remove duplication between `AGENTS.md` and skills;
3. move task-specific guidance from always-loaded instructions into a skill;
4. keep one authoritative rule instead of several paraphrases;
5. do not trade away security/authority boundaries solely to save tokens;
6. do not activate new MCP servers without accounting separately for their tool-schema cost;
7. do not claim MCP token cost from repository inspection when the live tool schema is unavailable.

## Flags

The auditor currently flags, but does not fail on:

- always-instruction files over 150 lines;
- project skills over 250 lines.

These are review triggers, not enforcement thresholds.

## Completion report

Record:

- persistent instruction estimate;
- discoverable-skill estimate;
- config-reference estimate;
- largest surfaces;
- duplicated/avoidable guidance;
- proposed savings;
- security/authority text that must remain.

## Authority

Context optimization must never silently remove or weaken:

- provider-secret boundaries;
- Electron privilege boundaries;
- runtime certification provenance;
- Compute Router/cutover authority;
- benchmark evidence rules;
- upstream intake policy;
- canonical Git/evidence requirements.

## Rollback

This is development tooling plus instructions. Removing the skill/script/tests and manifest entry must not alter product runtime behavior.
