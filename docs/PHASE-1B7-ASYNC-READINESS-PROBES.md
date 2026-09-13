# ORBI Creative Studio — Phase 1B.7 Async Readiness Probes

Status: stacked on P1B.6. Performance/safety hardening before Studio shadow instrumentation.

## Purpose

The original P1C hardware capability probe is synchronous and intentionally bounded, but it invokes up to four external tools. Calling that synchronous probe from the Electron readiness IPC could block the main process while tools time out.

P1B.7 keeps the certified synchronous API for compatibility and adds an asynchronous readiness-specific path.

## Async hardware probe

`probeHardwareCapabilitiesAsync()`:

- uses `execFile`, never a shell;
- keeps the same command allowlist:
  - `nvidia-smi`
  - `nvcc`
  - `vulkaninfo`
  - `rocminfo`
- keeps the same 2.5 second per-command timeout;
- keeps the same bounded output buffer;
- starts all four probes concurrently with `Promise.all`;
- caches the stable hardware readiness snapshot for 5 minutes;
- coalesces concurrent readiness requests;
- preserves the existing hardware snapshot semantics;
- degrades missing/failed tools to unavailable facts instead of throwing.

Because commands run concurrently, readiness is bounded by the slowest command rather than the sum of four serial synchronous waits, while the Electron main event loop remains available.

## Readiness bridge

`providerReadinessSnapshotBridge.js` now awaits a cached wrapper around the async hardware probe. The first collection is non-blocking; subsequent readiness snapshots reuse the cached hardware evidence until the 5-minute TTL expires.

The bridge still:

- validates the trusted sender;
- sanitizes raw hardware evidence before crossing IPC;
- exposes no raw command output;
- does not execute generation;
- does not select a provider.

## Compatibility

The existing synchronous exports remain available:

- `probeCommand()`
- `probeHardwareCapabilities()`

No current consumer is forced to migrate as part of this phase.

## Why this precedes Studio shadow wiring

Shadow instrumentation may request readiness near a generation action. That observation must not introduce a synchronous main-process stall. P1B.7 establishes the non-blocking readiness path before any Studio component invokes the shadow observer.

## Merge gate

Keep stacked until P1B.3–P1B.6 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no steps/logs.
