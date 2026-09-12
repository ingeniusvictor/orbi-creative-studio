# Phase 0 — Upstream Import & Runtime Certification Runbook

Pinned source: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

This is the only Phase 0 step that currently requires a machine with Git access to both repositories.

## A. Create immutable upstream baseline branch

From a clean working directory:

```bash
git clone https://github.com/ingeniusvictor/orbi-creative-studio.git
cd orbi-creative-studio

git remote add upstream https://github.com/Anil-matcha/Open-Generative-AI.git
git fetch upstream --tags

git branch upstream-baseline 871c1d4ef4e184d7b6b5117147d863d30b656cbb
git push -u origin upstream-baseline
```

Do not merge this branch into `main` yet.

## B. Verify the baseline

```bash
git rev-parse upstream-baseline
git rev-parse 871c1d4ef4e184d7b6b5117147d863d30b656cbb
```

Both SHAs must match.

Check the root files directly from the baseline:

```bash
git show upstream-baseline:package.json
git show upstream-baseline:LICENSE
git show upstream-baseline:.gitmodules
```

Expected root package version: `2.0.0`.

## C. Create certification working branch

```bash
git switch upstream-baseline
git switch -c feature/phase-0-certification
```

This branch is disposable/reproducible. The `upstream-baseline` branch must remain untouched.

## D. Initialize exact submodule revisions

```bash
git submodule sync --recursive
git submodule update --init --recursive
git submodule status --recursive
```

Expected top-level gitlinks:

- `packages/Vibe-Workflow` -> `c65ce897e82bf73659c2725528c8492cd609d831`
- `packages/Open-Poe-AI` -> `3e21ebc92d93bd699ffc6000bbcf980eaa8830cb`
- `packages/Open-AI-Design-Agent` -> `ebc0ce7650baad0d13797ccd471c883e78be3161`

Do not use `git submodule update --remote`.

## E. Record environment before install

```bash
node --version
npm --version
git --version
```

Also record:

- OS/version
- CPU
- RAM
- GPU and VRAM if present
- free disk space

## F. Install dependencies

Prefer deterministic lockfile installation first:

```bash
npm ci
```

If `npm ci` fails because of workspace/submodule lockfile conditions, preserve the complete error log before attempting `npm install`.

Do not silently modify lockfiles during baseline certification.

## G. Run existing local-inference tests

The root package has no standard `npm test` script at the pinned baseline. Run the observed tests explicitly:

```bash
node --test tests/*.test.js
```

Record pass/fail counts and exact failing test names.

## H. Build packages / application

Try in this order and preserve outputs:

```bash
npm run build:packages
npm run build
npm run vite:build
```

For desktop development, where practical:

```bash
npm run electron:dev
```

Do not classify Phase 0 as PASS solely because one surface builds; record each surface independently.

## I. Local inference smoke checks

Without downloading every model, verify:

- local-AI path resolution
- binary status path
- local model catalog renders
- Wan2GP settings render
- application behaves predictably with no MuAPI key

If a small image model is tested, DreamShaper/SD1.5-class is preferable to SDXL for the first smoke test.

## J. Network / provider checks

With no provider credentials entered:

- start the application
- confirm local settings are reachable
- note any unsolicited network calls
- note remote assets/update checks
- verify no secret is bundled in source

Never commit live API keys.

## K. Certification report

Create `docs/certification/PHASE-0-RUNTIME.md` containing:

- exact baseline SHA
- submodule SHAs
- machine/environment
- dependency install result
- tests result
- Next build result
- Vite build result
- Electron result
- local inference result
- Wan2GP configuration result
- observed network calls
- blockers
- final Phase 0 PASS / PASS-WITH-BLOCKERS / FAIL

## L. Exit condition

Only after the report is complete should ORBI create functional divergence branches such as provider abstraction or Compute Router.

The baseline branch remains a permanent reference point for attribution, debugging and future upstream comparison.