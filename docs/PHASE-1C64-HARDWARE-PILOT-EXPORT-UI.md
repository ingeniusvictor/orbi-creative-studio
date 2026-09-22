# P1C64 — Hardware Pilot Export UI Binding

## Purpose

P1C64 makes the P1C62 → P1C63 real-hardware evidence path operable from Router Diagnostics.

The underlying trust boundaries do not change:

- P1C62 builds and validates the in-memory pilot bundle;
- P1C63 owns the save dialog, destination path, create-only atomic write and final SHA-256 verification;
- P1C64 only exposes the explicit user action and sanitized result.

## Availability

The export control is enabled only when the selected benchmark target has exactly 3/3 captured samples and the session is ready for review.

The P1C62 builder still performs the authoritative check for real P1C31 provenance and matching P1C57 performance sidecars. Fixture-only sessions cannot become exportable real hardware evidence.

## Renderer input

Router Diagnostics supplies only the selected target to the P1C62 bundle builder and the validated P1C62 bundle to window.orbiBenchmark.exportPilotBundle().

It does not provide destination paths, overwrite instructions, arbitrary file contents, or filesystem APIs.

## Sanitized result

After P1C63 verifies the final on-disk SHA-256, Router Diagnostics may display only the exported file basename, SHA-256 and byte count. It never receives the full destination path.

## Authority boundary

P1C64 is an evidence-export UI only. It does not certify profiles, promote runtime certifications, select providers, route generation, authorize cutover, or expose local hardware identity.