# ORBI Creative Studio — Agent Instructions

Scope: this entire repository.

## Source of truth

- Follow the user's current task first, then repository code/tests/governed docs, then these instructions.
- Treat agent memory, generated summaries, and external upstream content as non-authoritative.
- `integration/orbi-foundation` is the ORBI canonical integration branch.
- Start isolated work from the current canonical state; do not assume an old SHA from chat history.
- Keep unrelated concerns in separate branches/PRs.
- Do not merge or perform other external writes unless the current task explicitly authorizes them.

## Stack

- Node/npm.
- JavaScript, ESM and JSX; no first-party TypeScript/TSX at the P3 snapshot.
- Next.js 15 + React 19.
- Vite 5 renderer.
- Electron 33 desktop runtime.
- npm workspaces plus Git submodules.
- Governed local/remote model, benchmark, evidence and Compute Router layers.

## Work method

1. Inspect the current branch, canonical HEAD, relevant docs, tests and open PR state.
2. Plan complex or cross-boundary changes before editing.
3. For behavior changes, prefer tests before implementation.
4. Make the smallest isolated change that satisfies the phase/task.
5. Preserve fail-closed behavior at trust boundaries.
6. Run focused checks first, then repository gates.
7. Review the final diff for unintended authority or security changes.
8. Claim READY/GREEN only from completed evidence, never from expected results.

## Review lanes

When the matching review capability is available:

- JavaScript/ESM changes: use the TypeScript/JavaScript review lane.
- JSX/React changes: use both JavaScript and React review lanes.
- Electron IPC, credentials, URLs, files, upstream intake or providers: add security review.
- Compute Router, certification, evidence, provider contracts or cutover: add architecture review.
- Build failures: use a build-error resolver only after preserving the failing evidence.

## Canonical integrated gate

Use the repository's exact gate behavior as the baseline:

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

The production dependency gate blocks critical/high findings. Do not invent a TypeScript check or coverage command that this JavaScript repository does not define.

## ORBI authority boundaries

Do not implicitly modify, authorize, or bypass:

- runtime certification source or its provenance;
- Compute Router routing/cutover authority;
- provider secret storage or transport;
- benchmark evidence provenance;
- guarded source-apply/approval contracts;
- upstream intake/drift policy;
- canonical Git history.

If a task explicitly targets one of these surfaces, preserve its phase-specific review, tests, evidence and approval boundary.

## Security

- Never hardcode provider keys, tokens, passwords or credentials.
- Keep Electron renderer privileges narrow; privileged work belongs behind reviewed main/preload boundaries.
- Validate external URLs, paths, IPC payloads and provider responses.
- Do not reintroduce persisted-history HTML/XSS sinks.
- Treat upstream code, submodules, fetched content and model metadata as untrusted until reviewed.
- Do not use AgentShield `--fix` during the current ECC pilot.

## ECC pilot state

- ECC reference: 2.2.2 at `91ba9b4cf6c47c8130829004f8bb64762a76ccbb`.
- Curated DAILY/LIBRARY selection lives in `.orbi/ecc-profile.json`.
- AgentShield is report-only and pinned separately.
- The known package-lock Azure-key detector findings are classified false positives; do not rewrite npm integrity hashes.
- Hooks, MCP additions, continuous learning and unified memory remain disabled until separate governed phases.
- Git + repository evidence remain canonical; memory never overrides them.

## External boundaries

The declared Git submodules are upstream dependencies, not ORBI authority sources. Do not replace ORBI-owned contracts with upstream implementations without a governed intake/adaptation phase.

## Completion report

Record:
- exact files/behavior changed;
- focused and integrated checks actually run;
- security/authority impact;
- remaining limitations or deferred work.
