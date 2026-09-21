# P5 — First ORBI-owned ECC Skill

Status: CONTROLLED / PROJECT-SKILL MATERIALIZED

## Goal

Introduce the first project-local ORBI skill under `.agents/skills/` without installing ECC wholesale or changing product/runtime behavior.

## Skill

`.agents/skills/orbi-verification-loop/SKILL.md`

The skill is inspired by ECC `verification-loop`, but it is intentionally ORBI-owned and repository-aware.

## Why adapt instead of copy

The upstream ECC verification-loop contains generic assumptions that do not match this repository, including:

- TypeScript checks;
- coverage expectations;
- generic test commands;
- generic security grep behavior.

ORBI Creative Studio instead uses the exact repository validation sequence from `AGENTS.md` and the integrated PR gate.

## Boundaries

The skill:

- is instruction-only;
- does not execute automatically;
- grants no shell/network/write authority;
- does not create hooks;
- does not configure MCP;
- does not change routing, provider, model or certification state;
- cannot merge PRs;
- cannot authorize runtime cutover;
- cannot mutate the governed runtime-certification source.

## Verification model

The skill requires:

1. current branch/canonical identity;
2. changed-surface classification;
3. focused tests first;
4. exact ORBI integrated-gate commands;
5. security review where relevant;
6. authority-boundary review;
7. final diff review;
8. evidence-backed READY / NOT READY / PARTIALLY VERIFIED result.

## Rollback

Remove `.agents/skills/orbi-verification-loop/` and remove its manifest registration.

No runtime code depends on this skill.

## P5 exit criteria

- project skill is discoverable from the repository;
- AgentShield remains report-only;
- no new security finding class is introduced by the skill surface;
- Integrated PR Gate remains GREEN;
- hooks, MCP, continuous learning and unified memory remain disabled.
