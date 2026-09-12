const MUAPI_STORAGE_KEY = 'muapi_key';
const MUAPI_COOKIE_NAME = 'muapi_key';
const MUAPI_COOKIE_MAX_AGE_SECONDS = 31536000;

function normalizeKey(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getStorage() {
    if (typeof globalThis === 'undefined') return null;
    try {
        const storage = globalThis.localStorage;
        return storage && typeof storage.getItem === 'function' ? storage : null;
    } catch {
        return null;
    }
}

function getDocument() {
    if (typeof globalThis === 'undefined') return null;
    try {
        const documentRef = globalThis.document;
        return documentRef && typeof documentRef.cookie === 'string' ? documentRef : null;
    } catch {
        return null;
    }
}

function readCookie(name) {
    const documentRef = getDocument();
    if (!documentRef?.cookie) return null;

    const prefix = `${name}=`;
    for (const part of documentRef.cookie.split(';')) {
        const candidate = part.trim();
        if (!candidate.startsWith(prefix)) continue;
        const rawValue = candidate.slice(prefix.length);
        try {
            return normalizeKey(decodeURIComponent(rawValue));
        } catch {
            return normalizeKey(rawValue);
        }
    }
    return null;
}

function cookieSecureSuffix() {
    try {
        return globalThis.location?.protocol === 'https:' ? '; Secure' : '';
    } catch {
        return '';
    }
}

export function getMuapiKey({ includeCookie = false } = {}) {
    if (typeof globalThis !== 'undefined') {
        const injected = normalizeKey(globalThis.window?.__MUAPI_KEY__);
        if (injected) return injected;
    }

    const stored = normalizeKey(getStorage()?.getItem(MUAPI_STORAGE_KEY));
    if (stored) return stored;

    return includeCookie ? readCookie(MUAPI_COOKIE_NAME) : null;
}

export function setMuapiKey(value) {
    const key = normalizeKey(value);
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

export function syncMuapiKeyCookie(value) {
    const key = normalizeKey(value);
    if (!key) throw new Error('MuAPI key must be a non-empty string');

    const documentRef = getDocument();
    if (!documentRef) return false;

    documentRef.cookie = `${MUAPI_COOKIE_NAME}=${encodeURIComponent(key)}; path=/; max-age=${MUAPI_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${cookieSecureSuffix()}`;
    return true;
}

export function clearMuapiKeyCookie() {
    const documentRef = getDocument();
    if (!documentRef) return false;

    documentRef.cookie = `${MUAPI_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${cookieSecureSuffix()}`;
    return true;
}

export function hasMuapiKey(options) {
    return Boolean(getMuapiKey(options));
}

export { MUAPI_STORAGE_KEY, MUAPI_COOKIE_NAME, MUAPI_COOKIE_MAX_AGE_SECONDS };
