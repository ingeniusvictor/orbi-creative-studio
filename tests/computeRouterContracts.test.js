const test = require('node:test');
const assert = require('node:assert/strict');

async function contracts() {
    return import('../src/lib/computeRouter/contracts.mjs');
}

function provider(overrides = {}) {
    return {
        id: 'provider-a',
        execution: 'device',
        trustBoundary: 'same-device',
        metering: 'local-compute',
        health: 'ready',
        credentials: 'not-required',
        capabilities: [{
            modelId: 'model-a',
            operations: ['t2i'],
            inputTypes: ['text'],
            outputTypes: ['image'],
            aspectRatios: ['1:1', '9:16'],
            resolutions: ['512x512', '720x1280'],
        }],
        ...overrides,
    };
}

test('contracts reject unknown capabilities, enums, and missing identities', async () => {
    const { createGenerationRequest, createProviderDescriptor } = await contracts();
    assert.throws(() => createGenerationRequest({ capability: 'telepathy' }), /Invalid capability/);
    assert.throws(() => createProviderDescriptor(provider({ execution: 'moon' })), /Invalid execution type/);
    assert.throws(() => createProviderDescriptor(provider({ id: undefined })), /provider id is required/);
    const missingModel = provider();
    delete missingModel.capabilities[0].modelId;
    assert.throws(() => createProviderDescriptor(missingModel), /modelId is required/);
});

test('device-only privacy rejects cloud providers', async () => {
    const { createGenerationRequest, evaluateProvider } = await contracts();
    const request = createGenerationRequest({ capability: 't2i', policy: { privacy: 'device-only' } });
    const result = evaluateProvider(request, provider({
        execution: 'cloud',
        trustBoundary: 'third-party',
        metering: 'credits',
        credentials: 'available',
    }));
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('privacy-policy'));
});

test('free-only rejects metered cloud but accepts local compute', async () => {
    const { createGenerationRequest, evaluateProvider } = await contracts();
    const request = createGenerationRequest({ capability: 't2i', policy: { cost: 'free-only' } });

    const cloud = evaluateProvider(request, provider({
        id: 'cloud',
        execution: 'cloud',
        trustBoundary: 'third-party',
        metering: 'credits',
        credentials: 'available',
    }));
    assert.ok(cloud.reasons.includes('cost-policy'));

    const local = evaluateProvider(request, provider());
    assert.equal(local.eligible, true);
});

test('model preference and output constraints are hard filters', async () => {
    const { createGenerationRequest, evaluateProvider } = await contracts();
    const request = createGenerationRequest({
        capability: 't2i',
        modelPreference: 'model-a',
        output: { aspectRatio: '9:16', resolution: '720x1280' },
    });
    assert.equal(evaluateProvider(request, provider()).eligible, true);

    const wrong = createGenerationRequest({
        capability: 't2i',
        modelPreference: 'model-b',
    });
    const evaluation = evaluateProvider(wrong, provider());
    assert.equal(evaluation.eligible, false);
    assert.ok(evaluation.reasons.includes('capability-or-output-mismatch'));
});

test('router prefers same-device free provider over eligible cloud by default', async () => {
    const { routeGenerationRequest } = await contracts();
    const result = routeGenerationRequest(
        { capability: 't2i', policy: { privacy: 'cloud-ok', cost: 'prefer-free' } },
        [
            provider({ id: 'local' }),
            provider({
                id: 'cloud',
                execution: 'cloud',
                trustBoundary: 'third-party',
                metering: 'credits',
                credentials: 'available',
            }),
        ],
    );

    assert.equal(result.reason, 'SELECTED');
    assert.equal(result.selected.provider.id, 'local');
    assert.equal(result.candidates.length, 2);
});

test('router returns structured rejection when nothing is eligible', async () => {
    const { routeGenerationRequest } = await contracts();
    const result = routeGenerationRequest(
        { capability: 't2v', policy: { privacy: 'device-only', cost: 'free-only' } },
        [provider({ id: 'image-only' })],
    );

    assert.equal(result.selected, null);
    assert.equal(result.reason, 'NO_ELIGIBLE_PROVIDER');
    assert.equal(result.rejected.length, 1);
    assert.ok(result.rejected[0].reasons.includes('capability-or-output-mismatch'));
});

test('router tie-breaking is deterministic by provider id', async () => {
    const { routeGenerationRequest } = await contracts();
    const result = routeGenerationRequest(
        { capability: 't2i' },
        [provider({ id: 'zeta' }), provider({ id: 'alpha' })],
    );
    assert.equal(result.selected.provider.id, 'alpha');
});
