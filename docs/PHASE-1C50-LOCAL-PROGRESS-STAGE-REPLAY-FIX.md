# P1C50 — Local Inference Progress Stage Replay Fix

## Problem

The local inference progress parser retained a 1024-byte tail so progress records split across stdout chunks could be reconstructed.

The parser then re-scanned the full retained tail on every new chunk.

That was mostly hidden by `lastStep` de-duplication while one generation stage kept the same total step count. It breaks when the runtime moves between stages with different totals.

Example:

1. previous stage emits `step 2/2`;
2. next stage emits `step 1/3`;
3. an unrelated chunk such as `writing preview` arrives.

Before P1C50, the unrelated chunk caused the retained tail to be scanned again. The parser could rediscover the old `2/2` and new `1/3` records, reset stage state and replay progress even though no new generation step had completed.

This can make the UI jump between completed and active stages.

## Fix

`extractProgressEvents(text, consumedLength)` now accepts the number of bytes that were already present in the retained tail.

A progress match is emitted only when its match endpoint extends beyond that consumed prefix:

`pattern.lastIndex > consumedLength`

`parseGenerationProgressChunk` passes `state.tail.length` as the consumed prefix.

This retains the old tail for records split across chunks while preventing complete records that existed entirely in the previous buffer from being emitted again.

## Regression coverage

P1C50 adds two cases:

- stage transition `2/2 → 1/3` followed by unrelated stdout does not replay either stage;
- a progress record split as `step 1/` + `20` still resolves to `step 1/20`.

Existing carriage-return parsing and ordinary duplicate suppression remain covered.

## Upstream provenance

The minimal parser algorithm was selectively adopted from upstream PR #346:

`Anil-matcha/Open-Generative-AI#346 — fix: avoid replaying buffered generation stages`

ORBI did not merge or copy the upstream branch. Only the reviewed parser behavior and its regression scenarios were ported onto the ORBI canonical architecture.

## Boundary

P1C50 changes no provider routing, credentials, benchmark evidence, runtime certification, model registry or upstream-governance policy.
