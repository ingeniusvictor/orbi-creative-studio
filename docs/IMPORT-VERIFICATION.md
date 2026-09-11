# ORBI Creative Studio — Import Verification

Verification date: 2026-09-11

## Result

**PASS**

The exact upstream Git baseline has been imported into the ORBI repository without rewriting or flattening its history.

## Immutable baseline branch

- ORBI repository: `ingeniusvictor/orbi-creative-studio`
- Branch: `upstream-baseline`
- Commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- Root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- Source: `Anil-matcha/Open-Generative-AI`

The branch commit and root tree were independently verified after import.

## Import method

A controlled GitHub Actions workflow performed only Git operations:

1. fetched the public upstream Git history,
2. verified the pinned commit object,
3. verified the expected root tree,
4. created `upstream-baseline` only if absent,
5. refused to move the branch if a conflicting SHA already existed.

No upstream application code was executed during the import.

## Submodule preservation

The imported baseline retains the original Git submodule links:

- `packages/Vibe-Workflow@c65ce897e82bf73659c2725528c8492cd609d831`
- `packages/Open-Poe-AI@3e21ebc92d93bd699ffc6000bbcf980eaa8830cb`
- `packages/Open-AI-Design-Agent@ebc0ce7650baad0d13797ccd471c883e78be3161`

Runtime certification subsequently confirmed that all three exact pins can be checked out recursively by GitHub Actions.

## ORBI policy

`upstream-baseline` is an immutable reference branch.

Do not:

- force-push it,
- rebase it,
- add ORBI commits to it,
- update it to newer upstream releases.

Future upstream versions must receive a new explicitly pinned baseline or a reviewed upstream-sync process.
