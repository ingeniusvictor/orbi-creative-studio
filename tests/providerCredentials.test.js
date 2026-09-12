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

async function loadModule() {
    return import('../src/lib/providerCredentials.mjs');
}

test('getMuapiKey prefers injected runtime key over browser storage', async () => {
    const storage = createStorage({ muapi_key: 'stored-key' });
    global.localStorage = storage;
    global.window = { __MUAPI_KEY__: ' injected-key ' };

    const { getMuapiKey } = await loadModule();
    assert.equal(getMuapiKey(), 'injected-key');

    delete global.window;
    delete global.localStorage;
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

    delete global.window;
    delete global.localStorage;
});

test('setMuapiKey rejects empty credentials and unavailable storage', async () => {
    delete global.window;
    delete global.localStorage;

    const { setMuapiKey } = await loadModule();
    assert.throws(() => setMuapiKey('   '), /non-empty/);
    assert.throws(() => setMuapiKey('abc'), /storage is unavailable/);
});
