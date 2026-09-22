const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const SOURCE_COMMIT = 'a'.repeat(40);
const RUNTIME_SHA = 'b'.repeat(64);
const MODEL_SHA = 'c'.repeat(64);
const LLM_SHA = 'd'.repeat(64);
const VAE_SHA = 'e'.repeat(64);

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

function runEvidence(runIndex, overrides = {}) {
    const sample = {
        schemaVersion: 1,
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: TARGET.modelId,
        backend: TARGET.backend,
        resolution: { width: TARGET.width, height: TARGET.height },
        harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
        sourceCommit: SOURCE_COMMIT,
        runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
        runtimeVersion: 'v-test',
        runtimeBinarySha256: RUNTIME_SHA,
        modelArtifactSha256: MODEL_SHA,
        measuredAt: `2026-09-18T14:3${runIndex}:00.000Z`,
        peakSystemRamMiB: 12000 + runIndex,
        peakVramMiB: 7000 + runIndex,
        ...(overrides.sample || {}),
    };

    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample,
        auxiliaryArtifacts: overrides.auxiliaryArtifacts || [
            { role: 'llm', sha256: LLM_SHA },
            { role: 'vae', sha256: VAE_SHA },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...(overrides.envelope || {}),
    };
}

function readyResult(runIndex, overrides = {}) {
    return {
        status: 'CONTROLLED_BENCHMARK_SAMPLE_READY',
        reason: null,
        runEvidence: runEvidence(runIndex, overrides),
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...(overrides.wrapper || {}),
    };
}

function performanceEvidence(runIndex, overrides = {}) {
    const evidence = runEvidence(runIndex, overrides);
    const sample = evidence.sample;
    return {
        schemaVersion: 1,
        evidenceType: 'p1c57-backend-performance-observation',
        protocolVersion: sample.protocolVersion,
        runIndex: sample.runIndex,
        modelId: sample.modelId,
        backend: sample.backend,
        resolution: { ...sample.resolution },
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        auxiliaryArtifacts: evidence.auxiliaryArtifacts.map((artifact) => ({ ...artifact })),
        measuredAt: sample.measuredAt,
        durationMs: 1500 + runIndex,
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
            harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
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

function realReadyResult(runIndex, overrides = {}) {
    return {
        ...readyResult(runIndex, overrides),
        provenance: provenance(runIndex, overrides.provenance || {}),
        performanceEvidence: performanceEvidence(runIndex, overrides.performance || {}),
    };
}

async function loadModule() {
    return import('../src/lib/computeRouter/userBenchmarkSession.mjs');
}

test('P1C21 captures exactly one benchmark sample per explicit invocation', async () => {
    const benchmarkSession = await loadModule();
    const calls = [];
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => {
                calls.push(request);
                return readyResult(request.runIndex);
            },
        }),
    });

    const first = await session.capture(TARGET);
    assert.equal(first.status, 'USER_BENCHMARK_SESSION_COLLECTING');
    assert.equal(first.sampleCount, 1);
    assert.equal(first.requiredSamples, 3);
    assert.equal(first.readyForReview, false);
    assert.deepEqual(calls, [{ ...TARGET, runIndex: 1 }]);

    const second = await session.capture(TARGET);
    assert.equal(second.status, 'USER_BENCHMARK_SESSION_COLLECTING');
    assert.equal(second.sampleCount, 2);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].runIndex, 2);

    const third = await session.capture(TARGET);
    assert.equal(third.status, 'USER_BENCHMARK_SESSION_READY_FOR_REVIEW');
    assert.equal(third.sampleCount, 3);
    assert.equal(third.readyForReview, true);
    assert.equal(calls.length, 3);
    assert.equal(calls[2].runIndex, 3);
});

test('P1C21 never executes a fourth sample after the exact context reaches 3/3', async () => {
    const benchmarkSession = await loadModule();
    let calls = 0;
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => {
                calls += 1;
                return readyResult(request.runIndex);
            },
        }),
    });

    await session.capture(TARGET);
    await session.capture(TARGET);
    await session.capture(TARGET);
    const fourth = await session.capture(TARGET);

    assert.equal(calls, 3);
    assert.equal(fourth.status, 'USER_BENCHMARK_SESSION_READY_FOR_REVIEW');
    assert.equal(fourth.sampleCount, 3);
});

