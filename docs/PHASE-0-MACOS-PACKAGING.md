# ORBI Creative Studio — Phase 0 macOS Packaging Certification

Certification date: 2026-09-11

Baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- Electron: `33.4.11`
- electron-builder: `25.1.8`
- certification run: `34653185764`

## Result

**PASS**

The pinned baseline successfully produced both Intel and Apple Silicon DMG packages.

## Intel x64

Artifact:

- `Open Generative AI-2.0.0.dmg`
- size: 223,620,184 bytes
- SHA-256: `de128342cd45a894087532fbeef71370906d06c2ff6ac0cd079a2a247773a2b8`

Block map:

- SHA-256: `cb78ce84e10d28be4521c43bd285765820e008d99dfb561e1581f9a7264fb3e5`

## Apple Silicon arm64

Artifact:

- `Open Generative AI-2.0.0-arm64.dmg`
- size: 216,742,883 bytes
- SHA-256: `8bbc587243a17bebd38bcc44b1f90d237f756e8f254c1f463280e79f12a97553`

Block map:

- SHA-256: `66db849b74598d71467fe16ec08eb7af32559f9c1f3914c85527cb61bf049cb5`

## Signing status

The baseline's `afterPack.js` applies **ad-hoc signing** to the generated application bundles.

The build then reports that no valid Apple `Developer ID Application` identity is configured and skips formal macOS application signing.

Therefore:

- package generation: PASS
- ad-hoc local signature: present
- Apple Developer ID signing: **not configured**
- notarization: **not certified**

## Release implication

The baseline is technically packageable for macOS x64 and arm64, but a public ORBI release should add:

1. ORBI Apple Developer signing identity,
2. hardened-runtime/signing configuration review,
3. Apple notarization,
4. clean-install/Gatekeeper testing,
5. ORBI bundle identifiers and update channel.
