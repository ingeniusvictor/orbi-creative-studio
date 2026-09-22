const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildBackendPerformanceEvidence,
    performanceEvidenceMatchesSample,
} = require('../electron/lib/backendPerformanceEvidence');

const sample = Object.freeze({
    schemaVersion: 1,
    protocolVersion: 'p1c5-v1',
    runIndex: 1,
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    resolution: Object.freeze({ width: 1024, height: 1024 }),
    harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
    sourceCommit: 'a'.repeat(40),
    runtimeIdentity: 'sd.cpp-cuda12',
    runtimeVersion: 'runtime-v1',
    runtimeBinarySha256: 'b'.repeat(64),
    modelArtifactSha256: 'c'.repeat(64),
    measuredAt: '2026-09-22T00:00:00.000Z',
    peakSystemRamMiB: 12000,
    peakVramMiB: 7000,
});

test('P1C57 builds a detached performance sidecar bound to the resource sample', () => {
    const evidence = buildBackendPerformanceEvidence({
        sample,
        auxiliaryArtifacts: [
            { role: 'llm', sha256: 'd'.repeat(64) },
            { role: 'vae', sha256: 'e'.repeat(64) },
        ],
        durationMs: 4321.5,
    });

    assert.equal(evidence.evidenceType, 'p1c57-backend-performance-observation');
    assert.equal(evidence.durationMs, 4321.5);
    assert.equal(evidence.modelId, sample.modelId);
    assert.equal(evidence.backend, sample.backend);
    assert.equal(evidence.runtimeBinarySha256, sample.runtimeBinarySha256);
    assert.equal(evidence.modelArtifactSha256, sample.modelArtifactSha256);
    assert.equal(performanceEvidenceMatchesSample(evidence, sample), true);
    assert.equal(evidence.benchmarkOnly, true);
    assert.equal(evidence.routingEligible, false);
    assert.equal(evidence.cutoverAuthorized, false);
});

test('P1C57 rejects missing or non-positive duration', () => {
    for (const durationMs of [undefined, null, 0, -1, Number.NaN]) {
        assert.throws(
            () => buildBackendPerformanceEvidence({
                sample,
                auxiliaryArtifacts: [],
                durationMs,
            }),
            /durationMs/,
        );
    }
});

test('P1C57 detects a sidecar context mismatch', () => {
    const evidence = buildBackendPerformanceEvidence({
        sample,
        auxiliaryArtifacts: [],
        durationMs: 100,
    });

    assert.equal(performanceEvidenceMatchesSample({
        ...evidence,
        backend: 'cpu',
    }, sample), false);
});

test('P1C57 sidecar carries no local paths or hardware identity fields', () => {
    const evidence = buildBackendPerformanceEvidence({
        sample,
        auxiliaryArtifacts: [],
        durationMs: 100,
    });
    const serialized = JSON.stringify(evidence);

    for (const forbidden of [
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        'description',
        '/internal/',
        'C:\\',
    ]) {
        assert.equal(serialized.includes(forbidden), false);
    }
});
