# P1C19 — Runtime Certification Status Diagnostics

## Purpose

P1C19 makes the P1C18 runtime certification state visible inside Router Diagnostics without exposing the underlying registry, certification records, benchmark evidence, reviewer data or execution controls.

This phase is read-only and adds no new action.

## Sanitized status provider

`getRuntimeCertifiedResourceProfileRegistryStatus()` accepts no arguments and returns only:

- status: ready or unavailable;
- source type;
- certification count;
- source-contract validity;
- `authenticityVerified: false`;
- `routingEligible: false`;
- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

It never returns:

- the P1C9 registry object;
- P1C8 certification records;
- reviewer identity or review notes;
- benchmark samples;
- runtime/model artifact hashes;
- auxiliary artifact evidence;
- arbitrary error messages.

## Router Diagnostics

Router Diagnostics gains a read-only **Runtime certified resource profiles** section.

It shows:

- certification source: source-controlled bundle;
- number of certified profiles loaded;
- source-contract validity;
- whether authenticity is verified.

The current truthful value is **0 certified profiles loaded**.

The UI explains that compatibility can remain unknown until a genuine controlled benchmark and P1C8 human certification are deliberately committed into the P1C18 source.

## UI action boundary

P1C19 adds zero buttons and zero selection handlers.

Router Diagnostics remains at:

- two `.onclick` actions: generic refresh + P1C16 local compatibility refresh;
- one `.onchange`: the P1C17 diagnostic target selector.

P1C19 cannot trigger benchmarking, certification, model execution, routing or cutover.

## Authenticity boundary

A source-controlled certification bundle is a governance mechanism, not cryptographic provenance.

P1C19 intentionally displays authenticity as **not verified**.

It does not upgrade the P1C8 reviewer declaration into a verified identity and does not infer authenticity from Git/source control state.

## Next

At this point the software-side diagnostic chain is capable of:

1. observing real local runtime/model/hardware evidence;
2. selecting the exact diagnostic target;
3. loading only governed P1C8-certified profiles;
4. evaluating compatibility in shadow mode;
5. displaying the result and the certification-source status.

The remaining blocker for a real certified compatibility result is **real benchmark evidence and explicit P1C8 human certification for an actual target**. A later phase can expose a bounded user-initiated benchmark/certification evidence workflow, but it must remain separate from normal generation and must not auto-certify.
