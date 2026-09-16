# ORBI Creative Studio — Phase 1C6 Bounded Local Benchmark Harness

Status: off-path measurement harness candidate. No production resource profile is certified or promoted by this phase.

## Purpose

Execute one explicitly selected local `sd-cli` benchmark run under bounded conditions and emit a P1C5-compatible measurement sample.

P1C6 is measurement infrastructure only. It does not participate in normal generation, provider readiness, routing, or Studio execution.

## Reused execution model

The harness deliberately follows the existing Electron local inference security model:

- Node `spawn()` with `shell: false`;
- `sd-cli` / `sd-cli.exe` only;
- fixed benchmark prompt;
- fixed seed `1`;
- explicit model/backend/resolution context;
- bounded timeout;
- disposable benchmark output;
- no renderer-provided command line.

For NVIDIA measurement it uses only `nvidia-smi` with fixed query arguments and `shell: false`.

## Measurement semantics

### System RAM

P1C6 samples total used system memory as:

`os.totalmem() - os.freemem()`

The highest observation during the run becomes `peakSystemRamMiB`.

This is intentionally conservative: it measures system pressure during the controlled run, not private RSS attribution to the child process. Later certification should therefore use an otherwise stable benchmark host and multiple samples as required by P1C5.

### CUDA12 VRAM

For CUDA12 the harness queries:

`nvidia-smi --query-compute-apps=pid,used_gpu_memory --format=csv,noheader,nounits`

Only rows matching the spawned `sd-cli` PID are accumulated. A CUDA12 run fails closed if no positive target-process VRAM can be measured.

CPU samples require `peakVramMiB: null` and do not invoke `nvidia-smi`.

## Artifact identity

Before execution, P1C6 computes SHA-256 for:

- the selected `sd-cli` runtime binary;
- the selected model artifact.

The emitted P1C5 sample also binds:

- exact source commit;
- runtime identity;
- runtime version;
- model ID;
- backend;
- width/height;
- harness version;
- measurement timestamp.

Z-Image benchmark plans additionally require existing LLM and VAE paths. Their hashes are not yet included in the P1C5 sample schema, so P1C6 does not claim that the sample fully identifies auxiliary artifacts. That remains an explicit evidence gap for a later phase.

## Bounded behavior

Defaults:

- sample interval: 250 ms;
- runtime timeout: 15 minutes;
- maximum allowed timeout: 30 minutes;
- NVIDIA query timeout: 2 seconds;
- NVIDIA output buffer: 128 KiB.

The benchmark output image is treated as disposable scaffolding and is removed in cleanup when present.

## Authority boundary

Every successful result preserves:

- `benchmarkOnly: true`
- `productionProfilePromoted: false`
- `routingEligible: false`
- `cutoverAuthorized: false`
- `executionAuthority: legacy-dispatcher-only`

P1C6 does not import or mutate the P1C4 production resource profile registry.

P1C6 does not call the P1C5 candidate builder automatically. It emits one strict P1C5 sample; collection/review remains explicit.

## Integration boundary

P1C6 is not registered in Electron IPC and is not imported by:

- ImageStudio;
- VideoStudio;
- provider readiness;
- the normal local generation handler;
- the Compute Router execution path.

Therefore merging P1C6 does not make benchmarking remotely triggerable from the renderer and does not alter normal generation behavior.

## Known evidence boundary

The current P1C5 sample schema hashes the primary model artifact but not auxiliary encoder/VAE artifacts. For models requiring auxiliary files, a future evidence-hardening phase should bind those auxiliary hashes before any production resource profile can be certified from such runs.

## Next step

P1C7 should define a benchmark session/evidence bundle that:

1. collects the required minimum of three P1C6 samples;
2. verifies exact context consistency;
3. binds required auxiliary artifact hashes where applicable;
4. passes the samples through P1C5 candidate derivation;
5. remains review-only and does not automatically promote a P1C4 production profile.
