const test = require('node:test');
const assert = require('node:assert/strict');
const {
    HEALTH_PATH,
    createMuapiHealthProbe,
} = require('../electron/lib/muapiHealthProbe');
const { MUAPI_BASE_URL } = require('../electron/lib/muapiTransportCore');

function response({ status = 200, ok = status >= 200 && status < 300 } = {}) {
    let cancelled = false;
    return {
        ok,
        status,
        body: {
            async cancel() {
                cancelled = true;
            },
        },
        get cancelled() {
            return cancelled;
        },
    };
}

test('MuAPI readiness probe uses the fixed authenticated account endpoint and discards body', async () => {
    let observed;
    const apiResponse = response({ status: 200 });
    const store = {
        getSecret(provider, name) {
            assert.equal(provider, 'muapi');
            assert.equal(name, 'apiKey');
            return 'health-secret';
        },
    };
    const fetchImpl = async (url, options) => {
        observed = { url, options };
        return apiResponse;
    };

    const health = createMuapiHealthProbe({
        store,
        fetchImpl,
        cacheTtlMs: 0,
    });
    const result = await health.probe();

    assert.equal(observed.url, `${MUAPI_BASE_URL}${HEALTH_PATH}`);
    assert.equal(observed.options.method, 'GET');
    assert.equal(observed.options.headers['x-api-key'], 'health-secret');
    assert.deepEqual(result, { ok: true, status: 200 });
    assert.equal(apiResponse.cancelled, true);

    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('health-secret'), false);
    assert.equal(serialized.includes('balance'), false);
});

test('MuAPI readiness probe caches bounded health evidence and can be invalidated', async () => {
    let calls = 0;
    let clock = 1000;
    const health = createMuapiHealthProbe({
        store: { getSecret: () => 'secret' },
        fetchImpl: async () => {
            calls += 1;
            return response({ status: 200 });
        },
        cacheTtlMs: 30000,
        now: () => clock,
    });

    const first = await health.probe();
    const second = await health.probe();
    assert.equal(calls, 1);
    assert.equal(first, second);

    clock += 30001;
    await health.probe();
    assert.equal(calls, 2);

    health.invalidate();
    await health.probe();
    assert.equal(calls, 3);
});

test('MuAPI readiness probe coalesces concurrent requests', async () => {
    let calls = 0;
    let resolveFetch;
    const fetchImpl = () => {
        calls += 1;
        return new Promise((resolve) => {
            resolveFetch = () => resolve(response({ status: 200 }));
        });
    };

    const health = createMuapiHealthProbe({
        store: { getSecret: () => 'secret' },
        fetchImpl,
        cacheTtlMs: 0,
    });

    const first = health.probe();
    const second = health.probe();
    assert.equal(calls, 1);

    resolveFetch();
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual(a, { ok: true, status: 200 });
    assert.equal(a, b);
});

test('MuAPI readiness probe fails closed without exposing transport errors or secrets', async () => {
    const health = createMuapiHealthProbe({
        store: { getSecret: () => 'secret' },
        fetchImpl: async () => {
            throw new Error('network detail with secret');
        },
        cacheTtlMs: 0,
    });

    assert.deepEqual(await health.probe(), { ok: false, status: 0 });
});

test('MuAPI readiness probe preserves auth rejection status for fail-closed mapping', async () => {
    const health = createMuapiHealthProbe({
        store: { getSecret: () => 'expired-secret' },
        fetchImpl: async () => response({ status: 401, ok: false }),
        cacheTtlMs: 0,
    });

    assert.deepEqual(await health.probe(), { ok: false, status: 401 });
});
