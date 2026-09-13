const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildProviderReadinessSnapshot,
} = require('../electron/lib/providerReadinessSnapshotCore');

async function shadow() {
    return import('../src/lib/computeRouter/studioShadow.mjs');
}

async function adapters() {
    return import('../src/lib/computeRouter/providerAdapters.mjs');
}

function sdcppSnapshot() {
    return buildProviderReadinessSnapshot({
        sdcppEvidence: {
            binaryStatus: { exists: true },
            models: [{
                id: 'z-image-turbo',
                provider: 'sdcpp',
                state: 'downloaded',
                requiresAuxiliary: true,
                auxiliaryStatus: {
                    llm: 'downloaded',
                    vae: 'downloaded',
                },
            }],
        },
    });
}

function wan2gpSnapshot() {
    return buildProviderReadinessSnapshot({
        wan2gpEvidence: {
            config: { configured: true },
            probe: { ok: true },
            models: [{
                id: 'wan2gp:wan22-t2v',
                provider: 'wan2gp',
                ready: true,
            }],
        },
    });
}

function muapiCredentialSnapshot() {
    return buildProviderReadinessSnapshot({
        muapiCredentialReadiness: {
            available: true,
            secure: true,
            hasSecret: true,
            storeState: 'ready',
        },
    });
}

test('shadow planner mirrors the legacy provider identity for current model catalogs', async () => {
    const {
        LEGACY_PROVIDER_IDS,
        inferLegacyProviderId,
    } = await shadow();
    const { MUAPI_CAPABILITIES } = await adapters();

    assert.equal(
        inferLegacyProviderId('z-image-turbo'),
        LEGACY_PROVIDER_IDS.SDCPP,
    );
    assert.equal(
        inferLegacyProviderId('wan2gp:wan22-t2v'),
        LEGACY_PROVIDER_IDS.WAN2GP,
    );
    assert.equal(
        inferLegacyProviderId(MUAPI_CAPABILITIES[0].modelId),
        LEGACY_PROVIDER_IDS.MUAPI,
    );
});

test('sd.cpp shadow route matches the current explicit local image dispatcher', async () => {
    const { evaluateStudioShadowRoute } = await shadow();

    const report = evaluateStudioShadowRoute({
        operation: 't2i',
        modelId: 'z-image-turbo',
        aspectRatio: '1:1',
        readinessSnapshot: sdcppSnapshot(),
        prompt: 'must-not-be-recorded',
    });

    assert.equal(report.mode, 'shadow-only');
    assert.equal(report.expectedProviderId, 'sdcpp-device');
    assert.equal(report.selectedProviderId, 'sdcpp-device');
    assert.equal(report.parity, 'match');
    assert.equal(report.reason, 'SELECTED');
    assert.equal(JSON.stringify(report).includes('must-not-be-recorded'), false);
});

test('Wan2GP shadow route matches the current explicit local video dispatcher', async () => {
    const { evaluateStudioShadowRoute } = await shadow();

    const report = evaluateStudioShadowRoute({
        operation: 't2v',
        modelId: 'wan2gp:wan22-t2v',
        aspectRatio: '16:9',
        readinessSnapshot: wan2gpSnapshot(),
    });

    assert.equal(report.expectedProviderId, 'wan2gp-lan');
    assert.equal(report.selectedProviderId, 'wan2gp-lan');
    assert.equal(report.parity, 'match');
});

test('MuAPI shadow route remains blocked when only credential readiness exists', async () => {
    const { evaluateStudioShadowRoute } = await shadow();
    const { MUAPI_CAPABILITIES } = await adapters();
    const capability = MUAPI_CAPABILITIES[0];

    const report = evaluateStudioShadowRoute({
        operation: capability.operations[0],
        modelId: capability.modelId,
        readinessSnapshot: muapiCredentialSnapshot(),
    });

    assert.equal(report.expectedProviderId, 'muapi-cloud');
    assert.equal(report.selectedProviderId, null);
    assert.equal(report.parity, 'blocked');

    const muapiRejection = report.rejected.find((item) => item.providerId === 'muapi-cloud');
    assert.ok(muapiRejection);
    assert.ok(muapiRejection.reasons.includes('health:unknown'));
});

test('MuAPI shadow parity matches only after explicit transport health is supplied', async () => {
    const { evaluateStudioShadowRoute } = await shadow();
    const { MUAPI_CAPABILITIES } = await adapters();
    const capability = MUAPI_CAPABILITIES[0];
    const snapshotWithHealth = buildProviderReadinessSnapshot({
        muapiCredentialReadiness: {
            available: true,
            secure: true,
            hasSecret: true,
            storeState: 'ready',
        },
        muapiTransportHealth: {
            ok: true,
            status: 200,
        },
    });

    const report = evaluateStudioShadowRoute({
        operation: capability.operations[0],
        modelId: capability.modelId,
        readinessSnapshot: snapshotWithHealth,
    });

    assert.equal(report.expectedProviderId, 'muapi-cloud');
    assert.equal(report.selectedProviderId, 'muapi-cloud');
    assert.equal(report.parity, 'match');
});

test('shadow planner refuses broad routing without an explicit model identity', async () => {
    const { createStudioShadowRequest } = await shadow();

    assert.throws(
        () => createStudioShadowRequest({ operation: 't2i' }),
        (error) => error.code === 'INVALID_SHADOW_CONTEXT',
    );
});