test('P1C21 rejects forged authority or mismatched sample context without storing evidence', async () => {
    const benchmarkSession = await loadModule();

    const forgedStore = new Map();
    const forged = benchmarkSession.createUserBenchmarkSession({
        sessionStore: forgedStore,
        getBridge: () => ({
            isElectron: true,
            runSample: async () => readyResult(1, {
                wrapper: { routingEligible: true },
            }),
        }),
    });
    assert.equal((await forged.capture(TARGET)).reason, 'USER_BENCHMARK_RESULT_INVALID');
    assert.equal(forged.getState(TARGET).sampleCount, 0);

    const mismatch = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async () => readyResult(1, {
                sample: { modelId: 'z-image-base' },
            }),
        }),
    });
    assert.equal((await mismatch.capture(TARGET)).reason, 'USER_BENCHMARK_CONTEXT_MISMATCH');
    assert.equal(mismatch.getState(TARGET).sampleCount, 0);
});

test('P1C21 detects source/runtime/model/auxiliary drift between accepted samples', async () => {
    const benchmarkSession = await loadModule();

    for (const drift of [
        { sample: { sourceCommit: 'f'.repeat(40) } },
        { sample: { runtimeIdentity: 'different-runtime' } },
        { sample: { runtimeVersion: 'different-version' } },
        { sample: { runtimeBinarySha256: '1'.repeat(64) } },
        { sample: { modelArtifactSha256: '2'.repeat(64) } },
        { auxiliaryArtifacts: [
            { role: 'llm', sha256: '3'.repeat(64) },
            { role: 'vae', sha256: VAE_SHA },
        ] },
    ]) {
        let call = 0;
        const session = benchmarkSession.createUserBenchmarkSession({
            sessionStore: new Map(),
            getBridge: () => ({
                isElectron: true,
                runSample: async (request) => {
                    call += 1;
                    return call === 1 ? readyResult(request.runIndex) : readyResult(request.runIndex, drift);
                },
            }),
        });

        assert.equal((await session.capture(TARGET)).sampleCount, 1);
        const rejected = await session.capture(TARGET);
        assert.equal(rejected.reason, 'USER_BENCHMARK_EVIDENCE_CONTEXT_DRIFT');
        assert.equal(session.getState(TARGET).sampleCount, 1);
    }
});

test('P1C21 keeps benchmark sessions isolated per exact target', async () => {
    const benchmarkSession = await loadModule();
    const other = Object.freeze({
        modelId: 'dreamshaper-8',
        backend: 'cuda12',
        width: 512,
        height: 512,
    });

    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => {
                const evidence = readyResult(request.runIndex);
                evidence.runEvidence.sample.modelId = request.modelId;
                evidence.runEvidence.sample.resolution = { width: request.width, height: request.height };
                evidence.runEvidence.auxiliaryArtifacts = request.modelId === 'dreamshaper-8' ? [] : evidence.runEvidence.auxiliaryArtifacts;
                return evidence;
            },
        }),
    });

    assert.equal((await session.capture(TARGET)).sampleCount, 1);
    assert.equal((await session.capture(other)).sampleCount, 1);
    assert.equal(session.getState(TARGET).sampleCount, 1);
    assert.equal(session.getState(other).sampleCount, 1);
});

test('P1C21 suppresses bridge exceptions and downstream rejection details', async () => {
    const benchmarkSession = await loadModule();

    const throwing = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async () => {
                throw new Error('C:/secret/path API_KEY=secret');
            },
        }),
    });
    const thrown = await throwing.capture(TARGET);
    assert.equal(thrown.reason, 'USER_BENCHMARK_EXECUTION_FAILED');
    assert.equal(JSON.stringify(thrown).includes('secret'), false);

    const rejected = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async () => ({
                status: 'CONTROLLED_BENCHMARK_SAMPLE_REJECTED',
                reason: '<script>private-path</script>',
                runEvidence: null,
                benchmarkOnly: true,
                productionProfilePromoted: false,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            }),
        }),
    });
    const downstream = await rejected.capture(TARGET);
    assert.equal(downstream.reason, 'USER_BENCHMARK_SAMPLE_REJECTED');
    assert.equal(JSON.stringify(downstream).includes('private-path'), false);
});

test('P1C21 rejects absent bridge and overlapping benchmark capture', async () => {
    const benchmarkSession = await loadModule();

    const absent = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => null,
    });
    assert.equal((await absent.capture(TARGET)).reason, 'USER_BENCHMARK_BRIDGE_UNAVAILABLE');

    let release;
    const blocked = new Promise((resolve) => { release = resolve; });
    const active = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => {
                await blocked;
                return readyResult(request.runIndex);
            },
        }),
    });

    const first = active.capture(TARGET);
    const second = await active.capture(TARGET);
    assert.equal(second.reason, 'USER_BENCHMARK_ALREADY_RUNNING');
    release();
    assert.equal((await first).sampleCount, 1);
});

