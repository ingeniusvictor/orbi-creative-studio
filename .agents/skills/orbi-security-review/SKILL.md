---
name: orbi-security-review
description: Repository-aware security review workflow for ORBI Creative Studio. Use when changing Electron IPC/preload boundaries, provider credentials, external URLs or paths, persisted/generated content rendering, local model/runtime integration, upstream intake, downloads, API routes, or dependency surfaces.
version: "0.1.0"
license: MIT
metadata:
  origin: ORBI
  upstream_inspiration: ECC security-review 2.2.2
  rollback_strategy: Remove this skill directory and its ORBI ECC profile registration; no product runtime depends on it.
---

# ORBI Security Review

Use this skill for security-sensitive changes in ORBI Creative Studio.

The repository, tests, governed docs and current `AGENTS.md` remain authoritative. This skill is advisory/instructional and grants no merge, routing, certification, provider-secret, model-enable or cutover authority.

## Activate when

Use this skill when a change touches any of these surfaces:

- `electron/main.js`, `electron/preload.js`, or Electron IPC;
- provider credentials, tokens, API keys or secure storage;
- external URLs, filesystem paths, downloads or subprocess/runtime launching;
- API routes or external provider responses;
- persisted prompts/history/results rendered into the DOM;
- HTML, Markdown, media metadata or generated content displayed in UI;
- local inference engines, model catalogs, model downloads or executable provenance;
- upstream intake, submodules or copied upstream code;
- dependency manifests/lockfiles or GitHub Actions;
- benchmark/evidence/certification data crossing trust boundaries.

## 1. Classify the trust boundary

For every changed surface identify:

- untrusted input source;
- trusted component receiving it;
- validation/sanitization step;
- capability gained after crossing the boundary;
- failure behavior;
- evidence/test covering the boundary.

Prefer fail-closed behavior when uncertainty could expose credentials, execute code, write files, alter routing or render unsafe content.

## 2. Electron boundary review

For Electron changes verify:

- renderer does not gain Node or filesystem authority directly;
- privileged operations stay in reviewed main/preload code;
- preload exposes the narrowest capability surface;
- IPC channel names and payloads are explicit;
- IPC payload shape, URL/path and expected types are validated;
- renderer-controlled values cannot choose arbitrary commands/executables;
- error responses do not leak secrets or sensitive filesystem paths;
- no new unsafe `webPreferences` are introduced.

Any new IPC capability should have a focused test or other deterministic evidence.

## 3. Provider secret handling

Verify:

- no API key/token/password is committed;
- secrets are never returned to the renderer unnecessarily;
- logs and error objects redact secrets;
- credentials are stored through the repository's reviewed secure path;
- provider adapters receive only the credential capability they need;
- debug/test fixtures do not contain production-looking credentials.

Do not move credentials into source, docs, Agent memory or project-local skills.

## 4. URL, path and file review

For externally influenced URLs/paths:

- validate scheme/protocol and allowed destination;
- normalize paths before authority decisions;
- prevent directory traversal;
- avoid arbitrary local file reads/writes;
- use explicit download destinations;
- verify downloaded executables/models against governed provenance where the feature requires it;
- never treat a filename, model ID or URL string as proof of identity.

## 5. Rendering / XSS review

This repository has prior persisted-history DOM-XSS remediation. Preserve it.

Verify:

- untrusted strings are assigned through safe DOM/text properties;
- no persisted prompt/result/URL is inserted through unsafe HTML construction;
- `dangerouslySetInnerHTML`, dynamic `innerHTML`, HTML template interpolation and equivalent sinks receive special review;
- URL values used in `src`/`href` are validated where attacker-controlled;
- sanitization, when required, happens before rendering and is covered by tests.

Do not weaken existing history-safety tests simply to make a UI change pass.

## 6. Local runtime/model boundary

When changing local inference or model management verify:

- model metadata is treated as untrusted until validated;
- executable/runtime identity is not inferred solely from path/name;
- downloaded runtime/model artifacts use the existing provenance/pinning model where applicable;
- subprocess arguments are structured and not shell-concatenated from untrusted input;
- readiness/probe failures remain fail-closed;
- benchmark evidence cannot silently become runtime certification;
- a successful benchmark does not itself authorize routing/cutover.

## 7. Upstream and supply-chain review

For copied/upstream code:

- preserve the ORBI upstream-intake policy;
- distinguish ADOPT / ADAPT / REJECT evidence;
- ORBI-owned authority surfaces are not overwritten by upstream versions;
- security-sensitive upstream changes require explicit review;
- license/provenance requirements are retained.

For dependencies/actions:

- preserve lockfiles;
- prefer immutable action SHAs in GitHub Actions;
- use `npm ci` for exact graph verification;
- use `npm audit --omit=dev` according to current repository policy;
- do not run `npm audit fix` automatically;
- do not change dependencies merely to silence a scanner without root-cause review.

## 8. AgentShield interpretation

AgentShield remains report-only.

Known baseline:
- the `package-lock.json` Azure-key detector class is a false positive on npm `integrity: sha512-...` values;
- those integrity hashes must not be redacted or rewritten.

Any new finding outside that known class requires explicit review.

A scanner score is evidence, not authority. Review the actual finding class before changing code.

## 9. ORBI authority review

Security review must explicitly confirm whether the change affects:

- runtime certification source/provenance;
- Compute Router routing authority;
- cutover authorization;
- provider secret transport/storage;
- benchmark evidence provenance;
- guarded source-apply approvals;
- upstream intake/baseline policy;
- canonical Git history.

If affected intentionally, cite the phase-specific tests/evidence and approval boundary. Never infer authorization from an agent recommendation.

## 10. Security review report

Return:

```text
ORBI SECURITY REVIEW

Scope:
- branch/head:
- changed files:
- trust boundaries:

Findings:
- CRITICAL:
- HIGH:
- MEDIUM:
- LOW:
- ACCEPTED BASELINE / FALSE POSITIVES:

Checks:
- Electron boundary:
- secrets:
- URL/path/file:
- XSS/rendering:
- local runtime/model:
- upstream/supply chain:
- authority impact:

Evidence:
- focused tests:
- AgentShield run/artifact if applicable:
- integrated gate:

Result:
- SECURITY READY / NOT READY / PARTIALLY VERIFIED

Remaining risks:
- ...
```

Use SECURITY READY only when required evidence for the changed security boundary has completed successfully.

## Rollback

This skill is instruction-only. Remove `.agents/skills/orbi-security-review/` and its manifest registration to roll back. Runtime behavior must not depend on this file.
