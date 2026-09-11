# ORBI Creative Studio — Phase 0 Lint Certification

Certification date: 2026-09-11

Baseline:

- `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- certification run: `34651746978`

## Result

**NOT CERTIFIABLE / configuration failure**

Command:

```bash
npm run lint
```

The package script resolves to:

```bash
next lint
```

Next.js reports that `next lint` is deprecated and then opens an interactive ESLint configuration prompt.

In non-interactive CI this exits with code 1 before producing a lint violation report.

Therefore this result must **not** be interpreted as "the source has lint errors." The actual finding is:

> The pinned upstream does not provide a deterministic, non-interactive lint configuration.

## Observed prompt

Next.js requested selection of:

- Strict
- Base
- Cancel

This is unsuitable for reproducible certification.

## ORBI remediation

Tracked in issue #9.

After Phase 0:

1. define an explicit ESLint configuration;
2. migrate the script from `next lint` to ESLint CLI;
3. run the first lint without auto-fixing;
4. capture the initial violation inventory;
5. fix lint debt in controlled batches;
6. keep runtime tests and builds green.

## Baseline integrity rule

Do not add lint configuration to `upstream-baseline`.

The configuration itself is an ORBI divergence and must be reviewed as such.
