# P1C62 — Hardware Pilot Evidence Bundle

## Purpose

P1C62 turns one completed real user benchmark session into a deterministic, JSON-ready hardware-pilot evidence bundle.

It is the first phase designed specifically for carrying real benchmark evidence out of the in-memory session without losing the P1C57 performance observations added to the session in P1C61.

## Required evidence

A bundle is accepted only when the exact target has:

- exactly 3 P1C7 run envelopes;
- exactly 3 P1C31 real acquisition proofs;
- exactly 3 P1C57 performance observations;
- run indexes exactly 1, 2 and 3;
- one unchanged model/backend/resolution/runtime/model/auxiliary context.

Every P1C31 proof must still state:

- real runtime measurement;
- trusted Electron main process;
- pinned runtime;
- verified runtime integrity;
- benchmark process executed;
- fixture = false;
- synthetic = false;
- demo = false.

Every P1C57 sidecar must match its P1C7 sample exactly.

## Deterministic ordering

Inputs are normalized into run-index order:

`1 → 2 → 3`

The bundle derives its capture window from the sample measurement timestamps rather than adding a new current-time field.

## Privacy boundary

The bundle rejects serialized evidence containing:

- binary paths;
- model paths;
- output directories;
- exact backend device names;
- device descriptions;
- prompt content;
- obvious local path markers.

It explicitly records:

- `localPathsIncluded: false`;
- `hardwareIdentityIncluded: false`;
- `promptContentIncluded: false`.

## Authority boundary

P1C62 remains evidence only:

- pilot evidence only;
- requires human review;
- production profile promoted = false;
- routing eligible = false;
- cutover authorized = false;
- execution authority = `legacy-dispatcher-only`.

It does not write a file.

## Next

A later explicit export phase may serialize this validated bundle to disk through a narrow user-initiated flow and bind the exported bytes to a SHA-256 digest.
