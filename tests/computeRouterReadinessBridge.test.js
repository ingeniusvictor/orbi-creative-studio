const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
    buildReadinessSnapshot,
    sanitizeCredentialReadiness,
    sanitizeHardwareSnapshot,
    sanitizeWan2gpSnapshot,
} = require('../electron/lib/computeRouterReadinessSnapshot');

async function readinessComposer() {
    return import('../src/lib/computeRouter/providerReadiness.mjs');
}

test('hardware snapshot strips raw probe and GPU identity fields', () => {
    const safe = sanitizeHardwareSnapshot({
        platform: 'win32',
        arch: 'x64',
        cpu: { model: 'Ryzen Test', logicalCores: 16, speedMHz: 4200 },
        memory: { totalMiB: 32768, freeMiB: 12000 },
        accelerators: {
            nvidia: {
                available: true,
                probeAvailable: true,
                gpus: [{
                    name: 'Secret GPU Label',
                    memoryTotalMiB: 12288,
                    driverVersion: '999.1',
                }],
            },
            cudaToolkit: { available: true, version: '12.4' },
            vulkan: { available: true, summaryObserved: true },
            rocm: { available: false },
        },
        probePolicy: { commandTimeoutMs: 2500 },
        rawOutput: 'must-not-cross',
    });

    assert.deepEqual(safe.accelerators.nvidia.gpus, [{ memoryTotalMiB: 12288 }]);
    assert.equal(Object.hasOwn(safe.accelerators.nvidia.gpus[0], 'name'), false);
    assert.equal(Object.hasOwn(safe.accelerators.nvidia.gpus[0], 'driverVersion'), false);
    assert.equal(Object.hasOwn(safe, 'probePolicy'), false);
    assert.equal(Object.hasOwn(safe, 'rawOutput'), false);
});

test('credential readiness never exposes backend reason or secret material', () => {
    const safe = sanitizeCredentialReadiness({
        available: true,
        secure: true,
        hasSecret: true,
        storeState: 'ready',
        backend: 'os-protected',
        reason: 'internal-reason',
        secret: 'must-not-cross',
        ciphertext: 'must-not-cross',
    });

    assert.deepEqual(safe, {
        available: true,
        secure: true,
        hasSecret: true,
        storeState: 'ready',
    });
});

test('Wan2GP readiness redacts the LAN endpoint and endpoint metadata', () => {
    const safe = sanitizeWan2gpSnapshot({
        config: { url: 'http://192.168.1.20:7860' },
        probe: {
            ok: true,
            version: '4.x',
            apiNames: ['wan22_t2v'],
            error: 'must-not-cross',
        },
        models: [{
            id: 'wan2gp:wan22-t2v',
            provider: 'wan2gp',
            ready: true,
            fn: 'wan22_t2v',
            unavailableReason: 'must-not-cross',
        }],
    });

    assert.equal(safe.config.url, 'configured');
    assert.deepEqual(safe.probe, { ok: true });
    assert.deepEqual(safe.models, [{
        id: 'wan2gp:wan22-t2v',
        provider: 'wan2gp',
        ready: true,
    }]);
});

test('snapshot feeds P1B.3 without exposing execution or secret details', async () => {
    const snapshot = buildReadinessSnapshot({
        sdcpp: {
            binaryStatus: {
                exists: true,
                path: '/private/model/bin',
            },
            models: [{
                id: 'z-image-turbo',
                provider: 'sdcpp',
                state: 'downloaded',
                filename: 'private.gguf',
                path: '/private/model/private.gguf',
            }],
        },
        wan2gp: {
            config: { url: 'http://10.0.0.5:7860' },
            probe: { ok: false, error: 'timeout details' },
        },
        hardware: {
            platform: 'linux',
            arch: 'x64',
            cpu: { model: 'CPU', logicalCores: 8 },
            memory: { totalMiB: 16384, freeMiB: 8000 },
            accelerators: {
                nvidia: { available: false, gpus: [] },
                cudaToolkit: { available: false },
                vulkan: { available: true },
                rocm: { available: false },
            },
        },
        credentialReadiness: {
            available: true,
            secure: true,
            hasSecret: true,
            storeState: 'ready',
            backend: 'secret-backend',
        },
    });

    const text = JSON.stringify(snapshot);
    for (const forbidden of [
        '/private/model',
        'private.gguf',
        '10.0.0.5',
        'timeout details',
        'secret-backend',
        'ciphertext',
    ]) {
        assert.equal(text.includes(forbidden), false, `snapshot leaked ${forbidden}`);
    }

    const { composeCurrentProviderReadiness } = await readinessComposer();
    const providers = composeCurrentProviderReadiness(snapshot);
    const byId = Object.fromEntries(providers.map((provider) => [provider.id, provider]));

    assert.equal(byId['sdcpp-device'].health, 'ready');
    assert.equal(byId['wan2gp-lan'].health, 'offline');
    assert.equal(byId['muapi-cloud'].credentials, 'available');
    assert.equal(byId['muapi-cloud'].health, 'unknown');
});

test('Electron preload exposes only one read-only Compute Router readiness method', () => {
    const source = fs.readFileSync('electron/preload.js', 'utf8');
    const start = source.indexOf("contextBridge.exposeInMainWorld('orbiComputeRouter'");
    assert.notEqual(start, -1);
    const block = source.slice(start, source.indexOf('});', start) + 3);

    assert.ok(block.includes("ipcRenderer.invoke('compute-router:readiness-snapshot')"));
    for (const forbidden of ['generate', 'upload', 'setMuapiKey', 'deleteMuapiKey', 'getSecret']) {
        assert.equal(block.includes(forbidden), false, `readiness preload exposes ${forbidden}`);
    }
});

test('main-process readiness bridge contains no generation or generic secret-read path', () => {
    const source = fs.readFileSync('electron/lib/computeRouterReadinessBridge.js', 'utf8');
    for (const forbidden of [
        'local-ai:generate',
        'wan2gp:generate',
        'muapi-transport:request',
        'getSecret(',
        'decryptString',
    ]) {
        assert.equal(source.includes(forbidden), false, `bridge contains forbidden coupling: ${forbidden}`);
    }
    assert.ok(source.includes('assertTrustedSender'));
    assert.ok(source.includes('failSoft'));
});
