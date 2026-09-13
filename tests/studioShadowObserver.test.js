const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
    buildProviderReadinessSnapshot,
} = require('../electron/lib/providerReadinessSnapshotCore');

async function observer() {
    return import('../src/lib/computeRouter/studioShadowObserver.mjs');
}

function localSnapshot() {
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

test('shadow observer strips prompt and unrelated Studio payload fields', async () => {
    const { routeFacts } = await observer();
    const facts = routeFacts({
        operation: 't2i',
        modelId: 'z-image-turbo',
        aspectRatio: '1:1',
        prompt: 'private prompt must not enter routing observation',
        image_url: 'https://private.invalid/input.png',
        apiKey: 'never',
    });

    assert.deepEqual(facts, {
        operation: 't2i',
        modelId: 'z-image-turbo',
        aspectRatio: '1:1',
        resolution: undefined,
        durationSeconds: undefined,
    });
    const serialized = JSON.stringify(facts);
    assert.equal(serialized.includes('private prompt'), false);
    assert.equal(serialized.includes('private.invalid'), false);
    assert.equal(serialized.includes('never'), false);
});

test('shadow observer emits a local parity report without becoming the executor', async () => {
    const { observeStudioShadowRoute } = await observer();
    let emitted = null;

    const report = await observeStudioShadowRoute({
        operation: 't2i',
        modelId: 'z-image-turbo',
    }, {
        getReadinessSnapshot: async () => localSnapshot(),
        reportSink: (value) => {
            emitted = value;
        },
    });

    assert.ok(report);
    assert.equal(report.mode, 'shadow-only');
    assert.equal(report.parity, 'match');
    assert.equal(report.selectedProviderId, 'sdcpp-device');
    assert.equal(emitted, report);
});

test('shadow observer fails soft when readiness is unavailable or throws', async () => {
    const { observeStudioShadowRoute } = await observer();

    assert.equal(await observeStudioShadowRoute({
        operation: 't2i',
        modelId: 'z-image-turbo',
    }, {
        getReadinessSnapshot: async () => null,
    }), null);

    assert.equal(await observeStudioShadowRoute({
        operation: 't2i',
        modelId: 'z-image-turbo',
    }, {
        getReadinessSnapshot: async () => {
            throw new Error('snapshot unavailable');
        },
    }), null);
});

test('shadow report sink cannot break observation or legacy execution', async () => {
    const { observeStudioShadowRoute } = await observer();

    const report = await observeStudioShadowRoute({
        operation: 't2i',
        modelId: 'z-image-turbo',
    }, {
        getReadinessSnapshot: async () => localSnapshot(),
        reportSink: () => {
            throw new Error('diagnostic listener failed');
        },
    });

    assert.ok(report);
    assert.equal(report.parity, 'match');
});

test('scheduled shadow observation starts asynchronously and does not require awaiting', async () => {
    const { scheduleStudioShadowObservation } = await observer();
    let snapshotStarted = false;
    let emitted = false;

    const returned = scheduleStudioShadowObservation({
        operation: 't2i',
        modelId: 'z-image-turbo',
    }, {
        getReadinessSnapshot: async () => {
            snapshotStarted = true;
            return localSnapshot();
        },
        reportSink: () => {
            emitted = true;
        },
    });

    assert.equal(returned, undefined);
    assert.equal(snapshotStarted, false);
    assert.equal(emitted, false);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(snapshotStarted, true);
    assert.equal(emitted, true);
});

test('Studio wiring is observational only and preserves every legacy generation dispatcher', () => {
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    assert.equal((image.match(/scheduleStudioShadowObservation\(\{/g) || []).length, 1);
    assert.equal((video.match(/scheduleStudioShadowObservation\(\{/g) || []).length, 1);
    assert.equal(image.includes('await scheduleStudioShadowObservation'), false);
    assert.equal(video.includes('await scheduleStudioShadowObservation'), false);

    for (const token of [
        'localAI.generate({',
        'muapi.generateI2I(genParams)',
        'muapi.generateImage(genParams)',
    ]) {
        assert.ok(image.includes(token), `ImageStudio legacy dispatcher missing: ${token}`);
    }

    for (const token of [
        'localAI.generate(localParams)',
        'muapi.processV2V(v2vParams)',
        'muapi.generateI2V(i2vParams)',
        'muapi.generateVideo(params)',
    ]) {
        assert.ok(video.includes(token), `VideoStudio legacy dispatcher missing: ${token}`);
    }
});
