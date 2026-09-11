# ORBI Creative Studio — Phase 0 Desktop Packaging Certification

Certification date: 2026-09-11

Certified upstream baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- Electron: `33.4.11`
- electron-builder: `25.1.8`

## Windows x64

Certification run: `34652199783`

Result: **PASS**

The baseline successfully produced an NSIS installer with publishing disabled.

Primary artifact:

- `Open Generative AI Setup 2.0.0.exe`
- size: 166,583,766 bytes
- SHA-256: `8eba54fd1977a361b503e1fffbfb7d97d4795c832298847da8189514e9eb785c`

Update metadata:

- `latest.yml`
- SHA-256: `3d49333185a56ae98127b01ac167a04b3ab83ee8d230ed8633748c856198f353`

Block map:

- `Open Generative AI Setup 2.0.0.exe.blockmap`
- SHA-256: `890dde6dd06be64e0d90e55f2fc32f902392c93a74fb24576a7ed53307d71418`

Unpacked executable:

- `Open Generative AI.exe`
- size: 188,784,128 bytes

### Windows signing status

electron-builder attempted the signing stage but reported:

- no signing info identified
- signing skipped
- `cscInfo=null`

Therefore the baseline can generate a Windows installer, but the installer is **unsigned**.

ORBI public releases should add code signing before distribution.

## Linux x64

Certification run: `34652200572`

Result: **PASS**

### AppImage

- `Open Generative AI-2.0.0.AppImage`
- size: 287,926,416 bytes
- SHA-256: `6af8f9846172fd72492e28aaa011e53bafc63e3d535899590363350ad49407e6`

### Debian package

- `open-generative-ai_2.0.0_amd64.deb`
- size: 168,242,746 bytes
- SHA-256: `50cab4aca512ca535404ad4f4280330a3b8a00426040feb87d5806af2098a310`

Linux unpacked main executable:

- `open-generative-ai`
- size: 186,312,608 bytes

## Important CI finding

Initial packaging attempts failed **after artifacts were already created** because electron-builder detected CI and tried to publish to GitHub without a `GH_TOKEN`.

This was not an application/package build failure.

The certification workflow was corrected to use:

```
--publish never
```

The repeated Windows and Linux packaging runs then completed successfully.

## Interpretation

The pinned baseline is now certified as packageable for:

- Windows x64 / NSIS
- Linux x64 / AppImage
- Linux x64 / Debian package

This does not yet certify:

- actual installation on a user workstation,
- SmartScreen reputation,
- Windows code signing,
- Linux desktop integration across distributions,
- macOS packaging,
- sd.cpp model generation after installation,
- updater behavior against an actual release endpoint.

## ORBI release requirements

Before a public ORBI desktop release:

1. replace upstream branding/package identity,
2. configure ORBI application IDs and update channels,
3. add Windows code signing,
4. review update/publishing configuration,
5. remediate dependency vulnerabilities,
6. test clean install / upgrade / uninstall,
7. test local inference asset download and execution,
8. generate ORBI release hashes and provenance.
