---
name: orbi-agent-harness
description: Design or review ORBI agent action spaces, observations, retries and stop conditions using narrow capabilities and evidence-backed completion. Use when creating or changing an agent, tool contract, autonomous loop, handoff format, or structured agent output.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC agent-harness-construction 2.2.2
  rollback_strategy: Remove this skill, the P8 contract/schema/validator/tests, and its profile registration. No product runtime depends on it.
---

# ORBI Agent Harness

Use this skill when an ORBI agent or agent-like workflow needs a defined action space.

## Core model

Agent quality depends on four controlled surfaces:

1. action-space quality;
2. observation quality;
3. recovery quality;
4. context-budget quality.

ORBI adds a fifth:

5. **authority separation** — a recommendation, observation or successful tool call does not itself grant permission to cross a governed boundary.

## Action-space tiers

Classify every capability before giving it to an agent:

### Read-only

Examples:

- inspect repository state;
- read files/docs;
- search code;
- inspect CI evidence;
- compare commits.

Default preference: broad enough to diagnose, narrow enough to avoid mutation.

### Local/reversible mutation

Examples:

- edit an isolated feature branch;
- create test fixtures;
- generate reports/artifacts.

Require deterministic diff/evidence and a rollback path.

### External write

Examples:

- create/update issues or PRs;
- push branch changes;
- alter external service state.

Require explicit task authorization and preserve the external object ID/result.

### Privileged/governed mutation

Examples:

- secrets/permissions;
- deployment/cutover;
- runtime certification source;
- production routing;
- canonical history.

Use the smallest dedicated tool possible. Never hide privileged actions inside a catch-all macro tool.

## Observation contract

P8 defines the machine-readable observation contract at:

`.orbi/agent-observation-v1.schema.json`

Validator:

```bash
node scripts/validate-agent-observation.mjs <observation.json>
```

Every structured observation must carry:

- `status`;
- concise `summary`;
- `nextActions`;
- concrete `artifacts`;
- explicit `evidence`;
- `authorityImpact`.

Errors must additionally carry:

- root-cause hint;
- safe retry;
- stop condition.

## Recovery rules

Do not loop by repeating the same failed action with the same assumptions.

A safe retry must change at least one of:

- hypothesis;
- input;
- scope;
- evidence source;
- implementation.

Stop when:

- the same root cause repeats without new evidence;
- the next action would cross an unauthorized boundary;
- required evidence is unavailable;
- state becomes ambiguous enough that mutation would be unsafe.

## Completion

Never convert these into READY by themselves:

- tool call returned success;
- PR is mergeable;
- benchmark completed;
- scanner score improved;
- model responded;
- file exists.

READY requires task-specific evidence. Use `orbi-verification-loop` for repository readiness and `orbi-security-review` for security-sensitive changes.

## Context

Use `orbi-context-budget` when adding tools, instructions or skills.

Keep invariant instructions small. Put domain-specific procedures into on-demand skills.

Do not assume a tool-schema token cost unless the live schema is available.

## Authority separation

The harness must report impact on:

- runtime certification;
- Compute Router;
- cutover;
- provider secrets;
- benchmark evidence;
- upstream intake;
- canonical Git.

An agent may observe those surfaces without being authorized to mutate them.

## Anti-patterns

- catch-all tools that mix read, write and privileged behavior;
- opaque success strings without evidence IDs;
- unlimited retry loops;
- treating agent memory as canonical truth;
- embedding secrets in observations;
- allowing a benchmark or scanner to self-authorize production behavior;
- loading every available skill for every task.

## Rollback

P8 is engineering guidance + schema/validator/test tooling. Product runtime must be unaffected if these files are removed.
