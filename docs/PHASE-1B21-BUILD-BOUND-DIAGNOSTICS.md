# ORBI Creative Studio — Phase 1B.21 Build-bound Diagnostics

Status: stacked on P1B.20. Read-only diagnostics only.

## Purpose

Expose the exact P1B.19 Electron build identity and the current P1B.20 session build-binding state inside the existing Router Diagnostics panel.

## Displayed build identity

The diagnostics panel now shows:

- application version;
- exact 40-character source commit;
- current session binding state;
- execution authority.

Build identity is read from the static `orbiBuildIdentity` preload metadata through `getRendererBuildIdentity()`.

## Session binding preview

On each diagnostics render, the panel creates an in-memory preview using:

`bindCurrentStudioParitySessionToBuild()`

with:

- current build identity;
- deterministic diagnostics binding ID;
- the same generated timestamp used by the parity diagnostic report.

The preview can report:

- `PARITY_CERTIFICATION_BOUND`;
- `PARITY_CERTIFICATION_REJECTED`.

## Read-only boundary

The preview object is not persisted.

The panel still exposes exactly one action:

`Refresh`

No Save, Clear, Approve, Cutover, Provider, or Fallback action is added.

## Authority visibility

The panel explicitly shows:

`legacy-dispatcher-only`

from the binding contract.

A successful binding is evidence status only and does not grant routing or execution authority.

## Unavailable identity

If P1B.19 build identity is unavailable or invalid, the panel displays unavailable build metadata and a rejected binding state.

It does not invent or infer a commit.

## Privacy

The binding preview uses already-sanitized P1B.9/P1B.10 parity evidence.

No prompts, API keys, media payloads, or provider secrets are displayed.

## Internationalization

Build identity/binding diagnostics labels are added in English and Simplified Chinese.

## Studio isolation

ImageStudio, VideoStudio and `src/main.js` remain unchanged.

## Scope boundary

P1B.21 does not:

- persist parity bindings;
- persist release evidence;
- call CI;
- approve security/rollback;
- create a cutover review bundle;
- change provider selection;
- execute generation;
- authorize cutover.

## Merge gate

Keep stacked until P1B.3–P1B.20 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.