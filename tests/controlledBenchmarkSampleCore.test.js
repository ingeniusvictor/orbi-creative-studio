const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
    CONTROLLED_BENCHMARK_SAMPLE_STATUS,
    createControlledBenchmarkSampleRunner,
    getControlledBenchmarkTargets,
    validateBenchmarkRequest,
} = require('../electron/lib/controlledBenchmarkSampleCore');

const SOURCE_COMMIT = 'a'.repeat(40);
const RUNTIME_SHA = 'b'.repeat(64);
const MODEL_SHA = 'c'.repeat(64);
const LLM_SHA = 'd'.repeat(64);
const VAE_SHA = 'e'.repeat(64);

function fakeFs() {
    return {
        existsSync: () => true,
        statSync: () => ({ isDirectory: () => true }),
    };
}

function binaryStatus(backend = 'cuda12') {
    return {
        exists: true,
        path: '/internal/bin/sd-cli',
        dataDir: '/internal/local-ai',
        modelsDir: '/internal/local-ai/models',
        runtime: {
            backend,
            manifestPinned: true,
            assetName: 'stable-diffusion.cpp-win-cuda12.zip',
            release: 'v-test',
            upstreamCommit: 'runtime-commit',
        },
        installationIntegrity: {
            integrityVerified: true,
        },
        backendActivation: {
            verified: true,
            selectedDeviceName: backend === 'cuda12' ? 'CUDA0' : 'CPU',
        },
    };
}

function installedZImage() {
    return [{
        id: 'z-image-turbo',
        state: 'downloaded',
        path: '/internal/local-ai/models/z_image_turbo-Q4_K.gguf',
        auxiliaryStatus: {
            llm: 'downloaded',
            vae: 'downloaded',
        },
    }];
}

