'use strict';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const LOCAL_ONLY_ERROR_CODES = new Set([
    'INVALID_MUAPI_PATH',
    'INVALID_MUAPI_METHOD',
    'MUAPI_BODY_TOO_LARGE',
    'MUAPI_CREDENTIAL_MISSING',
    'INVALID_UPLOAD',
    'UPLOAD_TOO_LARGE',
    'SECURE_STORAGE_UNAVAILABLE',
    'STORE_CORRUPT',
    'DECRYPT_FAILED',
    'INVALID_IDENTIFIER',
    'INVALID_SECRET',
]);

function createMuapiHealthTracker({
    now = Date.now,
    ttlMs = DEFAULT_TTL_MS,
} = {}) {
    if (typeof now !== 'function') throw new TypeError('now must be a function');
    if (!Number.isFinite(Number(ttlMs)) || Number(ttlMs) <= 0) {
        throw new TypeError('ttlMs must be a positive number');
    }

    const ttl = Number(ttlMs);
    let observation = null;

    function observe(ok) {
        observation = {
            ok: ok === true,
            observedAt: Number(now()),
        };
    }

    function recordResponse(result) {
        const status = Number(result?.status) || 0;

        if (result?.ok === true && status >= 200 && status < 300) {
            observe(true);
            return;
        }

        // Authentication rejection and server-side failures are strong enough
        // negative evidence to prevent cloud promotion. Request-specific 4xx
        // errors (400/404/422/429) do not prove the transport itself is down.
        if (status === 401 || status === 403 || status >= 500) {
            observe(false);
        }
    }

    function recordError(error) {
        const code = typeof error?.code === 'string' ? error.code : '';
        if (LOCAL_ONLY_ERROR_CODES.has(code)) return;

        // Only errors that escaped the local validation/credential layer reach
        // this observation as transport-level negative evidence.
        observe(false);
    }

    function getHealthSnapshot() {
        if (!observation) return undefined;

        const age = Number(now()) - observation.observedAt;
        if (!Number.isFinite(age) || age < 0 || age > ttl) {
            return undefined;
        }

        return Object.freeze({ ok: observation.ok });
    }

    return Object.freeze({
        recordResponse,
        recordError,
        getHealthSnapshot,
    });
}

module.exports = {
    DEFAULT_TTL_MS,
    LOCAL_ONLY_ERROR_CODES,
    createMuapiHealthTracker,
};
