# ORBI Creative Studio — Deterministic Lint Baseline

Validation date: 2026-09-11

Branch:

`qa/lint-deterministic`

Validation run:

`34654521354`

## Result

**PASS**

The deprecated interactive command:

`next lint`

was replaced on the isolated QA branch with:

`eslint .`

using an explicit ESLint 9 flat configuration.

## Baseline lint inventory

Initial deterministic inventory:

- files scanned: 164
- files with messages: 4
- errors: **0**
- warnings: **12**
- fixable errors: 0
- fixable warnings: 0

Warning distribution:

- 6 × `@next/next/no-img-element`
- 4 × `jsx-a11y/alt-text`
- 1 × `react-hooks/exhaustive-deps`
- 1 × `import/no-anonymous-default-export`

## CI guard

The validation branch enforces:

```
npm run lint -- --max-warnings 12
```

This means:

- the existing known warnings are tolerated temporarily,
- warning count may not silently increase,
- any lint error fails immediately.

The warning ceiling can be ratcheted downward as warnings are addressed.

## Regression validation

After introducing the lint configuration/script:

- lint ceiling: PASS
- root tests: PASS
- workspace builds: PASS
- Next.js production build: PASS
- Electron/Vite renderer build: PASS

## Files introduced/changed

- `eslint.config.mjs`
- root `package.json` lint script

## Integration status

Validated but not merged into `main` or `upstream-baseline`.

This change should join the future ORBI foundation branch after the selected dependency-security branch is finalized.
