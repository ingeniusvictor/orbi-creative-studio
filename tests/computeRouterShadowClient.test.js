const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function routerModules() {
    const [clientModule, shadow] = await Promise.all([
        import('../src/lib/computeRouter/shadowClient.mjs'),
        import('../src/lib/computeRouter/studioShadowRouting.mjs'),
    ]);
    return { clientModule, shadow };
}

function localSnapshot(modelId) {
    return {
        sdcpp: {
            binaryStatus: { exists: true },
            models: [{
                id: modelId,
                provider: 'sdcpp',
                state: 'downloaded',
            }],
        },
        wan2gp: {
            config: { url: '' },
        },
        muapi: {},
    };
}

test('shadow client composes Electron readiness into exact-model local parity', async () => {
    const { clientModule, shadow } = await routerModules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'sdcpp-device')
        .capabilities[0];

    let reads = 0;
    const client = clientModule.createComputeRouterShadowClient({
        readSnapshot: async () => {
            reads++;
            return localSnapshot(sample.modelId);
        },
    });

    const result = await client.observeStudioRequest({
        model: sample.modelId,
        prompt: 'ORBI local shadow',
        aspect_ratio: sample.aspectRatios?.[0],
    });

    assert.equal(reads, 1);
    assert.equal(result.mode, 'shadow-only');
    assert.equal(result.executed, false);
    assert.equal(result.parity, 'match');
    assert.equal(result.selectedProviderId, 'sdcpp-device');
});

test('passive MuAPI health can produce cloud parity without any cloud call from the client', async () => {
    const { clientModule, shadow } = await routerModules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'muapi-cloud')
        .capabilities
        .find((capability) => capability.operations.includes('t2i'));

    const client = clientModule.createComputeRouterShadowClient({
        readSnapshot: async () => ({
            sdcpp: {},
            wan2gp: {},
            muapi: {
                credentialReadiness: {
                    available: true,
                    secure: true,
                    hasSecret: true,
                    storeState: 'ready',
                },
                transportHealth: { ok: true },
            },
        }),
    });

    const result = await client.observeStudioRequest({
        model: sample.modelId,
        prompt: 'ORBI cloud shadow',
        aspect_ratio: sample.aspectRatios?.[0],
        resolution: sample.resolutions?.[0],
    });

    assert.equal(result.executed, false);
    assert.equal(result.parity, 'match');
    assert.equal(result.selectedProviderId, 'muapi-cloud');
});

test('shadow observation is fail-soft when readiness collection fails', async () => {
    const { clientModule } = await routerModules();
    const client = clientModule.createComputeRouterShadowClient({
        readSnapshot: async () => {
            throw new Error('internal readiness failure');
        },
    });

    const result = await client.observeStudioRequest({
        model: 'does-not-matter-because-snapshot-failed',
        prompt: 'test',
    });

    assert.deepEqual(result, {
        mode: 'shadow-only',
        executed: false,
        status: 'unavailable',
        parity: 'unavailable',
        reason: 'SHADOW_EVALUATION_UNAVAILABLE',
        legacyProviderId: null,
        selectedProviderId: null,
    });
    assert.equal(JSON.stringify(result).includes('internal readiness failure'), false);
});

test('default client is unavailable outside Electron instead of touching legacy execution', async () => {
    const { clientModule } = await routerModules();
    const client = clientModule.createComputeRouterShadowClient({
        globalObject: {},
    });

    const result = await client.observeStudioRequest({
        model: 'unresolved',
    });

    assert.equal(result.status, 'unavailable');
    assert.equal(result.executed, false);
});

test('strict evaluation remains available for tests and future diagnostics', async () => {
    const { clientModule } = await routerModules();
    const client = clientModule.createComputeRouterShadowClient({
        readSnapshot: async () => {
            throw Object.assign(new Error('bridge unavailable'), { code: 'TEST_FAILURE' });
        },
    });

    await assert.rejects(
        client.evaluateStudioRequest({ model: 'unknown' }),
        /bridge unavailable/
    );
});

test('shadow client has no provider execution capability or Studio component coupling', () => {
    const source = fs.readFileSync('src/lib/computeRouter/shadowClient.mjs', 'utf8');

    for (const forbidden of [
        'localAI',
        'orbiMuapi',
        'muapi.',
        'window.localAI',
        '.generate(',
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'ImageStudio',
        'VideoStudio',
    ]) {
        assert.equal(source.includes(forbidden), false, `shadow client contains forbidden coupling: ${forbidden}`);
    }

    assert.ok(source.includes('getReadinessSnapshot'));
    assert.ok(source.includes('observeStudioRequest'));
    assert.ok(source.includes("mode: 'shadow-only'"));
});
