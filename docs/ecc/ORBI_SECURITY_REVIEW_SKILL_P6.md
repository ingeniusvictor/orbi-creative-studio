# P6 — ORBI Security Review Skill

Status: CONTROLLED / PROJECT-SKILL CANDIDATE

## Goal

Materialize a second ORBI-owned ECC-inspired skill focused on the real trust boundaries of Creative Studio.

## Skill

`.agents/skills/orbi-security-review/SKILL.md`

## Why adapt instead of copy

ECC's generic `security-review` is useful as a source checklist, but it includes assumptions that are not authoritative for this repository, such as:

- generic TypeScript examples;
- Supabase/RLS;
- JWT storage patterns;
- Solana wallet checks;
- generic rate-limit requirements;
- automatic `npm audit fix` examples.

P6 replaces those with repository-specific boundaries:

- Electron main/preload/renderer authority;
- IPC validation;
- provider secret containment;
- URL/path/file handling;
- persisted-history/XSS safety;
- local inference/runtime/model provenance;
- upstream intake and supply chain;
- ORBI certification/routing/cutover authority.

## Non-goals

P6 does not:

- add a security runtime;
- enable AgentShield enforcement;
- add hooks or MCP;
- activate continuous learning or unified memory;
- change product source;
- change dependency versions;
- change routing/certification/cutover state.

## Validation

P6 passes when:

1. AgentShield remains report-only and the skill introduces no new finding class;
2. Integrated PR Gate is GREEN;
3. `.agents/**` remains in AgentShield path coverage;
4. the manifest registers the skill as ORBI-owned/non-authoritative;
5. no runtime/product file changes.
