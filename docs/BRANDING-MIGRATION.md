# ORBI Creative Studio — Branding and Distribution Migration Inventory

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

This is a migration inventory only. No upstream functional code has been rebranded yet.

## Package / application identity

Root `package.json` currently defines:

- npm package name: `open-generative-ai`
- homepage: upstream GitHub repository
- Electron appId: `ai.generative.open`
- productName: `Open Generative AI`
- copyright: `Copyright © 2025`
- Linux maintainer: `Open Generative AI Team`

These must be intentionally replaced for an ORBI public distribution.

## Installer paths and process names

Windows NSIS custom initialization hardcodes:

- install path: `%LOCALAPPDATA%\Open Generative AI`
- process kill target: `Open Generative AI.exe`

A rebrand must update these together to avoid:

- collisions with upstream installations,
- killing the wrong process,
- installing ORBI over an upstream copy,
- confusing upgrade/uninstall behavior.

## Linux package identity

`scripts/package-linux-deb.js` currently hardcodes:

- package: `open-generative-ai`
- command: `open-generative-ai`
- install directory derived from that package name
- fallback maintainer/product naming

`build/linux/apparmor.profile` also references:

- profile name `open-generative-ai`
- `/opt/Open Generative AI/open-generative-ai`

These are release-critical identity points.

## User-facing names

Observed hard-coded product strings appear in:

- Next metadata / page titles
- Electron window title and error dialog
- `index.html`
- API-key modal
- Agent / Workflow / Studio metadata
- i18n resources
- Studio package descriptions/components
- README and technical documentation

Search found at least 25 indexed source/document occurrences of the exact `Open Generative AI` product phrase.

## External URLs

Observed upstream-specific links include:

- upstream GitHub repository/releases
- `open-generative-ai.com`
- MuAPI marketing/provider links
- upstream custom macOS arm64 sd.cpp binary release

The macOS arm64 local binary is especially important:

`https://github.com/Anil-matcha/Open-Generative-AI/releases/download/v1.0.3-binaries/sd-cli-metal-macos-arm64.zip`

An ORBI rebrand must not casually change this URL until ORBI either:

1. continues to trust/use the upstream binary with explicit provenance, or
2. builds, hashes and publishes its own audited binary.

Branding and binary provenance are separate concerns.

## ORBI target identity — proposed placeholder

Do not apply yet, but reserve a coherent future mapping:

- repository: `ingeniusvictor/orbi-creative-studio`
- product: `ORBI Creative Studio`
- package/command candidate: `orbi-creative-studio`
- desktop executable: `ORBI Creative Studio`
- appId candidate: `com.orbiecosystem.creativestudio`

The final appId/domain should be confirmed before public distribution and then kept stable.

## Migration order

1. Finish Phase 0.
2. Establish ORBI integration/foundation branch.
3. Change package/product/app IDs in one dedicated branding batch.
4. Update installer paths and Linux AppArmor/package identity in same batch.
5. Update UI metadata/i18n.
6. Update icons/assets.
7. Update publisher/update endpoints.
8. Preserve upstream legal attribution independently of product branding.
9. Re-run:
   - Windows package + clean install/uninstall
   - Linux AppImage/DEB package + launch
   - macOS x64/arm64 packaging
   - Docker HTTP smoke

## Do not conflate attribution with branding

The ORBI product can have its own name and identity while still retaining:

- the upstream MIT notice,
- third-party notices,
- source/provenance references.

Removing the upstream brand from the product UI must not remove legal attribution.
