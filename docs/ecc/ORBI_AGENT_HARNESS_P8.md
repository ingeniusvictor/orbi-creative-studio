# P8 — ORBI Agent Harness Contract

Status: CONTROLLED / CONTRACT-DEFINED

## Goal

Adapt ECC `agent-harness-construction` into an ORBI-specific, testable harness contract.

## Added surfaces

- `.agents/skills/orbi-agent-harness/SKILL.md`
- `.orbi/agent-observation-v1.schema.json`
- `scripts/validate-agent-observation.mjs`
- `tests/agentHarnessContract.test.js`

## Key adaptation

ECC recommends stable tools, structured observations, explicit recovery and context budgeting.

ORBI adds explicit authority separation. A successful agent/tool result cannot itself authorize:

- runtime certification mutation;
- Compute Router/cutover changes;
- provider-secret handling;
- benchmark promotion;
- upstream adoption;
- canonical Git mutation.

## Observation contract

A valid observation contains:

- status: success / warning / error;
- summary;
- next actions;
- artifacts;
- evidence;
- authority impact.

Error observations require:

- root-cause hint;
- safe retry;
- stop condition.

Unknown top-level fields are rejected to avoid silent capability/contract widening.

## Validator properties

The validator is:

- deterministic;
- dependency-free;
- read-only;
- network-free;
- not a runtime agent;
- not an authorization engine.

It validates shape/consistency only. It does not decide whether evidence is true.

## Tests

P8 verifies:

1. normal structured success observations;
2. fail-closed error recovery requirements;
3. authority-impact consistency;
4. rejection of unknown contract fields.

## Non-goals

P8 does not:

- enable an autonomous loop;
- add MCP;
- add model calls;
- activate memory;
- activate continuous learning;
- grant any external-write or privileged authority.

## Exit criteria

- focused contract tests GREEN;
- AgentShield report-only GREEN;
- Integrated PR Gate GREEN;
- no product/runtime behavior change.
