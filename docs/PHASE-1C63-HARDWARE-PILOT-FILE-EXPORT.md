# P1C63 — Explicit Hardware Pilot File Export + SHA-256

## Purpose

P1C63 turns a validated P1C62 hardware-pilot bundle into a user-saved JSON artifact without giving the renderer generic filesystem authority.

## Trust boundary

The renderer may provide only the P1C62 bundle through:

`window.orbiBenchmark.exportPilotBundle(bundle)`

It cannot provide:

- destination path;
- temporary path;
- overwrite flag;
- arbitrary file contents.

Electron main authenticates the IPC sender and rebuilds the export bytes through a strict allowlist serializer.

Injected prompt, API-key, device-name, description or arbitrary fields are not serialized.

## Explicit destination selection

Electron main opens:

`showSaveDialog`

with a generated default filename.

The user explicitly chooses the destination.

The final path is never returned to the renderer. A successful response contains only:

- basename;
- SHA-256;
- byte count;
- non-authorizing boundary fields.

## Create-only atomic promotion

P1C63 refuses an existing destination.

The write sequence is:

1. serialize the validated bundle;
2. compute expected SHA-256;
3. write a unique temp file in the destination directory with `wx`;
4. atomically create the final destination as a hard link to the temp file;
5. remove the temp link;
6. hash the final file;
7. require the final SHA-256 to equal the expected byte hash.

The hard-link promotion fails if another file appears at the chosen destination, avoiding silent overwrite and reducing TOCTOU risk.

## Integrity result

A successful result is:

`HARDWARE_PILOT_EXPORT_WRITTEN`

with:

- `fileName`;
- `sha256`;
- `bytes`.

No exported-file SHA claim is accepted until the final on-disk file has been re-hashed.

## Authority boundary

P1C63:

- does not route generation;
- does not promote a resource profile;
- does not activate the runtime registry;
- does not authorize cutover;
- requires a user save action.

The exported JSON remains evidence for later human review.
