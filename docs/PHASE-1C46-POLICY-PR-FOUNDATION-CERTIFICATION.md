# P1C46 — Policy PR Foundation Certification

## Purpose

P1C46 closes a governance gap discovered after P1C45.

The upstream-policy chain requires a future human policy PR to have both normal PR CI and Foundation certification green before the separate human merge decision. Previously, the Foundation workflow only ran after a push to `integration/orbi-foundation`, which meant the full Windows/Linux/macOS certification could not be obtained on the policy PR before merge.

P1C46 makes that requirement executable.

## Change

`.github/workflows/orbi-foundation-certification.yml` now also runs on pull requests that change the governed upstream policy surface.

The primary production trigger remains:

`push -> integration/orbi-foundation`

The additional pre-merge trigger is scoped to:

- `src/lib/upstreamDriftPolicy.mjs`
- the Foundation workflow itself
- P1C46 validation test/documentation files

## Certification surface

The PR receives the same full Foundation jobs used after canonical promotion:

- Linux core/build/Docker/runtime/desktop certification;
- Windows build/package/install/launch/uninstall certification;
- macOS x64 + arm64 packaging and DMG hash verification.

This is intentionally stronger than the normal integrated PR gate for the narrow policy-advancement path.

## Security boundary

The workflow keeps:

`permissions: contents: read`

It does not receive source-write, pull-request-write, merge, release, or policy-mutation authority.

A green Foundation result is evidence for a later human decision. It is not merge authorization.

## Result

After P1C46, the future human policy PR can satisfy the P1C43/P1C45 requirement in the correct order:

1. human creates the reviewed policy PR;
2. P1C45 validates its envelope;
3. normal integrated CI becomes green;
4. full Foundation certification becomes green on that PR;
5. a person makes the separate merge decision;
6. only after that decision may the policy PR be merged.
