const test = require('node:test');
const assert = require('node:assert/strict');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const SOURCE_COMMIT = 'a'.repeat(40);
const RUNTIME_SHA = 'b'.repeat(64);
const MODEL_SHA = 'c'.repeat(64);
const LLM_SHA = 'd'.repeat(64);
const VAE_SHA = 'e'.repeat(64);

function runEvidence(runIndex, overrides = {}) {
    const sample = {
        schemaVersion: 1,
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: TARGET.modelId,
        backend: TARGET.backend,
        resolution: { width: TARGET.width, height: TARGET.height },
        harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
        sourceCommit: SOURCE_COMMIT,
        runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
        runtimeVersion: 'v-test',
        runtimeBinarySha256: RUNTIME_SHA,
        modelArtifactSha256: MODEL_SHA,
        measuredAt: `2026-09-22T02:0${runIndex}:00.000Z`,
        peakSystemRamMiB: 12000 + runIndex,
        peakVramMiB: 7000 + runIndex,
        ...(overrides.sample || {}),
    };
    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample,
        auxiliaryArtifacts: [
            { role: 'llm', sha256: LLM_SHA },
            { role: 'vae', sha256: VAE_SHA },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

function provenance(runIndex, overrides = {}) {
    return {
        schemaVersion: 1,
        proofType: 'p1c31-real-benchmark-acquisition-proof',
        origin: 'electron-main-controlled-benchmark',
        evidenceClass: 'real-runtime-measurement',
        trustedMainProcess: true,
        runtimeIntegrityVerified: true,
        runtimeManifestPinned: true,
        modelStateResolved: true,
        buildIdentityResolved: true,
        benchmarkProcessExecuted: true,
        fixture: false,
        synthetic: false,
        demo: false,
        context: {
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
            runIndex,
        },
        benchmarkContext: {
            harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
            sourceCommit: SOURCE_COMMIT,
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            runtimeBinarySha256: RUNTIME_SHA,
            modelArtifactSha256: MODEL_SHA,
            auxiliaryArtifacts: [
                { role: 'llm', sha256: LLM_SHA },
                { role: 'vae', sha256: VAE_SHA },
            ],
        },
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...overrides,
    };
}

function performance(runIndex, overrides = {}) {
    const run = runEvidence(runIndex, overrides);
    const sample = run.sample;
    return {
        schemaVersion: 1,
        evidenceType: 'p1c57-backend-performance-observation',
        protocolVersion: sample.protocolVersion,
        runIndex,
        modelId: sample.modelId,
        backend: sample.backend,
        resolution: { ...sample.resolution },
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        auxiliaryArtifacts: run.auxiliaryArtifacts.map((item) => ({ ...item })),
        measuredAt: sample.measuredAt,
        durationMs: 1000 + runIndex * 10,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

async function loadModule() {
    return import('../src/lib/computeRouter/hardwarePilotEvidenceBundle.mjs');
}

function readers({
    runs = [1, 2, 3].map((index) => runEvidence(index)),
    proofs = [1, 2, 3].map((index) => provenance(index)),
    perf = [1, 2, 3].map((index) => performance(index)),
} = {}) {
    return {
        readEvidence: () => runs,
        readProvenance: () => proofs,
        readPerformance: () => perf,
    };
}

test('P1C62 builds an exact three-run real hardware pilot bundle', async () => {
    const mod = await loadModule();
    const result = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers(),
    });

    assert.equal(result.status, 'HARDWARE_PILOT_EVIDENCE_READY');
    assert.equal(result.reason, null);
    assert.equal(result.bundle.evidenceClass, 'real-runtime-hardware-pilot');
    assert.equal(result.bundle.sampleCount, 3);
    assert.deepEqual(result.bundle.runIndexes, [1, 2, 3]);
    assert.equal(result.bundle.runEvidence.length, 3);
    assert.equal(result.bundle.provenance.length, 3);
    assert.equal(result.bundle.performanceEvidence.length, 3);
    assert.equal(result.bundle.performanceEvidence[0].durationMs, 1010);
    assert.equal(result.bundle.benchmarkContext.runtimeBinarySha256, RUNTIME_SHA);
    assert.equal(result.bundle.routingEligible, false);
    assert.equal(result.bundle.cutoverAuthorized, false);
});

test('P1C62 sorts aligned evidence by runIndex before bundling', async () => {
    const mod = await loadModule();
    const result = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers({
            runs: [3, 1, 2].map((index) => runEvidence(index)),
            proofs: [2, 3, 1].map((index) => provenance(index)),
            perf: [3, 2, 1].map((index) => performance(index)),
        }),
    });

    assert.equal(result.status, 'HARDWARE_PILOT_EVIDENCE_READY');
    assert.deepEqual(result.bundle.runEvidence.map((entry) => entry.sample.runIndex), [1, 2, 3]);
    assert.deepEqual(result.bundle.provenance.map((entry) => entry.context.runIndex), [1, 2, 3]);
    assert.deepEqual(result.bundle.performanceEvidence.map((entry) => entry.runIndex), [1, 2, 3]);
});

