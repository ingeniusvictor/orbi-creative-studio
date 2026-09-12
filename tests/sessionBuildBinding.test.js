const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function identityClient() {
    return import('../src/lib/computeRouter/buildIdentityClient.mjs');
}

async function session() {
    return import('../src/lib/computeRouter/paritySession.mjs');
}

class FakeEventTarget {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) this.listeners.delete(type);
    }
    emit(type, detail) { this.listeners.get(type)?.({ type, detail }); }
}

const BUILD_IDENTITY = Object.freeze({
    schemaVersion: 1,
    available: true,
    sourceCommit: 'a'.repeat(40),
    appVersion: '2.0.0',
    reason: null,
});

const ROUTES = [
    ['sdcpp-device', 't2i'],
    ['wan2gp-lan', 't2i'],
    ['wan2gp-lan', 't2v'],
    ['wan2gp-lan', 'i2v'],
    ['muapi-cloud', 't2i'],
    ['muapi-cloud', 'i2i'],
    ['muapi-cloud', 't2v'],
    ['muapi-cloud', 'i2v'],
    ['muapi-cloud', 'v2v'],
];

function shadowReport(provider, operation, index = 0) {
    return {
        schemaVersion: 1,
        mode: 'shadow-only',
        operation,
        modelId: `${provider}:${operation}:model`,
        expectedProviderId: provider,
        selectedProviderId: provider,
        parity: 'match',
        reason: 'SELECTED',
        rejected: [],
        prompt: `private-${index}`,
        apiKey: 'secret',
    };
}

test('renderer build identity client normalizes exact static preload metadata', async () => {
    const { normalizeRendererBuildIdentity, requireRendererBuildIdentity } = await identityClient();

    const normalized = normalizeRendererBuildIdentity({
        ...BUILD_IDENTITY,
        sourceCommit: 'A'.repeat(40),
    });
    assert.equal(normalized.available, true);
    assert.equal(normalized.sourceCommit, 'a'.repeat(40));
    assert.equal(normalized.appVersion, '2.0.0');

    assert.throws(
        () => requireRendererBuildIdentity({ ...BUILD_IDENTITY, available: false }),
        (error) => error.code === 'BUILD_IDENTITY_UNAVAILABLE',
    );
});

test('empty session binds as rejected rather than inventing parity certification', async () => {
    const {
        bindCurrentStudioParitySessionToBuild,
        clearStudioParitySessionEvidence,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const binding = bindCurrentStudioParitySessionToBuild({
        buildIdentity: BUILD_IDENTITY,
        boundAt: 1000,
    });

    assert.equal(binding.sourceCommit, BUILD_IDENTITY.sourceCommit);
    assert.equal(binding.bindingValid, false);
    assert.equal(binding.status, 'PARITY_CERTIFICATION_REJECTED');
    assert.equal(binding.cutoverAuthorized, false);
    assert.equal(binding.executionAuthority, 'legacy-dispatcher-only');
    assert.ok(binding.bindingId.includes(BUILD_IDENTITY.sourceCommit));
});

test('complete current Studio session binds certified parity to exact build SHA', async () => {
    const {
        bindCurrentStudioParitySessionToBuild,
        clearStudioParitySessionEvidence,
        startStudioParitySessionCollector,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const target = new FakeEventTarget();
    startStudioParitySessionCollector({ eventTarget: target });

    for (const [provider, operation] of ROUTES) {
        for (let index = 0; index < 10; index += 1) {
            target.emit('orbi:compute-router-shadow', shadowReport(provider, operation, index));
        }
    }

    const binding = bindCurrentStudioParitySessionToBuild({
        buildIdentity: BUILD_IDENTITY,
        bindingId: 'session-cert-1',
        boundAt: 2000,
    });

    assert.equal(binding.bindingValid, true);
    assert.equal(binding.status, 'PARITY_CERTIFICATION_BOUND');
    assert.equal(binding.sourceCommit, BUILD_IDENTITY.sourceCommit);
    assert.equal(binding.bindingId, 'session-cert-1');
    assert.equal(binding.certification.certified, true);
    assert.equal(binding.certification.routes.length, 9);
    assert.ok(binding.certification.routes.every((route) => route.samples === 10));

    const serialized = JSON.stringify(binding);
    assert.equal(serialized.includes('private-'), false);
    assert.equal(serialized.includes('secret'), false);

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();
});

test('session build binding requires available exact build identity', async () => {
    const { bindCurrentStudioParitySessionToBuild } = await session();

    assert.throws(
        () => bindCurrentStudioParitySessionToBuild({
            buildIdentity: {
                schemaVersion: 1,
                available: false,
                sourceCommit: null,
                appVersion: null,
            },
            boundAt: 1000,
        }),
        (error) => error.code === 'BUILD_IDENTITY_UNAVAILABLE',
    );

    assert.throws(
        () => bindCurrentStudioParitySessionToBuild({
            buildIdentity: BUILD_IDENTITY,
            boundAt: 0,
        }),
        (error) => error.code === 'INVALID_PARITY_SESSION_BINDING',
    );
});

test('P1B.20 remains explicit and is not auto-invoked by Studio bootstrap', () => {
    const paritySession = fs.readFileSync('src/lib/computeRouter/paritySession.mjs', 'utf8');
    const main = fs.readFileSync('src/main.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    assert.ok(paritySession.includes('bindCurrentStudioParitySessionToBuild'));
    assert.equal(main.includes('bindCurrentStudioParitySessionToBuild'), false);
    assert.equal(image.includes('bindCurrentStudioParitySessionToBuild'), false);
    assert.equal(video.includes('bindCurrentStudioParitySessionToBuild'), false);
});
