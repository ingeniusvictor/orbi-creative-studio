---
name: orbi-verification-loop
description: Repository-aware verification workflow for ORBI Creative Studio. Use after meaningful code or configuration changes and before claiming a branch or PR is ready. Runs focused checks first, then the repository's real integrated gates, and reports security and authority impact without inventing TypeScript or coverage requirements.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC verification-loop 2.2.2
  observation_hooks:
    - Record each verification command, outcome, and skipped reason in the completion report.
  feedback_hooks:
    - Treat CI result, PR review findings, and explicit human correction as feedback for a later reviewed skill revision.
  rollback_strategy: Remove this skill directory and revert the ORBI ECC profile entry; no product runtime depends on this skill.
---

# ORBI Verification Loop

Use this skill to decide whether an ORBI Creative Studio change is actually ready.

The repository and its current `AGENTS.md` are authoritative. This skill does not grant merge, routing, certification, provider-secret, or cutover authority.

## Activate when

- a feature or bug fix is complete;
- a refactor changes behavior or trust boundaries;
- an Electron, provider, model, benchmark, Compute Router, upstream-intake, or CI surface changes;
- a PR is about to be marked ready or merged;
- a failure needs to be reproduced and closed with evidence.

For documentation-only changes, use the smallest applicable verification while still checking any configuration file that can trigger CI or agent behavior.

## 1. Establish scope

Before running commands:

1. identify the current branch and current canonical `integration/orbi-foundation` HEAD;
2. inspect the changed-file list and diff;
3. identify related tests and phase/governance documents;
4. classify the change lanes:
   - JavaScript/ESM;
   - JSX/React;
   - Electron/security;
   - Compute Router/certification/evidence;
   - provider/runtime/model;
   - upstream intake;
   - CI/agent configuration;
5. note any concurrent canonical changes that could invalidate earlier evidence.

Do not reuse an old SHA or a GREEN result from an earlier branch state.

## 2. Focused verification first

Run the narrowest tests/checks that directly cover the changed behavior.

Examples:

```bash
node --test tests/<relevant-test>.test.js
node --check <changed-javascript-file>
```

Never invent a test file. Inspect `tests/` and existing workflows first.

For JSX/React scope, include both JavaScript and React review lanes when available.

For security-sensitive scope, add security review before final readiness.

## 3. Repository-wide verification

The integrated Linux CI is the final repository-level reference. Its current sequence is:

```bash
npm ci
find electron -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npm run lint -- --max-warnings 10
node --test tests/*.test.js
npm run build:packages
npm run build
npm run vite:build
npm audit --omit=dev
```

Do not replace these with generic ECC commands.

In particular:

- do not require `tsc` unless TypeScript is actually introduced and governed by the repo;
- do not claim an 80% coverage gate exists when the repo does not define one;
- do not replace `node --test tests/*.test.js` with `npm test` unless package scripts change;
- do not use `npm audit fix` as part of verification.

### Windows local equivalent for Electron syntax

When running locally in PowerShell, use a Windows-safe equivalent:

```powershell
Get-ChildItem electron -Recurse -Filter *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

The GitHub Actions Linux gate remains authoritative for the exact POSIX command.

## 4. Security and dependency review

For dependency audit results:

- critical/high production findings block readiness;
- lower-severity findings must be recorded but follow repository policy;
- do not mutate dependencies merely to silence a scanner without root-cause review.

AgentShield is currently report-only.

The known `package-lock.json` Azure-key detector class is an accepted false positive for npm `integrity: sha512-...` values. Do not redact or rewrite those integrity hashes. Any finding outside that known class requires fresh review.

## 5. ORBI authority review

Before declaring READY, confirm the change did not implicitly bypass or authorize:

- runtime certification source/provenance;
- Compute Router routing or cutover;
- provider secret storage/transport;
- benchmark evidence provenance;
- guarded source-apply approval;
- upstream intake/adoption policy;
- canonical Git history.

If one of those surfaces is intentionally changed, cite the phase-specific evidence and tests that authorize the change.

## 6. Diff and evidence review

Review the final diff after all fixes.

Confirm:

- no unrelated files changed;
- no temporary debug code or credentials remain;
- tests were not weakened simply to obtain GREEN;
- generated evidence refers to the exact final branch state;
- pending or cancelled checks are not reported as passed.

## 7. Readiness result

Return a compact report in this form:

```text
ORBI VERIFICATION REPORT

Scope:
- branch / head:
- canonical head:
- changed surfaces:

Focused checks:
- <command>: PASS / FAIL / SKIPPED (reason)

Integrated gates:
- install: PASS / FAIL / NOT RUN
- Electron syntax: PASS / FAIL / NOT RUN
- lint: PASS / FAIL / NOT RUN
- root tests: PASS / FAIL / NOT RUN
- workspaces: PASS / FAIL / NOT RUN
- Next build: PASS / FAIL / NOT RUN
- Vite build: PASS / FAIL / NOT RUN
- production audit: PASS / FAIL / NOT RUN

Security/authority:
- new security finding classes:
- authority boundary impact:

Overall:
- READY / NOT READY / PARTIALLY VERIFIED

Remaining limitations:
- ...
```

Use `READY` only when the evidence required for the change has completed successfully. A mergeable PR with pending checks is not READY.

## Observation

Every invocation should preserve the exact commands and outcomes used to reach the readiness decision. CI run IDs, artifact digests, or commit SHAs should be recorded when they materially support the result.

## Feedback

Treat later CI failures, PR review corrections, or explicit human feedback as evidence that this skill may need a new reviewed version. Do not self-amend the skill automatically.

## Rollback

This skill is instruction-only. Rollback is removal of `.agents/skills/orbi-verification-loop/` plus reversal of its profile entry. Product runtime behavior must remain unchanged by skill removal.