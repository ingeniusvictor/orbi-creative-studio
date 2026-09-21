# ORBI ECC Pilot Runbook — Creative Studio

This runbook operationalizes `ORBI ECC Profile v0.1`.

## P0 — Inventory and baseline

Required:
- capture canonical branch/commit;
- identify existing repository agent/MCP/hook configuration;
- record package/workspace stack;
- record current test/lint/build gates;
- confirm open PRs so the ECC pilot does not mix with active feature work.

Observed at pilot start:
- canonical branch: `integration/orbi-foundation`;
- an independent P1C33 PR exists and must remain isolated;
- no root `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, or `.mcp.json` was present on the canonical branch;
- root project is JavaScript/TypeScript, Next/React/Vite/Electron with multiple workspaces and local-model integration.

Exit condition: PASS when the ECC branch is isolated and no runtime file is changed.

## P1 — Curated profile only

Create ORBI-owned declarative profile:
- DAILY agents;
- DAILY skills;
- LIBRARY components;
- prohibited authorities;
- staged features.

No ECC installer, hook, MCP server, or runtime dependency is added.

Exit condition: profile review accepted.

## P2 — Security report-only trial

Run AgentShield/security-scan only after choosing and recording a reviewed pinned version.

Rules:
- no `--fix`;
- no write authority;
- report-only;
- scanner output is evidence, not automatic truth;
- findings must distinguish runtime configuration from documentation/examples.

Outputs:
- machine-readable report;
- human remediation summary;
- false-positive notes;
- proposed threshold for future CI.

Exit condition: security trial is reproducible and introduces zero repo mutations.

## P3 — Agent-sort / workflow trial

Use ECC selection logic against actual repo work.

Compare:
- manually selected ORBI profile;
- ECC DAILY/LIBRARY recommendation;
- unnecessary components;
- missing components;
- context overhead.

Do not activate continuous learning yet.

Exit condition: agent selection is demonstrably useful and does not conflict with ORBI governance.

## P4 — Optional controlled adoption

Only after P2/P3 pass:

Candidate additions:
- selected skills;
- minimal hook profile;
- continuous-learning-v2 project-local mode;
- unified-memory in non-authoritative mode.

Each addition requires its own small PR and rollback path.

## Explicit non-goals

This pilot does not:
- replace P1C phases;
- replace ORBI certification;
- replace Git history/canonical docs with agent memory;
- enable new AI models;
- change Creative Studio generation behavior;
- merge upstream ECC code wholesale;
- vendor the complete ECC repository.

## Evidence expected at the end

- chosen ECC components;
- rejected/deferred components and reasons;
- security scan report;
- measured context/latency overhead;
- compatibility notes for Codex/other harnesses;
- recommendation: adopt / revise / stop;
- exact rollback instructions.
