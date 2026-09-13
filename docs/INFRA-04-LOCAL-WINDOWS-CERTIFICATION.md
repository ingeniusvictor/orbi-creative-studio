# INFRA-04 — Local Windows Certification

## Purpose

Provide reproducible local Windows evidence while GitHub-hosted Actions runner allocation is unavailable.

This is a **supplemental** certification path. It does not replace the required hosted Linux/macOS/Windows matrix and it never authorizes Compute Router cutover.

## Script

`scripts/certify-local-windows.ps1`

The script records:

- exact 40-character Git commit;
- branch;
- whether the working tree is clean;
- Git / Node / npm / PowerShell versions;
- each certification step and duration;
- overall PASS/FAIL;
- production npm audit JSON;
- optional Windows installer hash;
- SHA-256 sidecar for the final local certification report.

Default report location:

`%USERPROFILE%\ORBI-Certification\<UTC timestamp>-<short SHA>\`

Nothing is written into the repository by default.

## Default certification

From a clean checkout:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\certify-local-windows.ps1
```

The default path executes:

1. Git submodule state check;
2. `npm ci`;
3. Electron JavaScript syntax checks;
4. deterministic lint;
5. every root `tests/*.test.js`;
6. workspace builds;
7. Next build;
8. Electron renderer build;
9. production dependency security audit.

## Optional Windows packaging

To additionally create and hash the Windows NSIS installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\certify-local-windows.ps1 -PackageWindows
```

This packages the installer but **does not install, launch or uninstall it**.

The generated package evidence is stored as `windows-package.json`.

## Clean working tree requirement

By default the script fails before certification if `git status --porcelain` is non-empty.

This binds evidence to a reproducible committed source state.

`-AllowDirty` exists only for diagnostics and marks the resulting report as:

`certifying: false`

Such a report must not be used as merge evidence.

## Skip npm ci

`-SkipNpmCi` is available for iterative diagnostics, but merge-grade evidence should run the default exact dependency installation.

## Security boundaries

The script:

- does not read provider secrets;
- does not call MuAPI generation;
- does not route Studio generations;
- does not modify Git branches;
- does not commit/push;
- does not install the packaged application;
- does not authorize cutover.

Every report states:

- `hostedMatrixReplaced: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

## Use during INFRA-01

While GitHub-hosted runners remain blocked, local reports can catch real test/build regressions before we spend additional CI attempts.

After Actions recovers, every P1B merge still requires real GitHub Actions evidence according to CERT-01.
