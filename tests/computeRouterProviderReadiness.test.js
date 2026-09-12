const test = require('node:test');
const assert = require('node:assert/strict');

async function readiness() {
    return import('../src/lib/computeRouter/providerReadiness.mjs');
}

async function contracts() {
    return import('../src/lib/computeRouter/contracts.mjs');
}

test('sd.cpp stays unknown without runtime evidence', async () => {
    const { composeSdCppReadiness } = await readiness();
    const provider = composeSdCppReadiness();
    assert.equal(provider.health, 'unknown');
});

test('sd.cpp is misconfigured when binary is missing', async () => {
    const { composeSdCppReadiness } = await readiness();
    const provider = composeSdCppReadiness({
        binaryStatus: { exists: false },
        models: [],
    });
    assert.equal(provider.health, 'misconfigured');
});

test('sd.cpp exposes only downloaded models with required auxiliary assets', async () => {
    const { composeSdCppReadiness } = await readiness();
    const provider = composeSdCppReadiness({
        binaryStatus: { exists: true },
        models: [
            {
                id: 'z-image-turbo',
                provider: 'sdcpp',
                state: 'downloaded',
                requiresAuxiliary: true,
                auxiliaryStatus: { llm: 'downloaded', vae: 'downloaded' },
            },
            {
                id: 'z-image-base',
                provider: 'sdcpp',
                state: 'downloaded',
                requiresAuxiliary: true,
                auxiliaryStatus: { llm: 'not-downloaded', vae: 'downloaded' },
            },
            {
                id: 'dreamshaper-8',
                provider: 'sdcpp',
                state: 'not-downloaded',
            },
        ],
    });

    assert.equal(provider.health, 'ready');
    assert.deepEqual(provider.capabilities.map((capability) => capability.modelId), ['z-image-turbo']);
});

test('hardware snapshot is sanitized before entering router descriptors', async () => {
    const { composeSdCppReadiness } = await readiness();
    const provider = composeSdCppReadiness({
        binaryStatus: { exists: true },
        models: [{ id: 'z-image-turbo', state: 'downloaded', provider: 'sdcpp' }],
        hardwareSnapshot: {
            platform: 'win32',
            arch: 'x64',
            cpu: { model: 'Ryzen Test', logicalCores: 16 },
            memory: { totalMiB: 32768, freeMiB: 12000 },
            accelerators: {
                nvidia: {
                    available: true,
                    gpus: [
                        { name: 'RTX A', memoryTotalMiB: 8192 },
                        { name: 'RTX B', memoryTotalMiB: 12288 },
                    ],
                },
                cudaToolkit: { available: true, version: '12.4' },
                vulkan: { available: true },
                rocm: { available: false },
            },
            secretRawProbeOutput: 'must-not-propagate',
        },
    });

    const hardware = provider.capabilities[0].hardware;
    assert.equal(hardware.platform, 'win32');
    assert.equal(hardware.nvidiaMaxVramMiB, 12288);
    assert.equal(hardware.cudaToolkitVersion, '12.4');
    assert.equal(Object.prototype.hasOwnProperty.call(hardware, 'secretRawProbeOutput'), false);
});

test('Wan2GP distinguishes unconfigured offline and ready states', async () => {
    const { composeWan2gpReadiness } = await readiness();

    assert.equal(
        composeWan2gpReadiness({ config: { url: '' } }).health,
        'misconfigured',
    );

    assert.equal(
        composeWan2gpReadiness({
            config: { url: 'http://192.168.1.20:7860' },
            probe: { ok: false, error: 'timeout' },
        }).health,
        'offline',
    );

    const ready = composeWan2gpReadiness({
        config: { url: 'http://192.168.1.20:7860' },
        probe: { ok: true },
        models: [
            { id: 'wan2gp:wan22-t2v', provider: 'wan2gp', ready: true },
            { id: 'wan2gp:wan22-i2v', provider: 'wan2gp', ready: false },
        ],
    });

    assert.equal(ready.health, 'ready');
    assert.deepEqual(ready.capabilities.map((capability) => capability.modelId), ['wan2gp:wan22-t2v']);
});

test('MuAPI secure credential readiness and cloud health remain separate facts', async () => {
    const { composeMuapiReadiness } = await readiness();

    const noSecret = composeMuapiReadiness({
        credentialReadiness: {
            available: true,
            secure: true,
            hasSecret: false,
            storeState: 'ready',
        },
        transportHealth: true,
    });
    assert.equal(noSecret.health, 'ready');
    assert.equal(noSecret.credentials, 'missing');

    const secureButUnprobed = composeMuapiReadiness({
        credentialReadiness: {
            available: true,
            secure: true,
            hasSecret: true,
            storeState: 'ready',
        },
    });
    assert.equal(secureButUnprobed.health, 'unknown');
    assert.equal(secureButUnprobed.credentials, 'available');
});

test('router cannot select unavailable local models or silently fall back to cloud', async () => {
    const { composeCurrentProviderReadiness } = await readiness();
    const { routeGenerationRequest } = await contracts();

    const providers = composeCurrentProviderReadiness({
        sdcpp: {
            binaryStatus: { exists: true },
            models: [{ id: 'z-image-turbo', provider: 'sdcpp', state: 'downloaded' }],
        },
        wan2gp: {
            config: { url: '' },
        },
        muapi: {
            credentialReadiness: {
                available: true,
                secure: true,
                hasSecret: true,
                storeState: 'ready',
            },
            transportHealth: true,
        },
    });

    const unavailableLocal = routeGenerationRequest({
        capability: 't2i',
        modelPreference: 'z-image-base',
        policy: { privacy: 'device-only', cost: 'free-only' },
    }, providers);

    assert.equal(unavailableLocal.selected, null);
    assert.equal(unavailableLocal.reason, 'NO_ELIGIBLE_PROVIDER');

    const localReady = routeGenerationRequest({
        capability: 't2i',
        modelPreference: 'z-image-turbo',
        policy: { privacy: 'device-only', cost: 'free-only' },
    }, providers);

    assert.equal(localReady.selected.provider.id, 'sdcpp-device');
});
