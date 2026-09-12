const test = require('node:test');
const assert = require('node:assert/strict');

function createStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem(key) { return map.has(key) ? map.get(key) : null; },
        setItem(key, value) { map.set(key, String(value)); },
        removeItem(key) { map.delete(key); },
        snapshot() { return Object.fromEntries(map); },
    };
}

function cleanupGlobals() {
    delete global.window;
    delete global.localStorage;
    delete global.document;
    delete global.location;
}

async function loadModule() {
    return import('../src/lib/providerCredentials.mjs');
}

test.afterEach(cleanupGlobals);

test('getMuapiKey prefers injected runtime key over browser storage', async () => {
    const storage = createStorage({ muapi_key: 'stored-key' });
    global.localStorage = storage;
    global.window = { __MUAPI_KEY__: ' injected-key ' };

    const { getMuapiKey } = await loadModule();
    assert.equal(getMuapiKey(), 'injected-key');
});

test('MuAPI credential helper reads writes and clears compatibility storage', async () => {
    const storage = createStorage();
    global.localStorage = storage;
    global.window = {};

    const { getMuapiKey, setMuapiKey, clearMuapiKey, hasMuapiKey } = await loadModule();

    assert.equal(getMuapiKey(), null);
    assert.equal(hasMuapiKey(), false);
    assert.equal(setMuapiKey('  abc123  '), 'abc123');
    assert.equal(storage.snapshot().muapi_key, 'abc123');
    assert.equal(getMuapiKey(), 'abc123');
    assert.equal(hasMuapiKey(), true);

    clearMuapiKey();
    assert.equal(getMuapiKey(), null);
});

test('getMuapiKey uses cookie only when compatibility fallback is requested', async () => {
    global.localStorage = createStorage();
    global.window = {};
    global.document = { cookie: 'other=value; muapi_key=cookie%20key' };

    const { getMuapiKey } = await loadModule();
    assert.equal(getMuapiKey(), null);
    assert.equal(getMuapiKey({ includeCookie: true }), 'cookie key');
});

test('storage continues to win over the compatibility cookie', async () => {
    global.localStorage = createStorage({ muapi_key: 'stored-key' });
    global.window = {};
    global.document = { cookie: 'muapi_key=cookie-key' };

    const { getMuapiKey } = await loadModule();
    assert.equal(getMuapiKey({ includeCookie: true }), 'stored-key');
});

test('MuAPI cookie helper writes encoded compatibility cookie with secure policy on HTTPS', async () => {
    global.document = { cookie: '' };
    global.location = { protocol: 'https:' };

    const { syncMuapiKeyCookie } = await loadModule();
    assert.equal(syncMuapiKeyCookie(' key/with spaces '), true);
    assert.match(global.document.cookie, /^muapi_key=key%2Fwith%20spaces;/);
    assert.match(global.document.cookie, /max-age=31536000/);
    assert.match(global.document.cookie, /SameSite=Lax/);
    assert.match(global.document.cookie, /; Secure$/);
});

test('MuAPI cookie helper clears compatibility cookie without requiring storage', async () => {
    global.document = { cookie: 'muapi_key=old-key' };
    global.location = { protocol: 'http:' };

    const { clearMuapiKeyCookie } = await loadModule();
    assert.equal(clearMuapiKeyCookie(), true);
    assert.equal(global.document.cookie, 'muapi_key=; path=/; max-age=0; SameSite=Lax');
});

test('setMuapiKey rejects empty credentials and unavailable storage', async () => {
    cleanupGlobals();

    const { setMuapiKey } = await loadModule();
    assert.throws(() => setMuapiKey('   '), /non-empty/);
    assert.throws(() => setMuapiKey('abc'), /storage is unavailable/);
});
