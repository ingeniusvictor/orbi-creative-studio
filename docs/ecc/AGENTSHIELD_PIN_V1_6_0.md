# AgentShield pin record — ORBI Creative Studio P2

Status: REVIEWED PIN / REPORT-ONLY  
Date: 2026-09-20

## Selected scanner

- Repository: `affaan-m/agentshield`
- Package: `ecc-agentshield`
- Declared package version: `1.6.0`
- Release commit: `b0891303bdcd6037376a94263d45cfd2ff3dfb98`
- Reviewed `package.json` blob SHA: `dfdcae0f77ee48f19b643cc15b695b86f5b1b363`
- Reviewed `action.yml` blob SHA at the pinned release: `ba8f95fdf21d1034c4a35c997ac30c85215f43ea`
- License declared by upstream: MIT
- Runtime declared by the pinned action: Node 24

## Workflow dependency pins

- `actions/checkout`: `de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6.0.2)
- `actions/upload-artifact`: `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (v7.0.1)

All workflow actions are pinned to immutable full commit SHAs.

## ORBI execution policy

P2 is intentionally non-enforcing.

- Trigger: manual and agent/ECC configuration pull requests only.
- Permissions: `contents: read`.
- Scan path: repository root.
- Minimum reported severity: low.
- `fail-on-findings: false`.
- `fail-on-supply-chain: false`.
- Scanner step: `continue-on-error: true`.
- Auto-fix: not requested and therefore disabled.
- Online supply-chain lookup: disabled.
- Evidence: SARIF + AgentShield evidence pack, retained for 14 days.
- Product/runtime authority: none.

A finding is evidence for review; it is not permission to mutate files.

## Promotion conditions

AgentShield may become an enforced ORBI gate only after:

1. a baseline scan has run successfully;
2. high/critical findings have been classified as runtime-relevant or false-positive/low-confidence;
3. the false-positive rate is acceptable;
4. a threshold is selected explicitly;
5. the selected scanner pin is reviewed again;
6. enforcement is introduced in a separate PR.

P2 does not satisfy those conditions by itself.
