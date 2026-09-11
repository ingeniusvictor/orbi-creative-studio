# ORBI Creative Studio — Dependency Baseline

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

Root lockfile:

- npm lockfile version: 3
- package entries observed: 1169

## Root direct dependency resolution

| Package | Declared | Resolved in lockfile |
|---|---|---|
| axios | ^1.7.0 | 1.15.2 |
| next | ^15.0.0 | 15.5.15 |
| react | ^19.0.0 | 19.2.5 |
| react-dom | ^19.0.0 | 19.2.5 |
| react-hot-toast | ^2.4.1 | 2.6.0 |
| @eslint/eslintrc | ^3 | 3.3.5 |
| @tailwindcss/vite | ^4.1.18 | 4.2.4 |
| autoprefixer | ^10.4.24 | 10.5.0 |
| electron | ^33.4.11 | 33.4.11 |
| electron-builder | ^25.1.8 | 25.1.8 |
| eslint | ^9 | 9.39.4 |
| eslint-config-next | ^15.0.0 | 15.5.15 |
| postcss | ^8.5.6 | 8.5.12 |
| tailwindcss | ^3.4.0 | 3.4.19 |
| vite | ^5.4.0 | 5.4.21 |

Workspace/file dependencies:

- `studio` → `packages/studio`
- `workflow-builder` → Vibe-Workflow submodule
- `ai-agent` → Open AI Agents Hub / historical Open-Poe-AI submodule
- `design-agent` → Open AI Design Agent submodule through the studio package

## Workspace package builds

### studio

- package: `studio@1.0.0`
- build: Tailwind CSS + Babel
- direct local dependencies:
  - workflow-builder
  - ai-agent
  - design-agent

### workflow-builder

- package: `workflow-builder@1.0.0`
- build: Tailwind CSS + Babel
- peer React: >=18

### ai-agent

- package: `ai-agent@1.0.0`
- build: Tailwind CSS + Babel
- peer React: >=18

### design-agent

- package: `design-agent@1.0.0`
- build: Tailwind CSS + Babel
- peer React: >=18
- peer Next: >=14

## Build-chain consequence

The root build is not independent of the three Git submodules.

A correct baseline build requires:

1. exact root commit,
2. all three exact submodule commits,
3. workspace dependency installation,
4. sub-package builds,
5. root Next.js build.

A source import that omits or flattens the gitlinks is not a faithful baseline.

## Dependency audit status

No vulnerability claim is made yet.

The current environment cannot run `npm audit` against a complete imported checkout. Run dependency auditing only after the exact baseline is available locally so results can be tied to:

- the pinned root commit,
- the pinned submodule commits,
- the observed lockfile,
- Node/npm versions,
- audit date.

## ORBI rule

Do not update dependencies as part of Phase 0.

Dependency upgrades must happen only after baseline PASS, on a separate ORBI maintenance branch, with build/test evidence before and after.
