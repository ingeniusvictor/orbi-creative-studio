const test = require('node:test');
const assert = require('node:assert/strict');

async function adapters() {
    return import('../src/lib/computeRouter/providerAdapters.mjs');
}

test('provider adapters expose the three current execution boundaries', async () => {
    const { createCurrentProviderDescriptors } = await adapters();
    const providers = createCurrentProviderDescriptors();

    assert.deepEqual(
        providers.map((provider) => provider.id),
        ['sdcpp-device', 'wan2gp-lan', 'muapi-cloud'],
    );

    const [sdcpp, wan2gp, muapi] = providers;
    assert.equal(sdcpp.execution, 'device');
    assert.equal(sdcpp.trustBoundary, 'same-device');
    assert.equal(sdcpp.metering, 'local-compute');
    assert.equal(sdcpp.credentials, 'not-required');

    assert.equal(wan2gp.execution, 'lan');
    assert.equal(wan2gp.trustBoundary, 'trusted-network');
    assert.equal(wan2gp.metering, 'local-compute');

    assert.equal(muapi.execution, 'cloud');
    assert.equal(muapi.trustBoundary, 'third-party');
    assert.equal(muapi.metering, 'credits');
});

test('sd.cpp adapter describes only current text-to-image local models', async () => {
    const { createSdCppProviderDescriptor } = await adapters();
    const provider = createSdCppProviderDescriptor({ health: 'ready' });

    assert.ok(provider.capabilities.length >= 2);
    assert.ok(provider.capabilities.every((capability) => capability.operations.length === 1));
    assert.ok(provider.capabilities.every((capability) => capability.operations[0] === 't2i'));
    assert.ok(provider.capabilities.some((capability) => capability.modelId === 'z-image-turbo'));
    assert.ok(provider.capabilities.some((capability) => capability.modelId === 'z-image-base'));
});

test('Wan2GP adapter preserves T2I T2V and I2V capability distinctions', async () => {
    const { createWan2gpProviderDescriptor } = await adapters();
    const provider = createWan2gpProviderDescriptor({ health: 'ready' });
    const operations = new Set(provider.capabilities.flatMap((capability) => capability.operations));

    assert.ok(operations.has('t2i'));
    assert.ok(operations.has('t2v'));
    assert.ok(operations.has('i2v'));

    const i2v = provider.capabilities.find((capability) => capability.modelId === 'wan2gp:wan22-i2v');
    assert.deepEqual(i2v.operations, ['i2v']);
    assert.ok(i2v.inputTypes.includes('image'));
});

test('MuAPI adapter covers all currently modeled cloud generation classes', async () => {
    const { createMuapiProviderDescriptor } = await adapters();
    const provider = createMuapiProviderDescriptor({
        health: 'ready',
        credentials: 'available',
    });

    const operations = new Set(provider.capabilities.flatMap((capability) => capability.operations));
    for (const operation of ['t2i', 'i2i', 't2v', 'i2v', 'v2v', 'lipsync', 'audio']) {
        assert.ok(operations.has(operation), `missing MuAPI operation ${operation}`);
    }

    assert.ok(provider.capabilities.every((capability) => capability.provenance.catalog === 'muapi'));
});

test('adapters stay descriptive: readiness is explicit and defaults fail closed', async () => {
    const {
        createMuapiProviderDescriptor,
        createSdCppProviderDescriptor,
        createWan2gpProviderDescriptor,
    } = await adapters();

    assert.equal(createMuapiProviderDescriptor().health, 'unknown');
    assert.equal(createMuapiProviderDescriptor().credentials, 'unknown');
    assert.equal(createSdCppProviderDescriptor().health, 'unknown');
    assert.equal(createWan2gpProviderDescriptor().health, 'unknown');
});

test('hardware facts can annotate sd.cpp capability without changing routing identity', async () => {
    const { createSdCppProviderDescriptor } = await adapters();
    const provider = createSdCppProviderDescriptor({
        health: 'ready',
        hardware: { platform: 'win32', nvidiaVramMiB: 8192 },
    });

    assert.equal(provider.id, 'sdcpp-device');
    assert.ok(provider.capabilities.every((capability) => capability.hardware.platform === 'win32'));
    assert.ok(provider.capabilities.every((capability) => capability.hardware.nvidiaVramMiB === 8192));
});
