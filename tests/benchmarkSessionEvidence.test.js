const test = require('node:test');
const assert = require('node:assert/strict');
const { captureBenchmarkRunEvidence } = require('../electron/lib/benchmarkRunEvidence');

async function sessionModule() {
    return import('../src/lib/computeRouter/benchmarkSessionEvidence.mjs');
}

function sample(runIndex, overrides = {}) {
    return {
        schemaVersion: 1,
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        resolution: { width: 1024, height: 1024 },
        harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
        sourceCommit: 'a'.repeat(40),
        runtimeIdentity: 'sd.cpp-cuda12',
        runtimeVersion: 'runtime-v1',
        runtimeBinarySha256: 'b'.repeat(64),
        modelArtifactSha256: 'c'.repeat(64),
        measuredAt: `2026-09-16T03:00:0${runIndex}.000Z`,
        peakSystemRamMiB: 8000 + (runIndex * 100),
        peakVramMiB: 6000 + (runIndex * 100),
        ...overrides,
    };
}

function runEvidence(runIndex, overrides = {}) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample: sample(runIndex),
        auxiliaryArtifacts: [
            { role: 'llm', sha256: 'd'.repeat(64) },
            { role: 'vae', sha256: 'e'.repeat(64) },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...overrides,
    };
}

test('P1C7 run capture binds auxiliary hashes around a P1C6 benchmark result', async () => {
    const plan = {
        modelType: 'z-image',
        llmPath: '/models/llm.gguf',
        vaePath: '/models/vae.safetensors',
    };
    const evidence = await captureBenchmarkRunEvidence(plan, {
        sha256FileImpl: async (filePath) => (
            filePath === plan.llmPath ? 'd'.repeat(64) : 'e'.repeat(64)
        ),
        runLocalBenchmarkImpl: async () => ({
            sample: sample(1),
            benchmarkOnly: true,
            productionProfilePromoted: false,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
    });

    assert.equal(evidence.evidenceType, 'p1c7-benchmark-run-evidence');
    assert.deepEqual(evidence.auxiliaryArtifacts, [
        { role: 'llm', sha256: 'd'.repeat(64) },
        { role: 'vae', sha256: 'e'.repeat(64) },
    ]);
    assert.equal(evidence.productionProfilePromoted, false);
    assert.equal(evidence.routingEligible, false);
});

test('P1C7 session bundles three exact-context runs into a review-only P1C5 candidate', async () => {
    const { buildBenchmarkSessionEvidence } = await sessionModule();
    const result = buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_SESSION_READY_FOR_REVIEW');
    assert.equal(result.evidenceBundle.status, 'review-only');
    assert.equal(result.evidenceBundle.runCount, 3);
    assert.deepEqual(result.evidenceBundle.runIndexes, [1, 2, 3]);
    assert.deepEqual(result.evidenceBundle.auxiliaryArtifacts, [
        { role: 'llm', sha256: 'd'.repeat(64) },
        { role: 'vae', sha256: 'e'.repeat(64) },
    ]);
    assert.equal(result.evidenceBundle.candidate.status, 'benchmark-candidate');
    assert.equal(result.evidenceBundle.candidate.requiresHumanCertification, true);
    assert.equal(result.productionProfilePromoted, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
});

test('Z-Image session fails closed if auxiliary evidence is incomplete', async () => {
    const { buildBenchmarkSessionEvidence } = await sessionModule();
    const bad = runEvidence(2, {
        auxiliaryArtifacts: [{ role: 'llm', sha256: 'd'.repeat(64) }],
    });
    const result = buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), bad, runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_SESSION_INVALID');
    assert.equal(result.reason, 'RUN_AUXILIARY_EVIDENCE_INCOMPLETE');
});

test('session rejects auxiliary artifact drift between benchmark runs', async () => {
    const { buildBenchmarkSessionEvidence } = await sessionModule();
    const drifted = runEvidence(3, {
        auxiliaryArtifacts: [
            { role: 'llm', sha256: 'f'.repeat(64) },
            { role: 'vae', sha256: 'e'.repeat(64) },
        ],
    });
    const result = buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), drifted],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_SESSION_INVALID');
    assert.equal(result.reason, 'SESSION_AUXILIARY_CONTEXT_MISMATCH');
});

test('session rejects forged routing/cutover authority', async () => {
    const { buildBenchmarkSessionEvidence } = await sessionModule();
    const forged = runEvidence(2, { cutoverAuthorized: true });
    const result = buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), forged, runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_SESSION_INVALID');
    assert.equal(result.reason, 'RUN_EVIDENCE_AUTHORITY_INVALID');
});

test('non-auxiliary model session requires empty auxiliary evidence', async () => {
    const { buildBenchmarkSessionEvidence } = await sessionModule();
    const classicRun = (runIndex) => runEvidence(runIndex, {
        sample: sample(runIndex, {
            modelId: 'dreamshaper-8',
            resolution: { width: 512, height: 512 },
            modelArtifactSha256: '9'.repeat(64),
        }),
        auxiliaryArtifacts: [],
    });

    const result = buildBenchmarkSessionEvidence({
        runEvidence: [classicRun(1), classicRun(2), classicRun(3)],
        safetyMarginPct: 15,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_SESSION_READY_FOR_REVIEW');
    assert.deepEqual(result.evidenceBundle.auxiliaryArtifacts, []);
});

test('P1C7 evidence bundle still cannot resolve as a P1C4 certified production profile', async () => {
    const { buildBenchmarkSessionEvidence } = await sessionModule();
    const profiles = await import('../src/lib/computeRouter/modelResourceProfiles.mjs');
    const result = buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });

    const resolved = profiles.resolveCertifiedResourceRequirements({
        profile: result.evidenceBundle.candidate,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });

    assert.notEqual(resolved.status, 'RESOURCE_PROFILE_CERTIFIED');
    assert.equal(result.evidenceBundle.productionProfilePromoted, false);
});
