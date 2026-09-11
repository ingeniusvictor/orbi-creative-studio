# ORBI Creative Studio — Phase 0 Windows Install and Launch Certification

Certification date: 2026-09-11

Baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- target: Windows x64 / NSIS
- strengthened run: `34653795248`
- successful rerun attempt: 2

## Result

**PASS**

The exact pinned baseline completed the following on a clean Windows GitHub runner:

1. dependency/workspace build,
2. NSIS installer creation,
3. silent installation,
4. installed-resource verification,
5. installed desktop application launch,
6. 10-second process stability window,
7. forced smoke-test shutdown,
8. silent uninstallation.

## Installation evidence

Install path:

`C:\Users\runneradmin\AppData\Local\Open Generative AI`

Verified:

- `Open Generative AI.exe`
- `resources\app.asar`

Marker:

`SILENT_INSTALL_PASS`

## Desktop launch evidence

The installed executable was launched and remained alive through the 10-second smoke window.

Marker:

`WINDOWS_DESKTOP_LAUNCH_SMOKE_PASS`

Observed process ID in the successful run:

`3596`

## Uninstall evidence

Silent uninstaller completed with exit code 0.

Marker:

`SILENT_UNINSTALL_EXIT_0`

## Transient first-attempt failure

Attempt 1 of the strengthened workflow failed during silent install with Windows status:

`-1073741819` / `0xC0000005`

The job was rerun unchanged on a fresh runner.

Attempt 2 completed the full install -> launch -> uninstall sequence successfully.

Classification:

**non-reproducible CI/installer transient at this stage**

It should not be treated as a confirmed application defect, but the event is preserved as evidence rather than hidden.

If this status appears again on real Windows machines or future CI runs, it should be reopened as a reproducibility defect.

## What remains for public Windows release

- ORBI branding/app identity,
- code signing,
- SmartScreen/reputation testing,
- upgrade-over-existing-version path,
- local inference download/generation after installation,
- interactive UI acceptance on a user workstation.
