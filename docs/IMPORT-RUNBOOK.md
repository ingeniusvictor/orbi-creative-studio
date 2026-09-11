# ORBI Creative Studio — Upstream Import Runbook

This runbook imports the exact pinned upstream baseline without overwriting the ORBI documentation branch.

## Target repositories

ORBI:

`https://github.com/ingeniusvictor/orbi-creative-studio.git`

Upstream:

`https://github.com/Anil-matcha/Open-Generative-AI.git`

Pinned baseline:

`871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Minimal operator steps

Run on a machine with Git and GitHub authentication already working:

```bash
git clone https://github.com/ingeniusvictor/orbi-creative-studio.git
cd orbi-creative-studio
git remote add upstream https://github.com/Anil-matcha/Open-Generative-AI.git
git fetch upstream --tags
git branch upstream-baseline 871c1d4ef4e184d7b6b5117147d863d30b656cbb
git push -u origin upstream-baseline
```

## Verify exact baseline

```bash
git rev-parse upstream-baseline
git ls-tree upstream-baseline
```

Expected commit:

`871c1d4ef4e184d7b6b5117147d863d30b656cbb`

Expected root tree:

`3b4c89a044621ea677d9ceb477f301301a704cdf`

## Initialize submodules for baseline validation

```bash
git checkout upstream-baseline
git submodule update --init --recursive
git submodule status
```

Expected top-level submodule pins:

```
c65ce897e82bf73659c2725528c8492cd609d831 packages/Vibe-Workflow
3e21ebc92d93bd699ffc6000bbcf980eaa8830cb packages/Open-Poe-AI
ebc0ce7650baad0d13797ccd471c883e78be3161 packages/Open-AI-Design-Agent
```

## Do not merge upstream-baseline directly into main

The branch is an immutable reference.

After it exists remotely, ORBI development should use a derived integration branch. A later integration strategy may use:

- merge with unrelated histories, or
- a clean derived branch whose parent is the upstream baseline plus ORBI documentation/cherry-picks.

The preferred strategy should be selected after baseline build certification.

## Baseline install/build sequence

Once the source is locally available:

```bash
npm install
npm run build:packages
npm run build
```

Available root node tests can be invoked explicitly:

```bash
node --test tests/*.test.js
```

Desktop development/build should be tested separately after the web/package build passes.

## Evidence to capture

Record:

- Node version
- npm version
- operating system
- `git rev-parse HEAD`
- `git submodule status`
- npm install result
- node test result
- package build result
- root Next.js build result
- Electron start/build result
- exact failure logs for any blocker

Do not make source changes merely to force a PASS during baseline certification. Record failures first.
