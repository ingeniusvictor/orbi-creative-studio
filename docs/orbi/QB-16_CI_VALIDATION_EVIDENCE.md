# QB-16 — CI Validation Evidence

Status: **CI GREEN — DEPENDENCY-BLOCKED, NOT CERTIFIED FOR MERGE**

Validated branch:

`feature/qb-16-scene3d-electron-pilot-bridge`

Validated HEAD:

`276671e6353b75f787ed6d0c55db03b62e9c6030`

Draft PR:

`#146 — QB-16 Scene3D Electron Pilot Bridge`

GitHub Actions evidence for this exact HEAD:

- **ORBI Pull Request integrated gate** — run 180 — **SUCCESS**
- **ORBI P1C63 Hardware Pilot File Export** — run 29 — **SUCCESS**

The integrated gate validates the repository's canonical CI lane, including dependency installation,
Electron source syntax checks, lint, root tests, workspace builds, Next build, Vite build, and the
production dependency security gate.

## Security hardening included in this validated HEAD

- pilot remains default OFF;
- native Python executable must be an absolute path;
- WSL launcher resolves from trusted `SystemRoot\System32\wsl.exe`;
- sidecar launches with `shell:false`;
- child environment is allowlisted and does not inherit PATH/provider-secret variables;
- malformed JSON/protocol mismatch kills the sidecar process fail-closed;
- renderer never receives raw provider identity/provenance;
- renderer never receives raw reconciliation evidence;
- renderer cannot configure provider, Python, ledger, retries, or reconciliation;
- R2 automatic retry remains disabled;
- Compute Router authority is unchanged;
- MHS actuation remains disabled.

## Remaining dependency gate

QB-16 must **not** be merged into `integration/orbi-foundation` until the lab chain is formally
certified through QB-15.

Required predecessor gates:

- QB-12 certified
- QB-13 certified
- QB-14 certified
- QB-15 certified + live sidecar smoke

This document records CI evidence only; it does not override those dependency gates.

**QB-16 result: CI GREEN — dependency-blocked.**
