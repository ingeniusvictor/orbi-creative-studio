const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function session() {
    return import('../src/lib/computeRouter/paritySession.mjs');
}

function shadowReport(overrides = {}) {
    return {
        schemaVersion: 1,
        mode: 'shadow-only',
        operation: 't2i',
        modelId: 'z-image-turbo',
        expectedProviderId: 'sdcpp-device',
        selectedProviderId: 'sdcpp-device',
        parity: 'match',
        reason: 'SELECTED',
        rejected: [],
        ...overrides,
    };
}

class FakeEventTarget {
    constructor() {
        this.listeners = new Map();
        this.addCalls = 0;
        this.removeCalls = 0;
    }

    addEventListener(type, handler) {
        this.addCalls += 1;
        this.listeners.set(type, handler);
    }

    removeEventListener(type, handler) {
        this.removeCalls += 1;
        if (this.listeners.get(type) === handler) {
            this.listeners.delete(type);
        }
    }

    emit(type, detail) {
        this.listeners.get(type)?.({ type, detail });
    }
}

test('session collector starts once and records sanitized shadow evidence', async () => {
    const {
        clearStudioParitySessionEvidence,
        getStudioParitySessionEvidence,
        getStudioParitySessionState,
        startStudioParitySessionCollector,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const target = new FakeEventTarget();
    startStudioParitySessionCollector({ eventTarget: target });
    startStudioParitySessionCollector({ eventTarget: target });

    assert.equal(target.addCalls, 1);
    assert.equal(getStudioParitySessionState().started, true);

    target.emit('orbi:compute-router-shadow', {
        ...shadowReport(),
        prompt: 'private prompt',
        apiKey: 'secret',
        image_url: 'https://private.invalid/input',
    });

    const evidence = getStudioParitySessionEvidence();
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].expectedProviderId, 'sdcpp-device');
    assert.equal(evidence[0].operation, 't2i');

    const serialized = JSON.stringify(evidence);
    assert.equal(serialized.includes('private prompt'), false);
    assert.equal(serialized.includes('secret'), false);
    assert.equal(serialized.includes('private.invalid'), false);

    stopStudioParitySessionCollector();
    assert.equal(target.removeCalls, 1);
});

test('invalid shadow events fail soft and do not poison the session ledger', async () => {
    const {
        clearStudioParitySessionEvidence,
        getStudioParitySessionEvidence,
        startStudioParitySessionCollector,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const target = new FakeEventTarget();
    startStudioParitySessionCollector({ eventTarget: target });

    target.emit('orbi:compute-router-shadow', {
        ...shadowReport(),
        expectedProviderId: 'unknown-provider',
        selectedProviderId: 'unknown-provider',
    });
    target.emit('other-event', shadowReport());
    target.emit('orbi:compute-router-shadow', null);

    assert.deepEqual(getStudioParitySessionEvidence(), []);
    stopStudioParitySessionCollector();
});

test('session evidence can be evaluated by P1B.9 without granting execution authority', async () => {
    const {
        clearStudioParitySessionEvidence,
        evaluateStudioParitySession,
        startStudioParitySessionCollector,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const target = new FakeEventTarget();
    startStudioParitySessionCollector({ eventTarget: target });

    for (let i = 0; i < 3; i += 1) {
        target.emit('orbi:compute-router-shadow', shadowReport());
    }

    const result = evaluateStudioParitySession([{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 3,
    }]);

    assert.equal(result.certified, true);
    assert.equal(result.reason, 'PARITY_CERTIFIED');
    stopStudioParitySessionCollector();
});

test('session clear removes evidence without affecting listener lifecycle', async () => {
    const {
        clearStudioParitySessionEvidence,
        getStudioParitySessionEvidence,
        getStudioParitySessionState,
        startStudioParitySessionCollector,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const target = new FakeEventTarget();
    startStudioParitySessionCollector({ eventTarget: target });
    target.emit('orbi:compute-router-shadow', shadowReport());

    assert.equal(getStudioParitySessionState().sampleCount, 1);
    clearStudioParitySessionEvidence();
    assert.equal(getStudioParitySessionEvidence().length, 0);
    assert.equal(getStudioParitySessionState().started, true);

    stopStudioParitySessionCollector();
});

test('renderer bootstrap starts exactly one session collector and exposes no global parity API', () => {
    const main = fs.readFileSync('src/main.js', 'utf8');
    const sessionModule = fs.readFileSync('src/lib/computeRouter/paritySession.mjs', 'utf8');

    assert.equal((main.match(/startStudioParitySessionCollector\(\);/g) || []).length, 1);
    assert.equal(sessionModule.includes('localStorage'), false);
    assert.equal(sessionModule.includes('sessionStorage'), false);
    assert.equal(sessionModule.includes('fetch('), false);
    assert.equal(sessionModule.includes('window.orbiRouterParity'), false);
    assert.equal(sessionModule.includes('globalThis.orbiRouterParity'), false);
});