function benchmarkResult(plan) {
    return Object.freeze({
        sample: Object.freeze({
            schemaVersion: 1,
            protocolVersion: 'p1c5-v1',
            runIndex: plan.runIndex,
            modelId: plan.modelId,
            backend: plan.backend,
            resolution: Object.freeze({ width: plan.width, height: plan.height }),
            harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
            sourceCommit: plan.sourceCommit,
            runtimeIdentity: plan.runtimeIdentity,
            runtimeVersion: plan.runtimeVersion,
            runtimeBinarySha256: RUNTIME_SHA,
            modelArtifactSha256: MODEL_SHA,
            measuredAt: '2026-09-18T14:30:00.000Z',
            peakSystemRamMiB: 12000,
            peakVramMiB: plan.backend === 'cuda12' ? 7000 : null,
        }),
        runtimeDurationMs: 1500,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function makeRunner(overrides = {}) {
    return createControlledBenchmarkSampleRunner({
        getBinaryStatus: async () => binaryStatus(),
        listModels: async () => installedZImage(),
        getBuildIdentity: () => ({
            schemaVersion: 1,
            available: true,
            sourceCommit: SOURCE_COMMIT,
            appVersion: '2.0.0',
            reason: null,
        }),
        runLocalBenchmark: async (plan) => benchmarkResult(plan),
        sha256File: async (filePath) => filePath.endsWith('ae.safetensors') ? VAE_SHA : LLM_SHA,
        fsImpl: fakeFs(),
        ...overrides,
    });
}

test('P1C20 request accepts only exact controlled target fields', () => {
    assert.equal(validateBenchmarkRequest({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
        runIndex: 1,
    }).ok, true);

    for (const injected of [
        { binaryPath: 'C:/attacker/sd-cli.exe' },
        { modelPath: 'C:/attacker/model.gguf' },
        { outputDir: 'C:/attacker' },
        { sourceCommit: SOURCE_COMMIT },
        { command: 'powershell' },
    ]) {
        const result = validateBenchmarkRequest({
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 1024,
            height: 1024,
            runIndex: 1,
            ...injected,
        });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'BENCHMARK_REQUEST_SHAPE_INVALID');
    }

    assert.equal(validateBenchmarkRequest({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 512,
        height: 512,
        runIndex: 1,
    }).reason, 'BENCHMARK_TARGET_UNSUPPORTED');

    assert.equal(validateBenchmarkRequest({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
        runIndex: 4,
    }).reason, 'BENCHMARK_RUN_INDEX_INVALID');
});

test('P1C20 target catalog stays aligned with P1C4 default targets', async () => {
    const profiles = await import('../src/lib/computeRouter/modelResourceProfiles.mjs');
    assert.deepEqual(
        getControlledBenchmarkTargets().map((target) => ({
            modelId: target.modelId,
            width: target.width,
            height: target.height,
        })),
        profiles.DEFAULT_PROFILE_TARGETS.map((target) => ({ ...target })),
    );
});

test('P1C20 emits a valid P1C7 run envelope without exposing internal paths', async () => {
    let receivedPlan = null;
    const runner = makeRunner({
        runLocalBenchmark: async (plan) => {
            receivedPlan = plan;
            return benchmarkResult(plan);
        },
    });

    const result = await runner.runSample({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
        runIndex: 1,
    });

    assert.equal(result.status, CONTROLLED_BENCHMARK_SAMPLE_STATUS.READY);
    assert.equal(result.reason, null);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.productionProfilePromoted, false);
    assert.equal(receivedPlan.binaryPath, '/internal/bin/sd-cli');
    assert.equal(receivedPlan.modelPath.includes('/internal/'), true);
    assert.equal(receivedPlan.sourceCommit, SOURCE_COMMIT);
    assert.equal(receivedPlan.backendDeviceName, 'CUDA0');

    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('/internal/'), false);
    assert.equal(serialized.includes('binaryPath'), false);
    assert.equal(serialized.includes('modelPath'), false);
    assert.deepEqual(result.runEvidence.auxiliaryArtifacts, [
        { role: 'llm', sha256: LLM_SHA },
        { role: 'vae', sha256: VAE_SHA },
    ]);
    assert.equal(Object.hasOwn(result.runEvidence, 'performanceEvidence'), false);
    assert.equal(result.performanceEvidence.evidenceType, 'p1c57-backend-performance-observation');
    assert.equal(result.performanceEvidence.durationMs, 1500);
    assert.equal(result.performanceEvidence.modelId, 'z-image-turbo');
    assert.equal(result.performanceEvidence.backend, 'cuda12');
    assert.deepEqual(result.performanceEvidence.auxiliaryArtifacts, [
        { role: 'llm', sha256: LLM_SHA },
        { role: 'vae', sha256: VAE_SHA },
    ]);

    assert.equal(result.provenance.proofType, 'p1c31-real-benchmark-acquisition-proof');
    assert.equal(result.provenance.origin, 'electron-main-controlled-benchmark');
    assert.equal(result.provenance.evidenceClass, 'real-runtime-measurement');
    assert.equal(result.provenance.trustedMainProcess, true);
    assert.equal(result.provenance.runtimeIntegrityVerified, true);
    assert.equal(result.provenance.runtimeManifestPinned, true);
    assert.equal(result.provenance.modelStateResolved, true);
    assert.equal(result.provenance.buildIdentityResolved, true);
    assert.equal(result.provenance.benchmarkProcessExecuted, true);
    assert.equal(result.provenance.fixture, false);
    assert.equal(result.provenance.synthetic, false);
    assert.equal(result.provenance.demo, false);
    assert.equal(result.provenance.cryptographicAuthenticityVerified, false);
    assert.equal(result.provenance.context.runIndex, 1);
    assert.equal(result.provenance.benchmarkContext.sourceCommit, SOURCE_COMMIT);
    assert.equal(result.provenance.benchmarkContext.runtimeBinarySha256, RUNTIME_SHA);
    assert.equal(result.provenance.benchmarkContext.modelArtifactSha256, MODEL_SHA);
    assert.deepEqual(result.provenance.benchmarkContext.auxiliaryArtifacts, [
        { role: 'llm', sha256: LLM_SHA },
        { role: 'vae', sha256: VAE_SHA },
    ]);

    const p1c7 = await import('../src/lib/computeRouter/benchmarkSessionEvidence.mjs');
    assert.deepEqual(p1c7.validateRunEnvelope(result.runEvidence), {
        ok: true,
        reason: null,
        auxiliaryArtifacts: result.runEvidence.auxiliaryArtifacts,
    });
});