test('P1C62 rejects incomplete or context-drifted pilot evidence', async () => {
    const mod = await loadModule();

    const incomplete = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers({ perf: [performance(1), performance(2)] }),
    });
    assert.equal(incomplete.status, 'HARDWARE_PILOT_EVIDENCE_REJECTED');
    assert.equal(incomplete.reason, 'HARDWARE_PILOT_SAMPLE_COUNT_INVALID');

    const drift = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers({
            runs: [
                runEvidence(1),
                runEvidence(2, { sample: { runtimeBinarySha256: 'f'.repeat(64) } }),
                runEvidence(3),
            ],
        }),
    });
    assert.equal(drift.status, 'HARDWARE_PILOT_EVIDENCE_REJECTED');
    assert.ok([
        'HARDWARE_PILOT_PROVENANCE_INVALID',
        'HARDWARE_PILOT_PERFORMANCE_INVALID',
        'HARDWARE_PILOT_CONTEXT_DRIFT',
    ].includes(drift.reason));
});

test('P1C62 rejects fixture provenance and malformed performance evidence', async () => {
    const mod = await loadModule();

    const fixture = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers({
            proofs: [provenance(1), provenance(2, { fixture: true }), provenance(3)],
        }),
    });
    assert.equal(fixture.status, 'HARDWARE_PILOT_EVIDENCE_REJECTED');
    assert.equal(fixture.reason, 'HARDWARE_PILOT_PROVENANCE_INVALID');

    const badPerformance = performance(2);
    badPerformance.durationMs = 0;
    const invalidPerf = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers({
            perf: [performance(1), badPerformance, performance(3)],
        }),
    });
    assert.equal(invalidPerf.status, 'HARDWARE_PILOT_EVIDENCE_REJECTED');
    assert.equal(invalidPerf.reason, 'HARDWARE_PILOT_PERFORMANCE_INVALID');
});

test('P1C62 bundle excludes paths, hardware identity, prompts and routing authority', async () => {
    const mod = await loadModule();
    const result = mod.buildHardwarePilotEvidenceBundle({
        target: TARGET,
        ...readers(),
    });

    const serialized = JSON.stringify(result.bundle);
    for (const forbidden of [
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        '"description"',
        '"prompt"',
        'C:\\',
        '/internal/',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `unexpected private field: ${forbidden}`);
    }

    assert.equal(result.bundle.localPathsIncluded, false);
    assert.equal(result.bundle.hardwareIdentityIncluded, false);
    assert.equal(result.bundle.promptContentIncluded, false);
    assert.equal(result.bundle.productionProfilePromoted, false);
    assert.equal(result.bundle.routingEligible, false);
    assert.equal(result.bundle.cutoverAuthorized, false);
});
