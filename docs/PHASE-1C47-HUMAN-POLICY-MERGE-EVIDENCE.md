# P1C47 — Human Policy Merge Evidence Packet

## Purpose

P1C47 assembles the final evidence required before a person decides whether to merge a reviewed upstream baseline policy PR.

It connects the governance chain to the real GitHub validation evidence enabled by P1C46.

## Required inputs

- valid P1C45 policy PR envelope validation;
- exact policy PR head commit SHA;
- successful `ORBI Pull Request integrated gate` run bound to that SHA;
- successful pre-merge `ORBI Foundation integrated certification` run bound to that SHA;
- successful Foundation jobs:
  - `core-linux`
  - `windows-desktop`
  - `macos-package`

A canonical post-merge Foundation run is not accepted as a substitute. P1C47 specifically requires `event = pull_request`.

## State

When all evidence is present and bound to the same PR head, the packet state is:

`READY_FOR_HUMAN_MERGE_DECISION`

This means the technical evidence is complete.

It does not authorize a merge.

## Boundary

P1C47 always keeps:

- policy mutation authority = false;
- automatic merge authority = false;
- `mergeAllowed = false`;
- separate human merge decision = required.

The next possible phase may validate a human merge-decision record, but the actual merge remains a separately authorized repository action.
