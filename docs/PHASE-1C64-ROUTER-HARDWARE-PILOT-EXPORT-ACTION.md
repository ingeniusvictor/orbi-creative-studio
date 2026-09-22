# P1C64 — Router Diagnostics Hardware Pilot Export Action

## Purpose

P1C64 exposes the governed P1C62/P1C63 hardware-pilot export flow as one explicit user action inside Router Diagnostics.

The UI does not gain direct filesystem or IPC authority.

## Wiring

`SettingsModal` injects:

`exportUserHardwarePilotEvidence`

into `RouterDiagnosticsPanel` as:

`hardwarePilotExport`

This follows the existing dependency-injection pattern used by benchmark capture, review, certification and promotion actions.

Router Diagnostics never references `window.orbiBenchmark` directly.

## Availability

The export button is enabled only when the exact selected benchmark target reports:

`readyForReview: true`

which means the P1C21 session has captured all three exact-context samples.

The action then requires P1C62 to successfully build a real hardware-pilot bundle. Therefore a nominal 3/3 fixture session cannot become a real export unless the required P1C31 provenance and P1C57 performance evidence also exist.

## Explicit action

The user clicks:

`Export hardware pilot evidence`

The renderer action:

1. validates the selected target;
2. builds the P1C62 bundle;
3. resolves the narrow Electron benchmark bridge;
4. invokes only `exportPilotBundle(bundle)`;
5. validates the sanitized P1C63 response.

P1C63 remains responsible for the save dialog, destination policy, write, atomic promotion and final file hash.

## UI result

After a successful export, Router Diagnostics renders only:

- exported basename;
- byte count;
- verified SHA-256.

It never renders or receives the full destination path.

Cancellation is a separate normal state and is not presented as a successful write.

## Privacy and authority boundary

P1C64 does not expose:

- filesystem paths;
- model/runtime paths;
- device identity;
- prompt content;
- generic IPC;
- generic filesystem APIs.

The action remains:

- export-only;
- production profile promoted = false;
- routing eligible = false;
- cutover authorized = false;
- execution authority = `legacy-dispatcher-only`.

Exporting pilot evidence does not certify a profile or activate routing.
