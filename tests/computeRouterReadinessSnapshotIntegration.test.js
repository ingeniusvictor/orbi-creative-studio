const test = require('node:test');
const assert = require('node:assert/strict');
const { collectReadinessSnapshot } = require('../electron/lib/computeRouterReadinessSnapshotCore');

async function readinessModule() {
    return import('../src/lib/computeRouter/providerReadiness.mjs');
}

test('sanitized Electron snapshot composes directly into provider readiness descriptors', async () => {
    const snapshot = await collectReadinessSnapshot({
        store: {
            getReadiness: () => ({
                available: true,
                secure: true,
                hasSecret: true,
                storeState: 'ready',
            }),
        },
        probeHardware: async () => ({
            schemaVersion: 1,
            platform: 'win32',
            arch: 'x64',
            cpu: { model: 'Ryzen Test', logicalCores: 16 },
            memory: { totalMiB: 32768, freeMiB: 16000 },
            accelerators: {
                nvidia: { available: true, gpus: [{ name: 'RTX Test', memoryTotalMiB: 12288 }] },
                cudaToolkit: { available: true, version: '12.5' },
                vulkan: { available: true },
                rocm: { available: false },
            },
        }),
        getBinaryStatus: async () => ({ exists: true, runtime: { backend: 'cuda12' } }),
        listSdModels: async () => [{
            id: 'z-image-turbo',
            provider: 'sdcpp',
            state: 'downloaded',
            requiresAuxiliary: false,
        }],
        readWanConfig: () => ({ url: 'http://192.168.1.50:7860' }),
        probeWan: async () => ({ ok: true, version: '4.0', matchedModels: 1, totalModels: 6 }),
        listWanModelsFromProbe: () => [{
            id: 'wan2gp:wan22-t2v',
            provider: 'wan2gp',
            ready: true,
        }],
    });

    const { composeCurrentProviderReadiness } = await readinessModule();
    const providers = composeCurrentProviderReadiness(snapshot);

    assert.equal(providers[0].id, 'sdcpp-device');
    assert.equal(providers[0].health, 'ready');
    assert.deepEqual(providers[0].capabilities.map((cap) => cap.modelId), ['z-image-turbo']);

    assert.equal(providers[1].id, 'wan2gp-lan');
    assert.equal(providers[1].health, 'ready');
    assert.deepEqual(providers[1].capabilities.map((cap) => cap.modelId), ['wan2gp:wan22-t2v']);

    assert.equal(providers[2].id, 'muapi-cloud');
    assert.equal(providers[2].credentials, 'available');
    assert.equal(providers[2].health, 'unknown', 'snapshot must not invent MuAPI transport health');
});

test('snapshot failure codes never expose raw internal error messages', async () => {
    const snapshot = await collectReadinessSnapshot({
        store: {
            getReadiness: () => {
                const error = new Error('C:\\Users\\Victor\\secret\\credentials.json');
                error.code = 'STORE_READ_FAILED';
                throw error;
            },
        },
        probeHardware: async () => ({}),
        getBinaryStatus: async () => ({ exists: false }),
        listSdModels: async () => [],
        readWanConfig: () => ({ url: '' }),
        probeWan: async () => ({ ok: false }),
        listWanModelsFromProbe: () => [],
    });

    const entry = snapshot.errors.find((item) => item.source === 'muapi-credential');
    assert.deepEqual(entry, { source: 'muapi-credential', code: 'STORE_READ_FAILED' });
    assert.equal(JSON.stringify(snapshot).includes('credentials.json'), false);
});
