const test = require('node:test');
const assert = require('node:assert/strict');

async function benchmark() {
    return import('../src/lib/computeRouter/controlledBenchmark.mjs');
}

function sample(runIndex, overrides = {}) {
    return {
        schemaVersion: 1,
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        resolution: { width: 1024, height: 1024 },
        harnessVersion: 'orbi-benchmark-harness-0.1.0',
        sourceCommit: 'a'.repeat(40),
        runtimeIdentity: 'sd.cpp-cuda12',
        runtimeVersion: 'synthetic-test-runtime',
        runtimeBinarySha256: 'b'.repeat(64),
        modelArtifactSha256: 'c'.repeat(64),
        measuredAt: `2026-09-16T00:00:0${runIndex}.000Z`,
        peakSystemRamMiB: 8000 + (runIndex * 100),
        peakVramMiB: 6000 + (runIndex * 100),
        ...overrides,
    };
}

test('controlled benchmark accepts strict CUDA12 sample evidence', async () => {
    const { validateControlledBenchmarkSample } = await benchmark();
    assert.deepEqual(validateControlledBenchmarkSample(sample(1)), { ok: true, reason: null });
});

test('controlled benchmark rejects unexpected fields and weak evidence', async () => {
    const { validateControlledBenchmarkSample } = await benchmark();

    assert.equal(validateControlledBenchmarkSample({ ...sample(1), extra: true }).ok, false);
    assert.equal(validateControlledBenchmarkSample(sample(1, { sourceCommit: 'short' })).ok, false);
    assert.equal(validateControlledBenchmarkSample(sample(1, { runtimeBinarySha256: 'bad' })).ok, false);
    assert.equal(validateControlledBenchmarkSample(sample(1, { modelArtifactSha256: 'bad' })).ok, false);
    assert.equal(validateControlledBenchmarkSample(sample(1, { peakVramMiB: 0 })).ok, false);
});

test('CPU samples require null VRAM and CUDA12 samples require measured VRAM', async () => {
    const { validateControlledBenchmarkSample } = await benchmark();

    const cpu = sample(1, { backend: 'cpu', peakVramMiB: null });
    assert.equal(validateControlledBenchmarkSample(cpu).ok, true);
    assert.equal(validateControlledBenchmarkSample({ ...cpu, peakVramMiB: 256 }).ok, false);
    assert.equal(validateControlledBenchmarkSample(sample(1, { peakVramMiB: null })).ok, false);
});

test('candidate requires at least three exact-context samples', async () => {
    const { buildResourceCertificationCandidate } = await benchmark();

    const tooFew = buildResourceCertificationCandidate({
        samples: [sample(1), sample(2)],
        safetyMarginPct: 20,
        evaluatedAt: '2026-09-16T01:00:00.000Z',
    });
    assert.equal(tooFew.status, 'BENCHMARK_CANDIDATE_INVALID');
    assert.equal(tooFew.reason, 'BENCHMARK_SAMPLE_COUNT_INSUFFICIENT');

    const mismatch = buildResourceCertificationCandidate({
        samples: [sample(1), sample(2), sample(3, { runtimeVersion: 'different-runtime' })],
        safetyMarginPct: 20,
        evaluatedAt: '2026-09-16T01:00:00.000Z',
    });
    assert.equal(mismatch.status, 'BENCHMARK_CANDIDATE_INVALID');
    assert.equal(mismatch.reason, 'BENCHMARK_CONTEXT_MISMATCH');
});

test('candidate rejects duplicate run indexes', async () => {
    const { buildResourceCertificationCandidate } = await benchmark();
    const result = buildResourceCertificationCandidate({
        samples: [sample(1), sample(2), sample(2, { measuredAt: '2026-09-16T00:00:03.000Z' })],
        safetyMarginPct: 20,
        evaluatedAt: '2026-09-16T01:00:00.000Z',
    });
    assert.equal(result.status, 'BENCHMARK_CANDIDATE_INVALID');
    assert.equal(result.reason, 'BENCHMARK_DUPLICATE_RUN_INDEX');
});

test('candidate derives conservative requirements from observed maxima plus declared margin', async () => {
    const { buildResourceCertificationCandidate } = await benchmark();
    const result = buildResourceCertificationCandidate({
        samples: [
            sample(1, { peakSystemRamMiB: 8000, peakVramMiB: 6000 }),
            sample(2, { peakSystemRamMiB: 8500, peakVramMiB: 6200 }),
            sample(3, { peakSystemRamMiB: 8200, peakVramMiB: 6100 }),
        ],
        safetyMarginPct: 20,
        evaluatedAt: '2026-09-16T01:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_CANDIDATE_READY_FOR_REVIEW');
    assert.deepEqual(result.certificationCandidate.recommendation.requirements, {
        minSystemRamMiB: 10200,
        minVramMiB: 7440,
    });
    assert.equal(result.certificationCandidate.observations.sampleCount, 3);
    assert.equal(result.certificationCandidate.requiresHumanCertification, true);
    assert.equal(result.certificationCandidate.productionProfilePromoted, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
});

test('CPU candidate omits VRAM recommendation', async () => {
    const { buildResourceCertificationCandidate } = await benchmark();
    const cpuSamples = [1, 2, 3].map((runIndex) => sample(runIndex, {
        backend: 'cpu',
        peakVramMiB: null,
        runtimeIdentity: 'sd.cpp-cpu',
        runtimeBinarySha256: 'd'.repeat(64),
    }));

    const result = buildResourceCertificationCandidate({
        samples: cpuSamples,
        safetyMarginPct: 10,
        evaluatedAt: '2026-09-16T01:00:00.000Z',
    });

    assert.equal(result.status, 'BENCHMARK_CANDIDATE_READY_FOR_REVIEW');
    assert.equal('minVramMiB' in result.certificationCandidate.recommendation.requirements, false);
});

test('benchmark candidate does not become a P1C4 certified profile automatically', async () => {
    const { buildResourceCertificationCandidate } = await benchmark();
    const profiles = await import('../src/lib/computeRouter/modelResourceProfiles.mjs');

    const result = buildResourceCertificationCandidate({
        samples: [sample(1), sample(2), sample(3)],
        safetyMarginPct: 20,
        evaluatedAt: '2026-09-16T01:00:00.000Z',
    });

    const resolved = profiles.resolveCertifiedResourceRequirements({
        profile: result.certificationCandidate,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });

    assert.notEqual(resolved.status, 'RESOURCE_PROFILE_CERTIFIED');
    assert.equal(result.certificationCandidate.productionProfilePromoted, false);
});