test('P1C21 public state contains no hashes, paths, raw evidence or certification authority', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => readyResult(request.runIndex),
        }),
    });

    await session.capture(TARGET);
    const state = session.getState(TARGET);
    const serialized = JSON.stringify(state);

    for (const forbidden of [
        'sha256',
        'runtimeIdentity',
        'runtimeVersion',
        'measuredAt',
        'peakSystemRamMiB',
        'peakVramMiB',
        'certification',
        'reviewer',
        '/internal/',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `public state leaked: ${forbidden}`);
    }
    assert.equal(state.benchmarkOnly, true);
    assert.equal(state.productionProfilePromoted, false);
    assert.equal(state.routingEligible, false);
    assert.equal(state.cutoverAuthorized, false);
    assert.equal(state.executionAuthority, 'legacy-dispatcher-only');
});

test('P1C21 review evidence reader returns detached frozen envelopes for later review only', async () => {
    const benchmarkSession = await loadModule();
    const store = new Map();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: store,
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => readyResult(request.runIndex),
        }),
    });

    await session.capture(TARGET);
    const firstRead = session.readEvidence(TARGET);
    const secondRead = session.readEvidence(TARGET);

    assert.equal(firstRead.length, 1);
    assert.equal(Object.isFrozen(firstRead), true);
    assert.equal(Object.isFrozen(firstRead[0]), true);
    assert.equal(Object.isFrozen(firstRead[0].sample), true);
    assert.equal(firstRead === secondRead, false);
    assert.equal(firstRead[0] === secondRead[0], false);
    assert.equal(firstRead[0].productionProfilePromoted, false);
    assert.equal(firstRead[0].routingEligible, false);
});

test('P1C31 P1C21 retains trusted benchmark provenance separately from review evidence', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        provenanceStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => realReadyResult(request.runIndex),
        }),
    });

    await session.capture(TARGET);
    await session.capture(TARGET);
    await session.capture(TARGET);

    const provenanceRead = session.readProvenance(TARGET);
    assert.equal(provenanceRead.length, 3);
    assert.deepEqual(provenanceRead.map((item) => item.context.runIndex), [1, 2, 3]);
    assert.equal(Object.isFrozen(provenanceRead), true);
    assert.equal(Object.isFrozen(provenanceRead[0]), true);
    assert.equal(provenanceRead[0].fixture, false);
    assert.equal(provenanceRead[0].trustedMainProcess, true);
    assert.equal(provenanceRead[0].cryptographicAuthenticityVerified, false);

    const reviewEvidence = session.readEvidence(TARGET);
    assert.equal(reviewEvidence.length, 3);
    assert.equal('provenance' in reviewEvidence[0], false);
});

test('P1C31 legacy/fixture-shaped benchmark results remain usable for tests but do not gain real provenance', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        provenanceStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => readyResult(request.runIndex),
        }),
    });

    await session.capture(TARGET);
    await session.capture(TARGET);
    await session.capture(TARGET);

    assert.equal(session.getState(TARGET).sampleCount, 3);
    assert.deepEqual(session.readProvenance(TARGET), []);
});

test('P1C31 rejects malformed or context-mismatched provenance without storing the sample', async () => {
    const benchmarkSession = await loadModule();

    for (const badProvenance of [
        provenance(1, { fixture: true }),
        provenance(1, { synthetic: true }),
        provenance(1, {
            context: {
                modelId: TARGET.modelId,
                backend: TARGET.backend,
                resolution: { width: TARGET.width, height: TARGET.height },
                runIndex: 2,
            },
        }),
    ]) {
        const session = benchmarkSession.createUserBenchmarkSession({
            sessionStore: new Map(),
            provenanceStore: new Map(),
            getBridge: () => ({
                isElectron: true,
                runSample: async () => ({
                    ...readyResult(1),
                    provenance: badProvenance,
                }),
            }),
        });

        const result = await session.capture(TARGET);
        assert.equal(result.status, 'USER_BENCHMARK_SESSION_REJECTED');
        assert.equal(session.getState(TARGET).sampleCount, 0);
        assert.deepEqual(session.readProvenance(TARGET), []);
    }
});

