const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function readinessSnapshot({
    binaryExists = true,
    backend = 'cuda12',
    manifestPinned = true,
    installationIntegrityVerified = true,
    modelState = 'downloaded',
    requiresAuxiliary = true,
    auxiliaryStatus = { llm: 'downloaded', vae: 'downloaded' },
} = {}) {
    return {
        schemaVersion: 1,
        sdcpp: {
            binaryStatus: {
                exists: binaryExists,
                ...(binaryExists ? {
                    runtime: {
                        backend,
                        manifestPinned,
                        installationIntegrityVerified,
                    },
                } : {}),
            },
            models: [
                {
                    id: 'z-image-turbo',
                    provider: 'sdcpp',
                    state: modelState,
                    requiresAuxiliary,
                    ...(requiresAuxiliary ? { auxiliaryStatus } : {}),
                    path: 'must-not-propagate',
                },
                {
                    id: 'dreamshaper-8',
                    provider: 'sdcpp',
                    state: 'not-downloaded',
                },
            ],
            hardwareSnapshot: {
                platform: 'win32',
                arch: 'x64',
                cpu: { model: 'Ryzen Test', logicalCores: 16 },
                memory: { totalMiB: 32768, freeMiB: 12000 },
                accelerators: {
                    nvidia: {
                        available: true,
                        gpus: [
                            { name: 'secret-name-a', memoryTotalMiB: 8192 },
                            { name: 'secret-name-b', memoryTotalMiB: 12288 },
                        ],
                    },
                    cudaToolkit: { available: true, version: '12.4' },
                    vulkan: { available: true },
                    rocm: { available: false },
                },
                rawProbeOutput: 'must-not-propagate',
            },
        },
        wan2gp: {
            config: { configured: true },
            probe: { ok: true },
            models: [{ id: 'wan2gp:test', provider: 'wan2gp', ready: true }],
        },
        muapi: {
            credentialReadiness: {
                available: true,
                secure: true,
                hasSecret: true,
                storeState: 'ready',
            },
            transportHealth: { ok: true, status: 200 },
        },
    };
}

async function collectorWith(snapshot, now = '2026-09-16T10:00:00.000Z') {
    const collectorModule = await import('../src/lib/computeRouter/shadowCompatibilityEvidenceCollector.mjs');
    const calls = [];
    const collector = collectorModule.createShadowCompatibilityEvidenceCollector({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => {
                calls.push('getReadinessSnapshot');
                return snapshot;
            },
        }),
        now: () => new Date(now),
    });
    return { collectorModule, collector, calls };
}

