import crypto from 'node:crypto';

export const PROVIDER_SESSION_COOKIE = 'orbi_muapi_session_v1';
export const PROVIDER_SESSION_ENV = 'ORBI_PROVIDER_SESSION_SECRET';
export const PROVIDER_SESSION_VERSION = 'v1';
export const PROVIDER_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const PROVIDER_ID = 'muapi';
const AES_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MAX_TOKEN_LENGTH = 4096;
const MAX_API_KEY_LENGTH = 2048;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const AAD = Buffer.from('orbi-provider-session|v1|muapi', 'utf8');

function sessionError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeApiKey(value) {
    if (typeof value !== 'string') {
        throw sessionError('INVALID_PROVIDER_KEY', 'Provider key must be a string');
    }
    const key = value.trim();
    if (!key || key.length > MAX_API_KEY_LENGTH) {
        throw sessionError('INVALID_PROVIDER_KEY', 'Provider key length is invalid');
    }
    return key;
}

function parseSessionSecret(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw sessionError('SESSION_SECRET_MISSING', `${PROVIDER_SESSION_ENV} is required`);
    }

    const secret = value.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(secret)) {
        throw sessionError(
            'SESSION_SECRET_INVALID',
            `${PROVIDER_SESSION_ENV} must be exactly 64 hexadecimal characters (32 bytes)`,
        );
    }

    return Buffer.from(secret, 'hex');
}

export function loadProviderSessionSecret(env = process.env) {
    return parseSessionSecret(env?.[PROVIDER_SESSION_ENV]);
}

function toBase64Url(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
        throw sessionError('SESSION_TOKEN_INVALID', `Invalid ${label}`);
    }
    return Buffer.from(value, 'base64url');
}

function normalizeNow(nowMs = Date.now()) {
    const value = Number(nowMs);
    if (!Number.isFinite(value) || value <= 0) {
        throw sessionError('SESSION_TIME_INVALID', 'Session time is invalid');
    }
    return Math.floor(value);
}

export function sealMuapiProviderSession(
    apiKey,
    {
        secret,
        nowMs = Date.now(),
        maxAgeSeconds = PROVIDER_SESSION_MAX_AGE_SECONDS,
        randomBytesImpl = crypto.randomBytes,
    } = {},
) {
    const key = parseSessionSecret(secret);
    const providerKey = normalizeApiKey(apiKey);
    const issuedAt = normalizeNow(nowMs);
    const ttlSeconds = Number(maxAgeSeconds);

    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > PROVIDER_SESSION_MAX_AGE_SECONDS) {
        throw sessionError('SESSION_TTL_INVALID', 'Session TTL is invalid');
    }

    const expiresAt = issuedAt + ttlSeconds * 1000;
    const payload = Buffer.from(JSON.stringify({
        v: 1,
        provider: PROVIDER_ID,
        apiKey: providerKey,
        iat: issuedAt,
        exp: expiresAt,
    }), 'utf8');

    const iv = randomBytesImpl(IV_BYTES);
    if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) {
        throw sessionError('SESSION_RANDOM_INVALID', 'Session IV generation failed');
    }

    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
        PROVIDER_SESSION_VERSION,
        toBase64Url(iv),
        toBase64Url(tag),
        toBase64Url(ciphertext),
    ].join('.');
}

