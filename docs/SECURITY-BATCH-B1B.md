# ORBI Creative Studio — Security Batch B1b Result

Validation date: 2026-09-11

Branch:

`security/batch-b1b-postcss-root-override`

Successful remediation commit:

`cd9e3af39dc7a9028874043884acca3dbe073ad2`

Validation run:

`34654491168`

## Result

**PASS**

Batch B1b solved the final high-severity production dependency finding without upgrading the application to Next.js 16.

## Technique

The root package already declares:

`postcss: ^8.5.6`

B1b adds the npm direct-dependency override:

```json
{
  "overrides": {
    "postcss": "$postcss"
  }
}
```

This makes npm resolve Next.js' exact internal PostCSS dependency through the patched root PostCSS line.

Observed after lock resolution:

- root PostCSS: `8.5.28`
- nested `node_modules/next/node_modules/postcss`: absent

## Production audit

After B1b:

- total: **3**
- critical: **0**
- high: **0**
- moderate: **3**
- low: 0

The remaining production findings are in the syntax-highlighting chain:

- `react-syntax-highlighter`
- `refractor`
- `prismjs`

These should be handled separately because the available remediation path is a syntax-highlighter major-version change.

## Regression validation

PASS:

- root tests
- workspace builds
- Next.js production build
- Electron/Vite renderer build
- production audit critical/high gate
- Docker build/runtime HTTP smoke

Marker:

`B1B_DOCKER_HTTP_PASS`

## Full dependency graph

The full audit still reports development/build-tooling findings.

Observed during B1b:

- 19 total
- 4 moderate
- 14 high
- 1 critical

This is not hidden by the production result. It is tracked separately because most remaining critical/high findings belong to desktop/build tooling rather than the shipped Next production dependency graph.

## Conclusion

B1b is the preferred dependency-security base for the first ORBI foundation.

It preserves Next.js 15 while meeting the current production gate of:

- 0 critical
- 0 high
