# ORBI Creative Studio — Phase 1B.22 Certification/Release Evidence Export

Status: stacked on P1B.21. Pure in-memory export only.

## Purpose

Produce a sanitized JSON evidence package that combines:

- exact P1B.19 build identity;
- P1B.17/P1B.20 parity build binding;
- P1B.16 release evidence;
- P1B.18 cutover review bundle.

The export is diagnostic evidence only. It is not an approval or execution artifact.

## Source revalidation

`buildCertificationReleaseEvidenceExport()` requires all sources to resolve to the same exact 40-character Git commit.

Before export it revalidates:

- renderer build identity;
- bound parity certification;
- release gates derived from evidence;
- the full cutover review bundle rebuilt from parity/release/provider inputs.

Cross-commit evidence fails closed.

## Export contents

The JSON package contains only whitelisted fields:

- schema/export timestamp;
- source commit and app version;
- fixed Studio parity profile;
- parity binding summary;
- route sample/model counts;
- release gate states;
- CI/platform/security/rollback proof IDs and timestamps;
- release issues;
- review status and global blockers;
- per-route review blockers;
- execution authority and cutover authorization state.

## Blocked exports are valid diagnostics

A package can be structurally valid while review status remains `BLOCKED`.

For example, current repository evidence must report `ciGreen: false` while GitHub Actions fails before any step executes.

This makes the export useful for troubleshooting without converting missing evidence into approval.

## Serialization whitelist

`serializeCertificationReleaseEvidenceExport()` reconstructs an exact serialization shape.

It does not directly stringify arbitrary input.

Extra fields injected after bundle creation, including prompts, API keys, media URLs or unknown metadata, are omitted.

## Privacy boundary

The exporter does not include:

- prompts;
- negative prompts;
- media payloads;
- API keys;
- provider secrets;
- filesystem paths;
- raw generation requests.

## Authority boundary

Every export preserves:

- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

A `READY_FOR_REVIEW` export is still not a cutover authorization.

## Pure in-memory behavior

P1B.22 does not:

- write files;
- trigger downloads;
- use Blob/object URLs;
- use storage;
- call IPC;
- call network APIs;
- modify the diagnostics panel;
- change provider selection;
- execute generation.

## Future use

A later phase may explicitly surface this JSON through a user-triggered copy/download action, but P1B.22 intentionally stops at pure object construction and serialization.

## Merge gate

Keep stacked until P1B.3–P1B.21 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.