const test = require('node:test');
const assert = require('node:assert/strict');
const {
    collectReadinessSnapshot,
    sanitizeBinaryStatus,
    sanitizeSdModels,
} = require('../electron/lib/computeRouterReadinessSnapshotCore');

test('snapshot sanitizes local paths and download metadata', async () => {
    const snapshot = await collectReadinessSnapshot({
        store: {
            getReadiness: () => ({
                available: true,
                secure: true,
                hasSecret: true,
                storeState: 'ready',
                secret: 'must-not-leak',
            }),
        },
        probeHardware: async () => ({
            schemaVersion: 1,
            platform: 'win32',
            arch: 'x64',
            cpu: { model: 'CPU', logicalCores: 8 },
            memory: { totalMiB: 16384, freeMiB: 8000 },
            accelerators: {},
        }),
        getBinaryStatus: async () => ({
            exists: true,
            path: 'C:/secret/runtime/sd-cli.exe',
            dataDir: 'C:/secret/data',
            modelsDir: 'C:/secret/models',
            envVar: 'ORBI_LOCAL_AI_DIR',
            runtime: {
                backend: 'cuda12',
                release: 'r1',
                upstreamCommit: 'abc',
                assetName: 'runtime.zip',
                sha256: 'f'.repeat(64),
            },
        }),
        listSdModels: async () => [{
            id: 'z-image-turbo',
            provider: 'sdcpp',
            state: 'downloaded',
            path: 'C:/secret/models/model.gguf',
            downloadUrl: 'https://example.invalid/model',
            sha256: 'a'.repeat(64),
            requiresAuxiliary: true,
            auxiliaryStatus: { llm: 'downloaded', vae: 'downloaded' },
        }],
        readWanConfig: () => ({ url: '' }),
        probeWan: async () => ({ ok: true }),
        listWanModelsFromProbe: () => [],
    });

    assert.equal(snapshot.sdcpp.binaryStatus.exists, true);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.sdcpp.binaryStatus, 'path'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.sdcpp.models[0], 'path'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.sdcpp.models[0], 'downloadUrl'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.sdcpp.models[0], 'sha256'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.muapi.credentialReadiness, 'secret'), false);
    assert.equal(snapshot.muapi.transportHealth, null);
});

test('snapshot probes Wan2GP only when configured and reuses the same probe result for model readiness', async () => {
    let probeCalls = 0;
    let listCalls = 0;
    const probeResult = { ok: true, version: '4.0', matchedModels: 1, totalModels: 6 };

    const snapshot = await collectReadinessSnapshot({
        store: { getReadiness: () => ({ available: true, secure: true, hasSecret: false, storeState: 'ready' }) },
        probeHardware: async () => ({}),
        getBinaryStatus: async () => ({ exists: false }),
        listSdModels: async () => [],
        readWanConfig: () => ({ url: 'http://192.168.1.50:7860' }),
        probeWan: async () => {
            probeCalls += 1;
            return probeResult;
        },
        listWanModelsFromProbe: (_url, suppliedProbe) => {
            listCalls += 1;
            assert.equal(suppliedProbe, probeResult);
            return [{ id: 'wan2gp:wan22-t2v', provider: 'wan2gp', ready: true }];
        },
    });

    assert.equal(probeCalls, 1);
    assert.equal(listCalls, 1);
    assert.equal(snapshot.wan2gp.probe.ok, true);
    assert.equal(snapshot.wan2gp.models[0].ready, true);
});

test('snapshot captures individual source failures instead of failing the whole readiness request', async () => {
    const snapshot = await collectReadinessSnapshot({
        store: { getReadiness: () => { throw Object.assign(new Error('keychain unavailable'), { code: 'KEYCHAIN_DOWN' }); } },
        probeHardware: async () => { throw new Error('probe unavailable'); },
        getBinaryStatus: async () => ({ exists: true }),
        listSdModels: async () => { throw new Error('models unavailable'); },
        readWanConfig: () => ({ url: '' }),
        probeWan: async () => ({ ok: false }),
        listWanModelsFromProbe: () => [],
    });

    assert.equal(snapshot.hardware, null);
    assert.equal(snapshot.sdcpp.binaryStatus.exists, true);
    assert.equal(snapshot.sdcpp.models, null);
    assert.equal(snapshot.muapi.credentialReadiness, null);
    assert.equal(snapshot.errors.length, 3);
    assert.ok(snapshot.errors.some((entry) => entry.source === 'muapi-credential' && entry.code === 'KEYCHAIN_DOWN'));
});

test('sanitizers expose routing facts only', () => {
    const binary = sanitizeBinaryStatus({
        exists: true,
        path: '/private/runtime',
        runtime: { backend: 'cpu', release: 'v1', upstreamCommit: 'abc', assetName: 'a.zip', sha256: '1'.repeat(64) },
    });
    assert.deepEqual(Object.keys(binary).sort(), ['exists', 'runtime']);

    const models = sanitizeSdModels([{
        id: 'm1',
        state: 'downloaded',
        path: '/private/model',
        requiresAuxiliary: false,
    }]);
    assert.deepEqual(
        Object.keys(models[0]).filter((key) => models[0][key] !== undefined).sort(),
        ['id', 'provider', 'requiresAuxiliary', 'state'],
    );
});
