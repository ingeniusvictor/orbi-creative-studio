const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function modules() {
    const [shadow, readiness] = await Promise.all([
        import('../src/lib/computeRouter/studioShadowRouting.mjs'),
        import('../src/lib/computeRouter/providerReadiness.mjs'),
    ]);
    return { shadow, readiness };
}

function readyEvidence({
    sdcppModels = [],
    wanModels = [],
    wanProbe = true,
    muapiTransport = true,
} = {}) {
    return {
        sdcpp: {
            binaryStatus: { exists: true },
            models: sdcppModels,
        },
        wan2gp: {
            config: { url: 'configured' },
            probe: { ok: wanProbe },
            models: wanModels,
        },
        muapi: {
            credentialReadiness: {
                available: true,
                secure: true,
                hasSecret: true,
                storeState: 'ready',
            },
            transportHealth: muapiTransport,
        },
    };
}

test('every current model id has one deterministic legacy provider/capability route', async () => {
    const { shadow } = await modules();
    const seen = new Map();

    for (const owner of shadow.LEGACY_PROVIDER_CAPABILITIES) {
        for (const capability of owner.capabilities) {
            for (const operation of capability.operations) {
                const key = capability.modelId;
                const existing = seen.get(key);
                const route = `${owner.providerId}:${operation}`;
                if (existing && existing !== route) {
                    assert.fail(`ambiguous current model ownership for ${key}: ${existing} vs ${route}`);
                }
                seen.set(key, route);

                const resolved = shadow.resolveLegacyModelRoute({
                    modelId: capability.modelId,
                    capability: operation,
                });
                assert.equal(`${resolved.providerId}:${resolved.capability}`, route);
            }
        }
    }

    assert.ok(seen.size > 0);
});

test('Studio snake_case image params become an exact-model router request', async () => {
    const { shadow } = await modules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'muapi-cloud')
        .capabilities
        .find((capability) => capability.operations.includes('t2i'));

    assert.ok(sample, 'expected at least one MuAPI t2i model');

    const intent = shadow.createStudioShadowIntent({
        model: sample.modelId,
        prompt: 'ORBI test',
        aspect_ratio: sample.aspectRatios?.[0] || '1:1',
        resolution: sample.resolutions?.[0],
    });

    assert.equal(intent.mode, 'shadow-only');
    assert.equal(intent.legacyProviderId, 'muapi-cloud');
    assert.equal(intent.request.modelPreference, sample.modelId);
    assert.equal(intent.request.capability, 't2i');
    assert.equal(intent.request.policy.allowFallback, false);
    assert.equal(intent.request.policy.cost, 'metered-ok');
});

test('ready sd.cpp model produces parity match without execution', async () => {
    const { shadow, readiness } = await modules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'sdcpp-device')
        .capabilities[0];

    const providers = readiness.composeCurrentProviderReadiness(
        readyEvidence({
            sdcppModels: [{
                id: sample.modelId,
                provider: 'sdcpp',
                state: 'downloaded',
            }],
            wanProbe: false,
            muapiTransport: false,
        })
    );

    const result = shadow.shadowRouteStudioRequest({
        model: sample.modelId,
        prompt: 'local test',
        aspect_ratio: sample.aspectRatios?.[0],
    }, providers);

    assert.equal(result.executed, false);
    assert.equal(result.parity, 'match');
    assert.equal(result.legacyProviderId, 'sdcpp-device');
    assert.equal(result.selectedProviderId, 'sdcpp-device');
});

test('ready Wan2GP model produces parity match without exposing execution', async () => {
    const { shadow, readiness } = await modules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'wan2gp-lan')
        .capabilities[0];

    const providers = readiness.composeCurrentProviderReadiness(
        readyEvidence({
            sdcppModels: [],
            wanModels: [{
                id: sample.modelId,
                provider: 'wan2gp',
                ready: true,
            }],
            wanProbe: true,
            muapiTransport: false,
        })
    );

    const result = shadow.shadowRouteStudioRequest({
        model: sample.modelId,
        prompt: 'lan test',
        aspect_ratio: sample.aspectRatios?.[0],
    }, providers);

    assert.equal(result.executed, false);
    assert.equal(result.parity, 'match');
    assert.equal(result.selectedProviderId, 'wan2gp-lan');
});

test('unknown MuAPI transport health cannot be promoted to a shadow selection', async () => {
    const { shadow, readiness } = await modules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'muapi-cloud')
        .capabilities
        .find((capability) => capability.operations.includes('t2i'));

    const providers = readiness.composeCurrentProviderReadiness({
        muapi: {
            credentialReadiness: {
                available: true,
                secure: true,
                hasSecret: true,
                storeState: 'ready',
            },
        },
    });

    const result = shadow.shadowRouteStudioRequest({
        model: sample.modelId,
        prompt: 'cloud test',
    }, providers);

    assert.equal(result.executed, false);
    assert.equal(result.parity, 'no-route');
    assert.equal(result.selectedProviderId, null);
    assert.ok(
        result.rejected.some((entry) =>
            entry.providerId === 'muapi-cloud'
            && entry.reasons.includes('health:unknown')
        )
    );
});

test('offline legacy provider yields no-route instead of silent provider switching', async () => {
    const { shadow, readiness } = await modules();
    const sample = shadow.LEGACY_PROVIDER_CAPABILITIES
        .find((owner) => owner.providerId === 'wan2gp-lan')
        .capabilities[0];

    const providers = readiness.composeCurrentProviderReadiness(
        readyEvidence({
            wanModels: [{
                id: sample.modelId,
                provider: 'wan2gp',
                ready: true,
            }],
            wanProbe: false,
            muapiTransport: true,
        })
    );

    const result = shadow.shadowRouteStudioRequest({
        model: sample.modelId,
        prompt: 'must remain exact-model',
    }, providers);

    assert.equal(result.parity, 'no-route');
    assert.equal(result.selectedProviderId, null);
    assert.equal(result.request.modelPreference, sample.modelId);
    assert.equal(result.request.policy.allowFallback, false);
});

test('shadow routing module has no provider execution surface', () => {
    const source = fs.readFileSync('src/lib/computeRouter/studioShadowRouting.mjs', 'utf8');

    for (const forbidden of [
        'window.',
        'ipcRenderer',
        'ipcMain',
        'fetch(',
        '.generate(',
        'orbiMuapi',
        'localAI',
        'wan2gp:generate',
        'local-ai:generate',
    ]) {
        assert.equal(source.includes(forbidden), false, `shadow module contains execution coupling: ${forbidden}`);
    }

    assert.ok(source.includes("mode: 'shadow-only'"));
    assert.ok(source.includes('executed: false'));
});
