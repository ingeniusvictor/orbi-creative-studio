const MUAPI_STORAGE_KEY = 'muapi_key';

function getStorage() {
    if (typeof globalThis === 'undefined') return null;
    const storage = globalThis.localStorage;
    return storage && typeof storage.getItem === 'function' ? storage : null;
}

export function getMuapiKey() {
    if (typeof globalThis !== 'undefined') {
        const injected = globalThis.window?.__MUAPI_KEY__;
        if (typeof injected === 'string' && injected.trim()) {
            return injected.trim();
        }
    }

    const value = getStorage()?.getItem(MUAPI_STORAGE_KEY);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function setMuapiKey(value) {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!key) throw new Error('MuAPI key must be a non-empty string');

    const storage = getStorage();
    if (!storage || typeof storage.setItem !== 'function') {
        throw new Error('Credential storage is unavailable in this environment');
    }

    storage.setItem(MUAPI_STORAGE_KEY, key);
    return key;
}

export function clearMuapiKey() {
    const storage = getStorage();
    if (storage && typeof storage.removeItem === 'function') {
        storage.removeItem(MUAPI_STORAGE_KEY);
    }
}

export function hasMuapiKey() {
    return Boolean(getMuapiKey());
}

export { MUAPI_STORAGE_KEY };
