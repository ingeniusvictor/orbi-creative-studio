const MUAPI_STORAGE_KEY = 'muapi_key';
const MUAPI_COOKIE_NAME = 'muapi_key';
const MUAPI_COOKIE_MAX_AGE_SECONDS = 31536000;

let desktopMigrationPromise = null;

function normalizeKey(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getDesktopCredentialBridge() {
    try {
        const bridge = globalThis.window?.orbiCredentials;
        return bridge && bridge.isElectron === true ? bridge : null;
    } catch {
        return null;
    }
}

export function isDesktopCredentialRuntime() {
    return Boolean(getDesktopCredentialBridge());
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

function readLegacyMuapiKey({ includeCookie = true } = {}) {
    let injected = null;
    try {
        injected = normalizeKey(globalThis.window?.__MUAPI_KEY__);
    } catch {
        injected = null;
    }
    if (injected) return injected;

    const stored = normalizeKey(getStorage()?.getItem(MUAPI_STORAGE_KEY));
    if (stored) return stored;

    return includeCookie ? readCookie(MUAPI_COOKIE_NAME) : null;
}

function clearLegacyStorage() {
    const storage = getStorage();
    if (storage && typeof storage.removeItem === 'function') {
        storage.removeItem(MUAPI_STORAGE_KEY);
    }
}

function clearLegacyCookie() {
    const documentRef = getDocument();
    if (!documentRef) return false;
    documentRef.cookie = `${MUAPI_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${cookieSecureSuffix()}`;
    return true;
}

function clearInjectedLegacyKey() {
    try {
        if (globalThis.window && Object.prototype.hasOwnProperty.call(globalThis.window, '__MUAPI_KEY__')) {
            delete globalThis.window.__MUAPI_KEY__;
        }
    } catch {
        // Runtime injection may be non-configurable; secure storage still becomes authoritative.
    }
}

function readinessUsable(readiness) {
    return Boolean(
        readiness
        && readiness.available === true
        && readiness.secure === true
        && readiness.hasSecret === true
        && readiness.storeState !== 'corrupt'
    );
}

export function getMuapiKey({ includeCookie = false } = {}) {
    // Electron must never hand the provider secret back to renderer JavaScript.
    if (isDesktopCredentialRuntime()) return null;

    if (typeof globalThis !== 'undefined') {
        const injected = normalizeKey(globalThis.window?.__MUAPI_KEY__);
        if (injected) return injected;
    }

    const stored = normalizeKey(getStorage()?.getItem(MUAPI_STORAGE_KEY));
    if (stored) return stored;

    return includeCookie ? readCookie(MUAPI_COOKIE_NAME) : null;
}

export function setMuapiKey(value) {
    if (isDesktopCredentialRuntime()) {
        throw new Error('Electron provider credentials must be stored through setMuapiCredential()');
    }

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
    clearLegacyStorage();
}

export async function migrateLegacyMuapiCredential() {
    const bridge = getDesktopCredentialBridge();
    if (!bridge) return { desktop: false, migrated: false, readiness: null };

    if (!desktopMigrationPromise) {
        desktopMigrationPromise = (async () => {
            const legacyKey = readLegacyMuapiKey({ includeCookie: true });
            let migrated = false;

            if (legacyKey) {
                // Legacy renderer storage is treated as the latest compatibility value
                // during this one-time S3C migration, then deleted only after secure set succeeds.
                await bridge.setMuapiKey(legacyKey);
                clearLegacyStorage();
                clearLegacyCookie();
                clearInjectedLegacyKey();
                migrated = true;
            }

            const readiness = await bridge.getMuapiReadiness();
            return { desktop: true, migrated, readiness };
        })().finally(() => {
            desktopMigrationPromise = null;
        });
    }

    return desktopMigrationPromise;
}

export async function getMuapiCredentialReadiness() {
    const bridge = getDesktopCredentialBridge();
    if (!bridge) {
        return {
            desktop: false,
            available: Boolean(getMuapiKey()),
            secure: false,
            hasSecret: Boolean(getMuapiKey()),
            storeState: 'browser-compatibility',
        };
    }

    const migration = await migrateLegacyMuapiCredential();
    return { desktop: true, ...migration.readiness };
}

export async function hasMuapiCredential() {
    try {
        const readiness = await getMuapiCredentialReadiness();
        return readiness.desktop ? readinessUsable(readiness) : Boolean(readiness.hasSecret);
    } catch (error) {
        console.error('[Credentials] Unable to resolve MuAPI credential readiness:', error);
        return false;
    }
}

export async function setMuapiCredential(value) {
    const key = normalizeKey(value);
    if (!key) throw new Error('MuAPI key must be a non-empty string');

    const bridge = getDesktopCredentialBridge();
    if (!bridge) return setMuapiKey(key);

    const result = await bridge.setMuapiKey(key);
    clearLegacyStorage();
    clearLegacyCookie();
    clearInjectedLegacyKey();
    return { desktop: true, ...result };
}

export async function clearMuapiCredential() {
    const bridge = getDesktopCredentialBridge();
    clearLegacyStorage();
    clearLegacyCookie();
    clearInjectedLegacyKey();

    if (!bridge) return { desktop: false, deleted: true };
    return bridge.deleteMuapiKey();
}

export async function ensureDesktopMuapiCredential() {
    const bridge = getDesktopCredentialBridge();
    if (!bridge) return { desktop: false, ready: false };

    const readiness = await getMuapiCredentialReadiness();
    if (!readinessUsable(readiness)) {
        const error = new Error('MuAPI credential is not available in secure desktop storage');
        error.code = 'MUAPI_CREDENTIAL_MISSING';
        error.readiness = readiness;
        throw error;
    }

    return { desktop: true, ready: true, readiness };
}

export function syncMuapiKeyCookie(value) {
    if (isDesktopCredentialRuntime()) return false;

    const key = normalizeKey(value);
    if (!key) throw new Error('MuAPI key must be a non-empty string');

    const documentRef = getDocument();
    if (!documentRef) return false;

    documentRef.cookie = `${MUAPI_COOKIE_NAME}=${encodeURIComponent(key)}; path=/; max-age=${MUAPI_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${cookieSecureSuffix()}`;
    return true;
}

export function clearMuapiKeyCookie() {
    return clearLegacyCookie();
}

export function hasMuapiKey(options) {
    return Boolean(getMuapiKey(options));
}

export { MUAPI_STORAGE_KEY, MUAPI_COOKIE_NAME, MUAPI_COOKIE_MAX_AGE_SECONDS };