export function openMuapiProviderSession(
    token,
    {
        secret,
        nowMs = Date.now(),
    } = {},
) {
    const key = parseSessionSecret(secret);
    const currentTime = normalizeNow(nowMs);

    if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
        throw sessionError('SESSION_TOKEN_INVALID', 'Provider session token is invalid');
    }

    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== PROVIDER_SESSION_VERSION) {
        throw sessionError('SESSION_TOKEN_INVALID', 'Provider session token version is invalid');
    }

    const iv = fromBase64Url(parts[1], 'IV');
    const tag = fromBase64Url(parts[2], 'auth tag');
    const ciphertext = fromBase64Url(parts[3], 'ciphertext');

    if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
        throw sessionError('SESSION_TOKEN_INVALID', 'Provider session token structure is invalid');
    }

    let plaintext;
    try {
        const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
        decipher.setAAD(AAD);
        decipher.setAuthTag(tag);
        plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
        throw sessionError('SESSION_TOKEN_AUTH_FAILED', 'Provider session authentication failed');
    }

    let payload;
    try {
        payload = JSON.parse(plaintext.toString('utf8'));
    } catch {
        throw sessionError('SESSION_PAYLOAD_INVALID', 'Provider session payload is invalid');
    }

    if (
        payload?.v !== 1
        || payload?.provider !== PROVIDER_ID
        || typeof payload?.apiKey !== 'string'
        || !Number.isFinite(payload?.iat)
        || !Number.isFinite(payload?.exp)
    ) {
        throw sessionError('SESSION_PAYLOAD_INVALID', 'Provider session payload fields are invalid');
    }

    const apiKey = normalizeApiKey(payload.apiKey);
    if (payload.iat > currentTime + CLOCK_SKEW_MS) {
        throw sessionError('SESSION_NOT_YET_VALID', 'Provider session issue time is invalid');
    }
    if (payload.exp <= currentTime) {
        throw sessionError('SESSION_EXPIRED', 'Provider session expired');
    }
    if (payload.exp - payload.iat > PROVIDER_SESSION_MAX_AGE_SECONDS * 1000) {
        throw sessionError('SESSION_TTL_INVALID', 'Provider session lifetime exceeds policy');
    }

    return Object.freeze({
        provider: PROVIDER_ID,
        apiKey,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
    });
}

export function parseCookieHeader(cookieHeader, name = PROVIDER_SESSION_COOKIE) {
    if (typeof cookieHeader !== 'string' || !cookieHeader) return null;
    const prefix = `${name}=`;

    for (const part of cookieHeader.split(';')) {
        const candidate = part.trim();
        if (!candidate.startsWith(prefix)) continue;
        const value = candidate.slice(prefix.length);
        if (!value) return null;
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    return null;
}

export function readMuapiProviderSessionFromRequest(
    request,
    {
        env = process.env,
        nowMs = Date.now(),
    } = {},
) {
    if (!request?.headers || typeof request.headers.get !== 'function') {
        throw sessionError('SESSION_REQUEST_INVALID', 'Request headers are unavailable');
    }

    const secret = env?.[PROVIDER_SESSION_ENV];
    const token = parseCookieHeader(request.headers.get('cookie'));
    if (!token) return null;

    return openMuapiProviderSession(token, { secret, nowMs });
}

export function isTrustedProviderSessionMutation(request) {
    if (!request?.headers || typeof request.headers.get !== 'function' || typeof request?.url !== 'string') {
        return false;
    }

    const origin = request.headers.get('origin');
    if (!origin) return false;

    let requestOrigin;
    try {
        requestOrigin = new URL(request.url).origin;
    } catch {
        return false;
    }

    return origin === requestOrigin;
}

export function shouldUseSecureCookie(request) {
    try {
        const forwardedProto = request?.headers?.get?.('x-forwarded-proto');
        if (typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim().toLowerCase() === 'https') {
            return true;
        }
        return new URL(request.url).protocol === 'https:';
    } catch {
        return false;
    }
}

export function providerSessionCookieOptions(
    request,
    {
        maxAgeSeconds = PROVIDER_SESSION_MAX_AGE_SECONDS,
    } = {},
) {
    return Object.freeze({
        httpOnly: true,
        sameSite: 'strict',
        secure: shouldUseSecureCookie(request),
        path: '/',
        maxAge: maxAgeSeconds,
    });
}

export const __test = Object.freeze({
    MAX_API_KEY_LENGTH,
    MAX_TOKEN_LENGTH,
});
