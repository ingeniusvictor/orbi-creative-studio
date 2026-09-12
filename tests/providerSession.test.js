const test = require('node:test');
const assert = require('node:assert/strict');

async function sessionModule() {
    return import('../src/server/providerSession.mjs');
}

const SECRET = '11'.repeat(32);
const OTHER_SECRET = '22'.repeat(32);
const NOW = 1789180000000;

function request(url = 'https://orbi.example/api/provider-session', headers = {}) {
    const map = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    return {
        url,
        headers: {
            get(name) {
                return map.get(String(name).toLowerCase()) || null;
            },
        },
    };
}

test('provider session encrypts key with authenticated AES-GCM token and never embeds plaintext', async () => {
    const { sealMuapiProviderSession, openMuapiProviderSession } = await sessionModule();

    const token = sealMuapiProviderSession('muapi-super-secret', {
        secret: SECRET,
        nowMs: NOW,
        randomBytesImpl: () => Buffer.alloc(12, 7),
    });

    assert.match(token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(token.includes('muapi-super-secret'), false);

    const opened = openMuapiProviderSession(token, {
        secret: SECRET,
        nowMs: NOW + 1000,
    });

    assert.equal(opened.provider, 'muapi');
    assert.equal(opened.apiKey, 'muapi-super-secret');
    assert.ok(opened.expiresAt > NOW);
});

test('provider session rejects tampering and wrong server secret', async () => {
    const { sealMuapiProviderSession, openMuapiProviderSession } = await sessionModule();
    const token = sealMuapiProviderSession('secret-key', {
        secret: SECRET,
        nowMs: NOW,
        randomBytesImpl: () => Buffer.alloc(12, 3),
    });

    const parts = token.split('.');
    const ciphertext = parts[3];
    parts[3] = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
    const tampered = parts.join('.');

    assert.throws(
        () => openMuapiProviderSession(tampered, { secret: SECRET, nowMs: NOW + 1 }),
        (error) => error.code === 'SESSION_TOKEN_AUTH_FAILED',
    );

    assert.throws(
        () => openMuapiProviderSession(token, { secret: OTHER_SECRET, nowMs: NOW + 1 }),
        (error) => error.code === 'SESSION_TOKEN_AUTH_FAILED',
    );
});

test('provider session rejects expired, future, oversized and weak-secret states', async () => {
    const {
        PROVIDER_SESSION_MAX_AGE_SECONDS,
        sealMuapiProviderSession,
        openMuapiProviderSession,
        loadProviderSessionSecret,
    } = await sessionModule();

    const token = sealMuapiProviderSession('secret-key', {
        secret: SECRET,
        nowMs: NOW,
        maxAgeSeconds: 60,
        randomBytesImpl: () => Buffer.alloc(12, 4),
    });

    assert.throws(
        () => openMuapiProviderSession(token, { secret: SECRET, nowMs: NOW + 61_000 }),
        (error) => error.code === 'SESSION_EXPIRED',
    );

    assert.throws(
        () => sealMuapiProviderSession('secret-key', {
            secret: SECRET,
            nowMs: NOW,
            maxAgeSeconds: PROVIDER_SESSION_MAX_AGE_SECONDS + 1,
        }),
        (error) => error.code === 'SESSION_TTL_INVALID',
    );

    assert.throws(
        () => loadProviderSessionSecret({}),
        (error) => error.code === 'SESSION_SECRET_MISSING',
    );
    assert.throws(
        () => loadProviderSessionSecret({ ORBI_PROVIDER_SESSION_SECRET: 'short' }),
        (error) => error.code === 'SESSION_SECRET_INVALID',
    );
});

test('cookie parser reads only the named session token', async () => {
    const { parseCookieHeader, PROVIDER_SESSION_COOKIE } = await sessionModule();
    assert.equal(
        parseCookieHeader(`foo=1; ${PROVIDER_SESSION_COOKIE}=v1.abc.def.ghi; other=2`),
        'v1.abc.def.ghi',
    );
    assert.equal(parseCookieHeader('foo=1; other=2'), null);
});

test('provider session mutation requires exact same-origin browser origin', async () => {
    const { isTrustedProviderSessionMutation } = await sessionModule();

    assert.equal(
        isTrustedProviderSessionMutation(request(
            'https://orbi.example/api/provider-session',
            { origin: 'https://orbi.example' },
        )),
        true,
    );

    assert.equal(
        isTrustedProviderSessionMutation(request(
            'https://orbi.example/api/provider-session',
            { origin: 'https://evil.example' },
        )),
        false,
    );

    assert.equal(
        isTrustedProviderSessionMutation(request(
            'https://orbi.example/api/provider-session',
            {},
        )),
        false,
    );
});

test('session cookie options are HttpOnly Strict and Secure only on HTTPS', async () => {
    const { providerSessionCookieOptions } = await sessionModule();

    const https = providerSessionCookieOptions(request(
        'https://orbi.example/api/provider-session',
        {},
    ));
    assert.equal(https.httpOnly, true);
    assert.equal(https.sameSite, 'strict');
    assert.equal(https.secure, true);
    assert.equal(https.path, '/');

    const localHttp = providerSessionCookieOptions(request(
        'http://localhost:3000/api/provider-session',
        {},
    ));
    assert.equal(localHttp.secure, false);
});