test('P1C14 collects only target sd.cpp runtime/model/hardware evidence from the existing bridge', async () => {
    const { collector, calls } = await collectorWith(readinessSnapshot());
    const result = await collector.collect({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });

    assert.equal(result.status, 'SHADOW_EVIDENCE_COLLECTOR_READY');
    assert.deepEqual(calls, ['getReadinessSnapshot']);
    assert.equal(result.reason, null);
    assert.deepEqual(result.evidence.context, {
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.deepEqual(result.evidence.runtime, {
        exists: true,
        backend: 'cuda12',
        manifestPinned: true,
        installedIntegrityVerified: true,
    });
    assert.deepEqual(result.evidence.model, {
        id: 'z-image-turbo',
        state: 'downloaded',
        requiresAuxiliary: true,
        auxiliaryStatus: { llm: 'downloaded', vae: 'downloaded' },
    });
    assert.equal(result.evidence.hardware.platform, 'win32');
    assert.equal(result.evidence.hardware.totalMemoryMiB, 32768);
    assert.equal(result.evidence.hardware.nvidiaAvailable, true);
    assert.equal(result.evidence.hardware.nvidiaMaxVramMiB, 12288);
    assert.equal(result.evidence.hardware.cudaToolkitVersion, '12.4');
    assert.equal(result.evidence.capturedAt, '2026-09-16T10:00:00.000Z');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(Object.isFrozen(result.evidence), true);
    assert.equal(Object.isFrozen(result.evidence.hardware), true);

    const serialized = JSON.stringify(result.evidence);
    assert.equal(serialized.includes('must-not-propagate'), false);
    assert.equal(serialized.includes('secret-name-a'), false);
    assert.equal(serialized.includes('wan2gp:test'), false);
    assert.equal(serialized.includes('credentialReadiness'), false);
    assert.equal(serialized.includes('hasSecret'), false);
});

test('P1C14 preserves missing runtime as evidence instead of inventing readiness', async () => {
    const { collector } = await collectorWith(readinessSnapshot({ binaryExists: false }));
    const result = await collector.collect({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });

    assert.equal(result.status, 'SHADOW_EVIDENCE_COLLECTOR_READY');
    assert.deepEqual(result.evidence.runtime, {
        exists: false,
        backend: 'cuda12',
        manifestPinned: false,
        installedIntegrityVerified: false,
    });
});

test('P1C14 rejects runtime backend mismatch fail-closed', async () => {
    const { collector } = await collectorWith(readinessSnapshot({ backend: 'cpu' }));
    const result = await collector.collect({
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.equal(result.status, 'SHADOW_EVIDENCE_COLLECTOR_REJECTED');
    assert.equal(result.reason, 'COLLECTOR_RUNTIME_BACKEND_MISMATCH');
    assert.equal(result.evidence, null);
});

test('P1C14 allows only bounded certifiable backends and exact safe context', async () => {
    const { collector } = await collectorWith(readinessSnapshot());

    assert.equal((await collector.collect({
        modelId: '../escape', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_MODEL_ID_INVALID');

    assert.equal((await collector.collect({
        modelId: 'z-image-turbo', backend: 'vulkan', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_BACKEND_INVALID');

    assert.equal((await collector.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 0, height: 1024,
    })).reason, 'COLLECTOR_RESOLUTION_INVALID');
});

test('P1C14 rejects missing, duplicated, or malformed target model evidence', async () => {
    const base = readinessSnapshot();

    const missing = structuredClone(base);
    missing.sdcpp.models = missing.sdcpp.models.filter((model) => model.id !== 'z-image-turbo');
    assert.equal((await (await collectorWith(missing)).collector.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_MODEL_EVIDENCE_NOT_FOUND');

    const duplicated = structuredClone(base);
    duplicated.sdcpp.models.push({ ...duplicated.sdcpp.models[0] });
    assert.equal((await (await collectorWith(duplicated)).collector.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_MODEL_EVIDENCE_DUPLICATE');

    const malformed = structuredClone(base);
    delete malformed.sdcpp.models[0].state;
    assert.equal((await (await collectorWith(malformed)).collector.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_MODEL_STATE_INVALID');
});

test('P1C14 rejects unavailable bridge, readiness failures, malformed snapshots and invalid clock without reflecting errors', async () => {
    const collectorModule = await import('../src/lib/computeRouter/shadowCompatibilityEvidenceCollector.mjs');

    const unavailable = collectorModule.createShadowCompatibilityEvidenceCollector({ getBridge: () => null });
    assert.equal((await unavailable.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_BRIDGE_UNAVAILABLE');

    const throws = collectorModule.createShadowCompatibilityEvidenceCollector({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => { throw new Error('sensitive bridge failure'); },
        }),
    });
    const failed = await throws.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.equal(failed.reason, 'COLLECTOR_READINESS_FAILED');
    assert.equal(JSON.stringify(failed).includes('sensitive bridge failure'), false);

    const malformed = await (await collectorWith({ schemaVersion: 1 })).collector.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.equal(malformed.reason, 'COLLECTOR_SNAPSHOT_INVALID');

    const badClock = collectorModule.createShadowCompatibilityEvidenceCollector({
        getBridge: () => ({ isElectron: true, getReadinessSnapshot: async () => readinessSnapshot() }),
        now: () => ({ toISOString: () => 'not-a-date' }),
    });
    assert.equal((await badClock.collect({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_CLOCK_INVALID');
});

test('P1C14 source uses only existing sanitized readiness bridge and stays off generation/publication surfaces', () => {
    const collector = read('src/lib/computeRouter/shadowCompatibilityEvidenceCollector.mjs');
    const preload = read('electron/preload.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');
    const main = read('src/main.js');
    const settings = read('src/components/SettingsModal.js');

    assert.ok(collector.includes('window.orbiComputeRouter'));
    assert.ok(collector.includes('getReadinessSnapshot'));
    assert.ok(preload.includes("getReadinessSnapshot: () => ipcRenderer.invoke('compute-router:readiness-snapshot')"));

    for (const token of [
        'window.localAI',
        'ipcRenderer',
        'ipcMain',
        'fetch(',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'generate(',
        'publishShadowCompatibilitySnapshot',
        'produceAndPublishShadowCompatibilitySnapshot',
        'routeGenerationRequest',
        'setInterval',
        'setTimeout',
    ]) {
        assert.equal(collector.includes(token), false, `unexpected P1C14 collector capability: ${token}`);
    }

    for (const source of [image, video, main, settings]) {
        assert.equal(source.includes('shadowCompatibilityEvidenceCollector'), false);
        assert.equal(source.includes('collectShadowCompatibilityEvidence'), false);
    }

    assert.ok(collector.includes('routingEligible: false'));
    assert.ok(collector.includes('cutoverAuthorized: false'));
    assert.ok(collector.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.equal(collector.includes('routingEligible: true'), false);
    assert.equal(collector.includes('cutoverAuthorized: true'), false);
});
