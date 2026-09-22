# P1C53 — Verified Resumable Local Downloads

## Purpose

P1C53 hardens downloads for ORBI local models, auxiliary files and pinned runtime archives.

Local model files are several gigabytes. The previous downloader resumed by appending to any existing `.part` file based only on its byte count. That could combine bytes from different remote objects if a model asset changed or a redirect resolved to a different object.

## Verified resume contract

A partial download is resumable only when ORBI has:

- a non-empty `.part` file;
- metadata bound to the original normalized source URL;
- a strong ETag;
- an HTTP `206 Partial Content` response;
- the same ETag;
- a valid `Content-Range`;
- a range start equal to the exact current partial size.

The resumed request sends:

- `Range: bytes=<partial-size>-`
- `If-Range: <strong-etag>`

If any identity/range condition does not match, ORBI does not append to the existing partial.

## HTTP 416 recovery

Hugging Face/Xet can return HTTP 416 when the local partial is already complete.

P1C53 handles this by:

1. closing the 416 response;
2. performing canonical HEAD revalidation;
3. requiring the same strong ETag and exact content length;
4. promoting the verified partial to the final destination only when both match;
5. otherwise performing a fresh transactional download.

## Transactional fresh replacement

When an old partial cannot be safely resumed, fresh bytes are written to:

`<destination>.part.fresh`

The existing partial is preserved until the fresh transfer succeeds. Only after success is the fresh object promoted to the final destination and stale partial metadata removed.

## Network robustness

The downloader additionally:

- follows bounded redirects;
- preserves one retry budget across redirects;
- rejects malformed Content-Length/Content-Range;
- validates response byte counts;
- closes streaming redirects/error responses;
- uses an inactivity timeout;
- treats progress-listener failures as non-fatal;
- does not preserve unverifiable partials when a strong ETag is unavailable.

## Cleanup

Deleting a local model now removes:

- final model file;
- `.part`;
- `.part.meta.json`;
- `.part.fresh`.

Temporary pinned-runtime and CUDA-companion downloads also remove all transactional artifacts after their attempt because their generated temp destination changes between installations.

## Provenance

The robust resume strategy was selectively adapted from Open-Generative-AI PR #265.

ORBI adopted the download primitive only. It remains integrated with ORBI's pinned runtime SHA-256 verification, CUDA companion verification and existing Electron IPC architecture.