test('P1C21 source remains in-memory, explicit, and non-certifying', () => {
    const source = fs.readFileSync('src/lib/computeRouter/userBenchmarkSession.mjs', 'utf8');

    for (const forbidden of [
        "from 'node:fs'",
        "from 'fs'",
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'setInterval',
        'routeGenerationRequest',
        'certifyResourceProfile',
        'recordResourceProfileCertification',
        'buildBenchmarkSessionEvidence',
        'productionProfilePromoted: true',
        'routingEligible: true',
        'cutoverAuthorized: true',
    ]) {
        assert.equal(source.includes(forbidden), false, `unexpected P1C21 capability: ${forbidden}`);
    }

    assert.ok(source.includes('window.orbiBenchmark'));
    assert.ok(source.includes('USER_BENCHMARK_REQUIRED_SAMPLES = 3'));
    assert.ok(source.includes('productionProfilePromoted: false'));
    assert.ok(source.includes('routingEligible: false'));
    assert.ok(source.includes('cutoverAuthorized: false'));
    assert.ok(source.includes("executionAuthority: 'legacy-dispatcher-only'"));
});


test('P1C61 retains real P1C57 performance sidecars separately from P1C7 review evidence', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        provenanceStore: new Map(),
        performanceStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => realReadyResult(request.runIndex),
        }),
    });

    await session.capture(TARGET);
    await session.capture(TARGET);
    await session.capture(TARGET);

    const performance = session.readPerformance(TARGET);
    assert.equal(performance.length, 3);
    assert.deepEqual(performance.map((entry) => entry.runIndex), [1, 2, 3]);
    assert.deepEqual(performance.map((entry) => entry.durationMs), [1501, 1502, 1503]);
    assert.equal(Object.isFrozen(performance), true);
    assert.equal(Object.isFrozen(performance[0]), true);
    assert.equal(Object.isFrozen(performance[0].resolution), true);
    assert.equal(Object.isFrozen(performance[0].auxiliaryArtifacts), true);
    assert.equal(performance[0].evidenceType, 'p1c57-backend-performance-observation');
    assert.equal(performance[0].routingEligible, false);

    const reviewEvidence = session.readEvidence(TARGET);
    assert.equal(reviewEvidence.length, 3);
    assert.equal('durationMs' in reviewEvidence[0], false);
    assert.equal('performanceEvidence' in reviewEvidence[0], false);
});

test('P1C61 rejects real provenance when performance evidence is missing', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        provenanceStore: new Map(),
        performanceStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => {
                const result = realReadyResult(request.runIndex);
                delete result.performanceEvidence;
                return result;
            },
        }),
    });

    const result = await session.capture(TARGET);
    assert.equal(result.status, 'USER_BENCHMARK_SESSION_REJECTED');
    assert.equal(result.reason, 'USER_BENCHMARK_PERFORMANCE_EVIDENCE_MISSING');
    assert.equal(session.getState(TARGET).sampleCount, 0);
    assert.deepEqual(session.readProvenance(TARGET), []);
    assert.deepEqual(session.readPerformance(TARGET), []);
});

test('P1C61 rejects mismatched performance evidence atomically', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        provenanceStore: new Map(),
        performanceStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => realReadyResult(request.runIndex, {
                performance: {
                    sample: { modelArtifactSha256: 'f'.repeat(64) },
                },
            }),
        }),
    });

    const result = await session.capture(TARGET);
    assert.equal(result.status, 'USER_BENCHMARK_SESSION_REJECTED');
    assert.equal(result.reason, 'USER_BENCHMARK_PERFORMANCE_EVIDENCE_INVALID');
    assert.equal(session.getState(TARGET).sampleCount, 0);
    assert.deepEqual(session.readEvidence(TARGET), []);
    assert.deepEqual(session.readProvenance(TARGET), []);
    assert.deepEqual(session.readPerformance(TARGET), []);
});

test('P1C61 legacy fixture results remain usable without gaining performance evidence', async () => {
    const benchmarkSession = await loadModule();
    const session = benchmarkSession.createUserBenchmarkSession({
        sessionStore: new Map(),
        provenanceStore: new Map(),
        performanceStore: new Map(),
        getBridge: () => ({
            isElectron: true,
            runSample: async (request) => readyResult(request.runIndex),
        }),
    });

    assert.equal((await session.capture(TARGET)).sampleCount, 1);
    assert.deepEqual(session.readPerformance(TARGET), []);
});

test('P1C61 source keeps performance evidence in-memory and non-routing', () => {
    const source = fs.readFileSync('src/lib/computeRouter/userBenchmarkSession.mjs', 'utf8');

    assert.ok(source.includes('const performanceRecords = new Map()'));
    assert.ok(source.includes('readPerformance'));
    assert.ok(source.includes('USER_BENCHMARK_PERFORMANCE_EVIDENCE_MISSING'));
    assert.ok(source.includes('USER_BENCHMARK_PERFORMANCE_EVIDENCE_INVALID'));
    assert.equal(source.includes('performanceStore.set('), true);
    assert.equal(source.includes('routingEligible: true'), false);
    assert.equal(source.includes('cutoverAuthorized: true'), false);
});
