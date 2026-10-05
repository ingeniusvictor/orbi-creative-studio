# P1C66 — Hardware Pilot Import UI Binding

## Purpose

P1C66 makes the P1C65 import/review-intake capability explicitly available inside Router Diagnostics without expanding renderer authority.

A user can choose **Import hardware pilot JSON**. The renderer invokes the no-argument P1C65 bridge; Electron Main owns the native file picker, reads the selected bytes, revalidates the P1C62/P1C63 evidence contract, computes the imported-file SHA-256, and retains validated evidence in trusted main-process memory.

## UI architecture

P1C66 adds a small `HardwarePilotImportPanel` as a companion section inside the existing diagnostics panel. Keeping this binding isolated avoids modifying the large Router Diagnostics implementation and reduces regression surface.

The panel is mounted only when:

- local diagnostics are available;
- `window.orbiBenchmark.isElectron` is true; and
- `window.orbiBenchmark.importPilotBundle` is a function.

The renderer calls `importPilotBundle()` with **no arguments**.

## Displayed metadata

After a successful import, the UI accepts only a strictly normalized `HARDWARE_PILOT_IMPORT_REVIEW_READY` result and may display:

- imported basename;
- imported-file SHA-256;
- byte count;
- model/backend/resolution target;
- exactly 3 samples;
- capture window;
- evidence class;
- current-contract revalidation state;
- cryptographic-authenticity status; and
- execution authority.

The panel does not receive or display run evidence, performance evidence, provenance payloads, runtime/model artifact hashes, auxiliary artifact hashes, local filesystem locations, device identity, or prompt content.

## Human-review boundary

Import is not approval.

P1C66 requires:

- `requiresHumanReview: true`;
- `cryptographicAuthenticityVerified: false`;
- `productionProfilePromoted: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`; and
- `executionAuthority: legacy-dispatcher-only`.

A later phase may create a distinct review projection or decision record. P1C66 itself records no certification and grants no production authority.

## Localization

The isolated panel carries governed English and Simplified Chinese copy while continuing to use the application's current locale selection.
