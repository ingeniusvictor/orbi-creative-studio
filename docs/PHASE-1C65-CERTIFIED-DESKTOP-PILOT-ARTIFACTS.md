# P1C65 — Certified Desktop Pilot Artifacts

## Purpose

P1C65 preserves the desktop packages that the Foundation certification already builds and validates so they can be used for real hardware-pilot runs.

Before P1C65, Foundation CI successfully built, installed, launched and uninstalled the Windows package and built/hashed the macOS DMGs, but those package files were discarded when the runner finished.

## Windows artifact

After the existing Windows install/launch/uninstall smoke passes, Foundation writes:

- the generated `Open Generative AI Setup *.exe`;
- `SHA256SUMS-windows.txt`.

The checksum manifest is recomputed from the exact installer that passed the certification job.

The Actions artifact name is bound to the commit:

`orbi-foundation-windows-${{ github.sha }}`

## macOS artifact

After both x64 and arm64 DMGs exist and pass hashing, Foundation retains:

- `Open Generative AI-2.0.0.dmg`;
- `Open Generative AI-2.0.0-arm64.dmg`;
- `SHA256SUMS-macos.txt`.

The artifact is named:

`orbi-foundation-macos-${{ github.sha }}`

## Retention

Artifacts use a 14-day retention period.

They are intended as temporary, commit-bound pilot/certification packages rather than permanent releases.

## Security and publication boundary

P1C65 does not create a GitHub Release and does not publish packages externally.

The Foundation workflow retains:

`permissions: contents: read`

It receives no repository-write, pull-request-write or release-write permission.

Artifact upload occurs only after the existing package/smoke checks inside GitHub Actions.

## Hardware-pilot workflow

With P1C64 and P1C65 together, a real pilot can proceed without a local source build:

1. use a Foundation-certified desktop artifact for the exact canonical SHA;
2. install/run ORBI Creative Studio;
3. select a target in Router Diagnostics;
4. capture three explicit real benchmark samples;
5. export the P1C62 hardware-pilot JSON through the P1C64 UI;
6. retain the JSON filename and verified SHA-256 for later human review.

P1C65 itself grants no routing or cutover authority.
