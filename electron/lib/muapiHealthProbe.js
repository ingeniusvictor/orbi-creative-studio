'use strict';

const { MUAPI_BASE_URL } = require('./muapiTransportCore');

const HEALTH_PATH = '/api/v1/account/balance';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 30000;

function safeStatus(response) {
    const status = Number(response?.status);
    return Number.isFinite(status) && status >= 0 ? status : 0;
}

function createMuapiHealthProbe({
    store,
    fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    now = Date.now,
} = {}) {
    if (!store || typeof store.getSecret !== 'function') {
        throw new TypeError('Provider secret store with getSecret() is required');
    }
    if (typeof fetchImpl !== 'function') {
        throw new TypeError('fetch implementation is required');
    }

    let cached = null;
    let cachedAt = 0;
    let inFlight = null;

    async function runProbe() {
        let apiKey;
        try {
            apiKey = store.getSecret('muapi', 'apiKey');
        } catch {
            return Object.freeze({ ok: false, status: 0 });
        }

        if (!apiKey) {
            return Object.freeze({ ok: false, status: 0 });
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetchImpl(`${MUAPI_BASE_URL}${HEALTH_PATH}`, {
                method: 'GET',
                headers: { 'x-api-key': apiKey },
                signal: controller.signal,
            });

            const status = safeStatus(response);
            try {
                await response?.body?.cancel?.();
            } catch {
                // Headers are sufficient for readiness; response content is intentionally discarded.
            }

            return Object.freeze({
                ok: Boolean(response?.ok),
                status,
            });
        } catch {
            return Object.freeze({ ok: false, status: 0 });
        } finally {
            clearTimeout(timer);
        }
    }

    async function probe({ force = false } = {}) {
        const current = now();
        if (!force && cached && (current - cachedAt) < cacheTtlMs) {
            return cached;
        }
        if (inFlight) return inFlight;

        inFlight = runProbe()
            .then((result) => {
                cached = result;
                cachedAt = now();
                return result;
            })
            .finally(() => {
                inFlight = null;
            });

        return inFlight;
    }

    function invalidate() {
        cached = null;
        cachedAt = 0;
    }

    return Object.freeze({
        probe,
        invalidate,
    });
}

module.exports = {
    HEALTH_PATH,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_CACHE_TTL_MS,
    createMuapiHealthProbe,
};