test('P1C20 fails closed when runtime integrity or exact backend is unavailable', async () => {
    const badIntegrity = makeRunner({
        getBinaryStatus: async () => ({
            ...binaryStatus(),
            installationIntegrity: { integrityVerified: false },
        }),
    });
    assert.equal((await badIntegrity.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    })).reason, 'BENCHMARK_RUNTIME_INTEGRITY_UNVERIFIED');

    const missingActivation = makeRunner({
        getBinaryStatus: async () => ({
            ...binaryStatus(),
            backendActivation: { verified: false, selectedDeviceName: null },
        }),
    });
    assert.equal((await missingActivation.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    })).reason, 'BENCHMARK_BACKEND_ACTIVATION_UNVERIFIED');

    const mismatch = makeRunner({
        getBinaryStatus: async () => binaryStatus('cpu'),
    });
    assert.equal((await mismatch.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    })).reason, 'BENCHMARK_RUNTIME_CONTEXT_MISMATCH');
});

test('P1C20 requires installed model and auxiliary artifacts', async () => {
    const noModel = makeRunner({ listModels: async () => [] });
    assert.equal((await noModel.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    })).reason, 'BENCHMARK_MODEL_NOT_INSTALLED');

    const noAux = makeRunner({
        listModels: async () => [{
            ...installedZImage()[0],
            auxiliaryStatus: { llm: 'downloaded', vae: 'not-downloaded' },
        }],
    });
    assert.equal((await noAux.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    })).reason, 'BENCHMARK_AUXILIARY_NOT_INSTALLED');
});

test('P1C20 suppresses arbitrary benchmark errors and preserves allowlisted codes', async () => {
    const arbitrary = makeRunner({
        runLocalBenchmark: async () => {
            throw new Error('C:/secret/path API_KEY=secret');
        },
    });
    const arbitraryResult = await arbitrary.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    });
    assert.equal(arbitraryResult.reason, 'BENCHMARK_EXECUTION_FAILED');
    assert.equal(JSON.stringify(arbitraryResult).includes('secret'), false);

    const timeout = makeRunner({
        runLocalBenchmark: async () => {
            const error = new Error('hidden detail');
            error.code = 'BENCHMARK_TIMEOUT';
            throw error;
        },
    });
    assert.equal((await timeout.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    })).reason, 'BENCHMARK_TIMEOUT');
});

test('P1C20 permits only one active sample at a time', async () => {
    let release;
    const blocked = new Promise((resolve) => { release = resolve; });
    const runner = makeRunner({
        runLocalBenchmark: async (plan) => {
            await blocked;
            return benchmarkResult(plan);
        },
    });

    const first = runner.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 1,
    });
    const second = await runner.runSample({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024, runIndex: 2,
    });
    assert.equal(second.reason, 'BENCHMARK_ALREADY_RUNNING');

    release();
    assert.equal((await first).status, CONTROLLED_BENCHMARK_SAMPLE_STATUS.READY);
});

test('P1C20 core never promotes a profile or gains routing authority', () => {
    const source = fs.readFileSync('electron/lib/controlledBenchmarkSampleCore.js', 'utf8');
    assert.ok(source.includes('benchmarkOnly: true'));
    assert.ok(source.includes('productionProfilePromoted: false'));
    assert.ok(source.includes('routingEligible: false'));
    assert.ok(source.includes('cutoverAuthorized: false'));
    assert.ok(source.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.equal(source.includes('productionProfilePromoted: true'), false);
    assert.equal(source.includes('routingEligible: true'), false);
    assert.equal(source.includes('cutoverAuthorized: true'), false);
});
