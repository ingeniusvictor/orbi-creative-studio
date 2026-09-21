# P4 — Codex Instruction Surface

Status: CONTROLLED / INSTRUCTION-BACKED  
ECC reference: `2.2.2 @ 91ba9b4cf6c47c8130829004f8bb64762a76ccbb`

## Why AGENTS.md first

ECC 2.2.2 classifies Codex as an instruction-backed harness. Its supported surfaces include root `AGENTS.md`, skills and MCP reference configuration, while hook behavior is not assumed equivalent to Claude-style enforcement.

P4 therefore introduces only the lowest-risk native Codex surface:

- root `AGENTS.md`;
- an updated ORBI ECC manifest.

It intentionally does **not** add:

- `.codex/config.toml`;
- MCP servers;
- Codex multi-agent roles;
- ECC hooks;
- project-local skills;
- continuous learning;
- unified memory.

## ORBI adaptation

The root instructions are ORBI-owned rather than a wholesale copy of ECC's root instructions.

This matters because generic ECC assumptions do not exactly match this repository. Examples already observed:

- the repository is JavaScript-only at the audited snapshot;
- the integrated test command is `node --test tests/*.test.js`, not `npm test`;
- no repository-wide 80% coverage gate currently exists;
- runtime certification and routing have ORBI-specific authority boundaries;
- AgentShield currently has a documented npm lockfile false-positive class.

## Expected AgentShield evidence

Before P4 can be considered complete:

1. AgentShield must execute successfully in report-only mode.
2. A Codex/AGENTS harness surface should be discoverable.
3. Any new findings attributable to `AGENTS.md` must be reviewed.
4. The integrated repository gate must remain GREEN.
5. No product/runtime file may change.

## Validation result

AgentShield run `35556389602` completed successfully on the P4 branch.

Evidence:

- registered harness adapters: 9;
- matched adapters: 1;
- matched harness: `Codex`;
- confidence: `strong`;
- evidence: `AGENTS.md`;
- new findings outside `package-lock.json`: 0;
- known npm-integrity/Azure-key false-positive class: 1161;
- artifact digest: `sha256:5021175d5b253868d43a012c2df43cd25f9d279cb1957655413169d844afbd2c`;
- evidence-pack digest: `sha256:b1eda524b125bb99868349287dad8caac2cecd177592f9f5f64ad0e3ee284e14`.

This proves the root instruction file is visible as a live Codex harness surface without introducing a new AgentShield finding class.

## Promotion after P4

If P4 is clean, P5 may introduce the first ORBI-owned Codex skill under `.agents/skills/`.

Raw ECC skills will not be copied blindly. Review found that some upstream skills assume helper scripts or commands not present in this repo, so ORBI skills must bind to the repository's real commands and authority model.