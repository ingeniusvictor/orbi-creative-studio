# P1C65 — Hardware Pilot Evidence Import & Review Intake

## Purpose

P1C65 creates the inverse of the P1C63 export boundary: a user may explicitly select a previously exported ORBI hardware-pilot JSON file and bring it back into the trusted Electron main process for review.

Import does not mean trust.

Every imported file is revalidated against the current P1C62/P1C63 evidence contract before it becomes review-ready.

## Trust boundary

The renderer may call only `window.orbiBenchmark.importPilotBundle()`.

It cannot provide a path, arbitrary file bytes, an expected hash, or a trust flag. Electron main opens the file picker and reads the selected file itself.

## Intake checks

P1C65 requires a `.json` regular file between 1 byte and 8 MiB, valid JSON, a complete current hardware-pilot schema, exact run/provenance/performance context, non-authorizing authority flags, and preserved privacy claims.

The imported bytes receive a fresh SHA-256 computed by Electron main.

## Revalidation

P1C65 reuses the current P1C63 `sanitizeHardwarePilotBundle()` contract. A file is not accepted merely because it resembles an old ORBI export. If current validation rejects its evidence, context, authority or privacy fields, import fails closed.

## Renderer result

The renderer receives only basename, SHA-256, byte count, target, sample count, capture window, evidence class, and review-required/non-authorizing flags. It does not receive raw run evidence, provenance payloads, runtime/model hashes, local paths, hardware/device identity, or prompt content.

## In-memory review store

A validated bundle is retained in Electron main memory keyed by its imported-file SHA-256 for a later explicit review phase. No runtime registry or routing state is modified.

## Authority boundary

P1C65 remains import/review intake only. Cryptographic authenticity remains unverified, production profile promotion remains false, routing eligibility remains false, cutover authorization remains false, and execution authority remains `legacy-dispatcher-only`.
