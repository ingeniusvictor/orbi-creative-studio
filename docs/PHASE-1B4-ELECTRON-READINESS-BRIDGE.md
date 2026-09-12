# ORBI Creative Studio — Electron Readiness Snapshot Bridge

Status: stacked candidate on P1B.3. Descriptive evidence only; no Studio execution wiring.

## Purpose

Expose one narrow Electron IPC snapshot that lets the renderer observe the evidence already available for Compute Router readiness without gaining new execution authority.

Channel:

- `compute-router:readiness-snapshot`

Preload surface:

- `window.orbiComputeRouter.getReadinessSnapshot()`

## Returned evidence

### sd.cpp

- binary present / absent;
- model ID and download state;
- Z-Image auxiliary state when required;
- sanitized hardware facts used by P1B.3.

No model paths, filenames, download URLs, runtime archive details, or raw hardware command output cross this bridge.

### Wan2GP

- whether configuration exists;
- probe success / failure;
- per-model ready boolean.

The configured LAN endpoint is replaced with the literal token `configured`. Gradio `apiNames`, resolved function names, versions, errors, and endpoint metadata do not cross the bridge.

### MuAPI

Only secure credential readiness crosses:

- secure storage available;
- secure backend accepted;
- secret exists;
- store state.

Backend names, internal reasons, ciphertext and plaintext secrets never cross. There is no independent MuAPI transport-health probe yet, so the bridge deliberately supplies no `transportHealth`; P1B.3 therefore keeps cloud health `unknown`.

## Fail-soft rule

A failed evidence source is omitted rather than converted into invented negative evidence. P1B.3 then preserves `unknown` where facts are unavailable.

The one exception is an actual Wan2GP probe result: a configured endpoint with an explicit failed probe is preserved as `probe.ok = false`, which P1B.3 maps to `offline`.

## Non-goals

This bridge does not:

- route a generation request;
- execute sd.cpp;
- call Wan2GP generation;
- call MuAPI generation;
- read plaintext provider secrets;
- add automatic cloud fallback;
- alter existing Studio execution behavior.

Controlled Studio/Compute Router integration remains a later phase after parity evidence.
