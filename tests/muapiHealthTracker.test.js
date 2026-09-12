const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_TTL_MS,
    createMuapiHealthTracker,
} = require('../electron/lib/muapiHealthTracker');
const {
    buildReadinessSnapshot,
} = require('../electron/lib/computeRouterReadinessSnapshot');

test('passive MuAPI health starts unknown and performs no active probe', () => {
    let now = 1000;
    const tracker = createMuapiHealthTracker({ now: () => now });

    assert.equal(tracker.getHealthSnapshot(), undefined);
    assert.equal(typeof tracker.recordResponse, 'function');
    assert.equal(typeof tracker.recordError, 'function');
});

test('successful existing MuAPI traffic records fresh usable transport evidence', () => {
    let now = 1000;
    const tracker = createMuapiHealthTracker({ now: () => now });

    tracker.recordResponse({ ok: true, status: 200, data: { request_id: 'r1' } });
    assert.deepEqual(tracker.getHealthSnapshot(), { ok: true });

    now += DEFAULT_TTL_MS + 1;
    assert.equal(tracker.getHealthSnapshot(), undefined);
});

test('authentication rejection and server failures block passive health promotion', () => {
    for (const status of [401, 403, 500, 503]) {
        const tracker = createMuapiHealthTracker();
        tracker.recordResponse({ ok: false, status });
        assert.deepEqual(tracker.getHealthSnapshot(), { ok: false });
    }
});

test('request-specific 4xx and rate limiting do not invent offline transport state', () => {
    for (const status of [400, 404, 422, 429]) {
        const tracker = createMuapiHealthTracker();
        tracker.recordResponse({ ok: false, status });
        assert.equal(tracker.getHealthSnapshot(), undefined);
    }
});

test('local validation and credential errors are not mislabeled as network health', () => {
    for (const code of [
        'INVALID_MUAPI_PATH',
        'MUAPI_CREDENTIAL_MISSING',
        'SECURE_STORAGE_UNAVAILABLE',
        'STORE_CORRUPT',
    ]) {
        const tracker = createMuapiHealthTracker();
        tracker.recordError(Object.assign(new Error('local'), { code }));
        assert.equal(tracker.getHealthSnapshot(), undefined);
    }
});

test('unclassified escaped fetch error becomes negative transport evidence', () => {
    const tracker = createMuapiHealthTracker();
    tracker.recordError(Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' }));
    assert.deepEqual(tracker.getHealthSnapshot(), { ok: false });
});

test('passive observation does not expose status, URL, error, key, or timestamp', () => {
    const tracker = createMuapiHealthTracker();
    tracker.recordResponse({
        ok: true,
        status: 201,
        url: 'https://api.muapi.ai/api/v1/private',
        error: 'private',
        key: 'secret',
    });
    assert.deepEqual(Object.keys(tracker.getHealthSnapshot()), ['ok']);
});


test('fresh passive success can promote MuAPI readiness; expiry returns it to unknown', async () => {
    let now = 1000;
    const tracker = createMuapiHealthTracker({ now: () => now });
    tracker.recordResponse({ ok: true, status: 200 });

    const credentialReadiness = {
        available: true,
        secure: true,
        hasSecret: true,
        storeState: 'ready',
    };

    const { composeCurrentProviderReadiness } = await import('../src/lib/computeRouter/providerReadiness.mjs');

    const freshSnapshot = buildReadinessSnapshot({
        credentialReadiness,
        transportHealth: tracker.getHealthSnapshot(),
    });
    const freshProviders = composeCurrentProviderReadiness(freshSnapshot);
    const freshMuapi = freshProviders.find((provider) => provider.id === 'muapi-cloud');

    assert.equal(freshMuapi.credentials, 'available');
    assert.equal(freshMuapi.health, 'ready');

    now += DEFAULT_TTL_MS + 1;
    const staleSnapshot = buildReadinessSnapshot({
        credentialReadiness,
        transportHealth: tracker.getHealthSnapshot(),
    });
    const staleProviders = composeCurrentProviderReadiness(staleSnapshot);
    const staleMuapi = staleProviders.find((provider) => provider.id === 'muapi-cloud');

    assert.equal(staleMuapi.credentials, 'available');
    assert.equal(staleMuapi.health, 'unknown');
});
