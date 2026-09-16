const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function createShadowEvaluation({ width = 1024, height = 1024 } = {}) {
    return Object.freeze({
        mode: 'shadow-diagnostic-only',
        context: Object.freeze({
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width,
            height,
        }),
        registryMatch: true,
        compatibility: Object.freeze({
            schemaVersion: 1,
            status: 'COMPATIBILITY_CANDIDATE',
            compatibilityCandidate: true,
            routingEligible: false,
            runtime: Object.freeze({
                exists: true,
                backend: 'cuda12',
                manifestPinned: true,
                installedIntegrityVerified: true,
            }),
            model: Object.freeze({
                id: 'z-image-turbo',
                installed: true,
                auxiliaryReady: true,
            }),
            backendHardware: Object.freeze({
                state: 'supported',
                reasons: Object.freeze([]),
            }),
            resourceFit: Object.freeze({
                systemRam: 'sufficient',
                vram: 'sufficient',
                minSystemRamMiB: 10200,
                minVramMiB: 7440,
                observedSystemRamMiB: 32768,
                observedVramMiB: 12288,
                reasons: Object.freeze([]),
            }),
            resourceProfile: Object.freeze({
                status: 'RESOURCE_PROFILE_CERTIFIED',
                certified: true,
                reason: null,
            }),
            reasons: Object.freeze([]),
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function createRegistry({ evaluate = () => createShadowEvaluation() } = {}) {
    return Object.freeze({
        schemaVersion: 1,
        mode: 'immutable-shadow-registry',
        evaluateShadowCompatibility: evaluate,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function producerInput(registry, capturedAt = '2026-09-16T09:00:00.000Z') {
    return {
        registry,
        runtime: { backend: 'cuda12' },
        model: { id: 'z-image-turbo' },
        hardware: {},
        width: 1024,
        height: 1024,
        capturedAt,
    };
}

test('P1C13 produces a P1C10 snapshot and publishes it only through P1C12 handoff', async () => {
    const [producerModule, handoffModule, diagnosticsModule] = await Promise.all([
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotProducer.mjs'),
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs'),
        import('../src/lib/computeRouter/shadowCompatibilityDiagnostics.mjs'),
    ]);

    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();
    const producer = producerModule.createShadowCompatibilitySnapshotProducer({
        publishSnapshot: handoff.publish,
    });

    const result = producer.produce(producerInput(createRegistry()));
    assert.equal(result.status, 'SHADOW_SNAPSHOT_PRODUCER_PUBLISHED');
    assert.equal(result.reason, null);
    assert.equal(result.compatibilityStatus, 'COMPATIBILITY_CANDIDATE');
    assert.equal(result.handoffStatus, 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const snapshot = handoff.read();
    assert.equal(snapshot.snapshotType, 'p1c10-shadow-compatibility-diagnostics');
    assert.equal(snapshot.context.modelId, 'z-image-turbo');
    assert.equal(snapshot.context.backend, 'cuda12');
    assert.equal(snapshot.context.width, 1024);
    assert.equal(snapshot.context.height, 1024);
    assert.deepEqual(diagnosticsModule.validateShadowCompatibilitySnapshot(snapshot), {
        ok: true,
        reason: null,
    });
});

test('P1C13 fails closed before evaluation when registry authority is invalid', async () => {
    const [producerModule, handoffModule] = await Promise.all([
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotProducer.mjs'),
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs'),
    ]);
    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();
    const producer = producerModule.createShadowCompatibilitySnapshotProducer({
        publishSnapshot: handoff.publish,
    });

    const registry = {
        ...createRegistry(),
        routingEligible: true,
    };
    const result = producer.produce(producerInput(registry));

    assert.equal(result.status, 'SHADOW_SNAPSHOT_PRODUCER_REJECTED');
    assert.equal(result.reason, 'PRODUCER_REGISTRY_INVALID');
    assert.equal(handoff.read(), null);
});

test('P1C13 rejects a registry evaluation whose exact context does not match the request', async () => {
    const [producerModule, handoffModule] = await Promise.all([
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotProducer.mjs'),
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs'),
    ]);
    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();
    const producer = producerModule.createShadowCompatibilitySnapshotProducer({
        publishSnapshot: handoff.publish,
    });
    const registry = createRegistry({
        evaluate: () => createShadowEvaluation({ width: 512, height: 512 }),
    });

    const result = producer.produce(producerInput(registry));
    assert.equal(result.status, 'SHADOW_SNAPSHOT_PRODUCER_REJECTED');
    assert.equal(result.reason, 'DIAGNOSTIC_CONTEXT_MISMATCH');
    assert.equal(handoff.read(), null);
});

test('P1C13 maps P1C12 idempotent and stale outcomes without overriding evidence', async () => {
    const [producerModule, handoffModule] = await Promise.all([
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotProducer.mjs'),
        import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs'),
    ]);
    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();
    const producer = producerModule.createShadowCompatibilitySnapshotProducer({
        publishSnapshot: handoff.publish,
    });
    const registry = createRegistry();

    const first = producer.produce(producerInput(registry, '2026-09-16T09:00:00.000Z'));
    assert.equal(first.status, 'SHADOW_SNAPSHOT_PRODUCER_PUBLISHED');

    const same = producer.produce(producerInput(registry, '2026-09-16T09:00:00.000Z'));
    assert.equal(same.status, 'SHADOW_SNAPSHOT_PRODUCER_UNCHANGED');

    const stale = producer.produce(producerInput(registry, '2026-09-16T08:59:59.000Z'));
    assert.equal(stale.status, 'SHADOW_SNAPSHOT_PRODUCER_REJECTED');
    assert.equal(stale.reason, 'HANDOFF_SNAPSHOT_OLDER_THAN_CURRENT');
    assert.equal(stale.handoffStatus, 'SHADOW_SNAPSHOT_HANDOFF_STALE');
    assert.equal(handoff.read().capturedAt, '2026-09-16T09:00:00.000Z');
});

test('P1C13 catches evaluator and handoff failures without reflecting arbitrary exception text', async () => {
    const producerModule = await import('../src/lib/computeRouter/shadowCompatibilitySnapshotProducer.mjs');

    const evaluateFailure = producerModule.createShadowCompatibilitySnapshotProducer({
        publishSnapshot: () => {
            throw new Error('publisher secret');
        },
    });
    const throwingRegistry = createRegistry({
        evaluate: () => {
            throw new Error('registry secret');
        },
    });
    assert.equal(
        evaluateFailure.produce(producerInput(throwingRegistry)).reason,
        'PRODUCER_EVALUATION_FAILED',
    );

    const publisherFailure = producerModule.createShadowCompatibilitySnapshotProducer({
        publishSnapshot: () => {
            throw new Error('publisher secret');
        },
    });
    const result = publisherFailure.produce(producerInput(createRegistry()));
    assert.equal(result.reason, 'PRODUCER_HANDOFF_FAILED');
    assert.equal(JSON.stringify(result).includes('publisher secret'), false);
});

test('P1C13 producer remains off startup and generation surfaces', () => {
    const producer = read('src/lib/computeRouter/shadowCompatibilitySnapshotProducer.mjs');
    const main = read('src/main.js');
    const settings = read('src/components/SettingsModal.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const token of [
        'node:fs',
        "from 'fs'",
        'fetch(',
        'ipcMain',
        'ipcRenderer',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'setInterval',
        'setTimeout',
        'routeGenerationRequest',
    ]) {
        assert.equal(producer.includes(token), false, `unexpected P1C13 capability: ${token}`);
    }

    for (const source of [main, settings, image, video]) {
        assert.equal(source.includes('shadowCompatibilitySnapshotProducer'), false);
        assert.equal(source.includes('produceAndPublishShadowCompatibilitySnapshot'), false);
    }

    assert.ok(producer.includes('routingEligible: false'));
    assert.ok(producer.includes('cutoverAuthorized: false'));
    assert.ok(producer.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.equal(producer.includes('routingEligible: true'), false);
    assert.equal(producer.includes('cutoverAuthorized: true'), false);
});
