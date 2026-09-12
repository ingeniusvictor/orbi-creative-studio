const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MUAPI_BASE_URL,
    normalizeMuapiPath,
    normalizeMethod,
    authenticatedRequest,
    authenticatedUpload,
} = require('../electron/lib/muapiTransportCore');

function response({ status = 200, body = '{}' } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        async text() { return body; },
    };
}

test('MuAPI path policy accepts only relative /api/v1 paths', () => {
    assert.equal(normalizeMuapiPath('/api/v1/test-model?x=1'), '/api/v1/test-model?x=1');
    assert.throws(() => normalizeMuapiPath('https://evil.example/api/v1/test'), /requires an \/api\/v1\/ path/);
    assert.throws(() => normalizeMuapiPath('/api/v1/../admin'), /invalid/);
    assert.throws(() => normalizeMuapiPath('/other/path'), /requires an \/api\/v1\/ path/);
    assert.equal(normalizeMethod('post'), 'POST');
    assert.throws(() => normalizeMethod('DELETE'), /Only GET and POST/);
});

test('authenticatedRequest attaches the secure-store key only in main-process transport', async () => {
    let observed;
    const store = { getSecret: () => 'super-secret-key' };
    const fetchImpl = async (url, options) => {
        observed = { url, options };
        return response({ body: JSON.stringify({ request_id: 'req-1' }) });
    };

    const result = await authenticatedRequest({
        store,
        fetchImpl,
        request: {
            path: '/api/v1/model-name',
            method: 'POST',
            body: { prompt: 'hello' },
        },
    });

    assert.equal(observed.url, `${MUAPI_BASE_URL}/api/v1/model-name`);
    assert.equal(observed.options.headers['x-api-key'], 'super-secret-key');
    assert.equal(observed.options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(observed.options.body), { prompt: 'hello' });
    assert.deepEqual(result.data, { request_id: 'req-1' });
    assert.equal(JSON.stringify(result).includes('super-secret-key'), false);
});

test('authenticatedRequest fails closed when secure credential is missing', async () => {
    await assert.rejects(
        authenticatedRequest({
            store: { getSecret: () => null },
            fetchImpl: async () => response(),
            request: { path: '/api/v1/test', method: 'GET' },
        }),
        (error) => error.code === 'MUAPI_CREDENTIAL_MISSING',
    );
});

test('authenticatedUpload sends bytes to the fixed MuAPI upload endpoint without exposing the key', async () => {
    let observed;
    const store = { getSecret: () => 'upload-secret' };
    const fetchImpl = async (url, options) => {
        observed = { url, options };
        return response({ body: JSON.stringify({ url: 'https://cdn.example/file.png' }) });
    };

    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await authenticatedUpload({
        store,
        fetchImpl,
        payload: { name: '../unsafe.png', type: 'image/png', bytes },
    });

    assert.equal(observed.url, `${MUAPI_BASE_URL}/api/v1/upload_file`);
    assert.equal(observed.options.headers['x-api-key'], 'upload-secret');
    assert.ok(observed.options.body instanceof FormData);
    assert.equal(result.data.url, 'https://cdn.example/file.png');
    assert.equal(JSON.stringify(result).includes('upload-secret'), false);
});
