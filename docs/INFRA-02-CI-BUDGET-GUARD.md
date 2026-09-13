# INFRA-02 — GitHub Actions CI Budget Guard

## Problem

Historical phase workflows remained configured with broad `pull_request` triggers targeting `integration/orbi-foundation`.

At 2026-09-12T05:43:26Z, the first P1B.3 PR triggered 9 workflows simultaneously:

1. Compute Router readiness P1B.3
2. Security S3
3. Provider adapters P1B.2
4. Model catalog metadata
5. Security S3B
6. Hardware capability P1C
7. Security S3C
8. Compute Router contracts P1B
9. Security S2

Eight of those were historical validations already integrated into the canonical foundation.

## Change

Remove the broad `pull_request -> integration/orbi-foundation` trigger from the eight historical workflows while retaining their original branch push/manual dispatch triggers.

Add one integrated Ubuntu PR gate for future PRs targeting `integration/orbi-foundation`.

## PR gate coverage

- exact dependency install
- Electron JS syntax
- lint
- all root tests
- workspace builds
- Next build
- Electron renderer build
- production dependency audit

## Full platform certification remains

`orbi-foundation-certification.yml` is unchanged.

After a merge/push to `integration/orbi-foundation`, the full certification still runs:

- Linux core, Docker and desktop smoke
- Windows package/install/launch/uninstall
- macOS x64/arm64 DMG packaging and hashes

## Cost controls

- one integrated Ubuntu job for normal PR validation
- `concurrency.cancel-in-progress: true` for superseded PR commits
- docs/Markdown-only PR changes do not consume the integrated gate
- historical phase workflows remain manually runnable

## Safety

This PR changes CI triggers only. It does not change production code, routing, providers, Studio UI, build identity, security policy, execution authority or cutover behavior.

## Activation gate

Do not merge INFRA-02 until INFRA-01 confirms hosted runners are available and the new PR gate has executed successfully.