const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createProviderSecretStore } = require('../electron/lib/providerSecretStore');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-secret-store-'));
}

function fakeSafeStorage({ available = true, backend = 'gnome_libsecret' } = {}) {
    return {
        isEncryptionAvailable: () => available,
        getSelectedStorageBackend: () => backend,
        encryptString: (value) => Buffer.from(`cipher:${value}`, 'utf8'),
        decryptString: (buffer) => {
            const value = buffer.toString('utf8');
            if (!value.startsWith('cipher:')) throw new Error('bad cipher');
            return value.slice('cipher:'.length);
        },
    };
}

function cleanup(directory) {
    fs.rmSync(directory, { recursive: true, force: true });
}

test('secure desktop store encrypts at rest and round-trips a provider secret', () => {
    const directory = tempDir();
    try {
        const store = createProviderSecretStore({
            safeStorage: fakeSafeStorage(),
            userDataPath: directory,
            platform: 'linux',
        });

        assert.deepEqual(store.getReadiness('muapi', 'apiKey'), {
            available: true,
            secure: true,
            backend: 'gnome_libsecret',
            reason: null,
            hasSecret: false,
            storeState: 'ready',
        });

        assert.deepEqual(store.setSecret('muapi', 'apiKey', '  top-secret  '), {
            stored: true,
            backend: 'gnome_libsecret',
        });
        assert.equal(store.getSecret('muapi', 'apiKey'), 'top-secret');

        const raw = fs.readFileSync(store.filePath, 'utf8');
        assert.doesNotMatch(raw, /top-secret/);
        assert.match(raw, /ciphertext/);
        assert.equal(store.getReadiness('muapi', 'apiKey').hasSecret, true);
    } finally {
        cleanup(directory);
    }
});

test('deleteSecret removes the encrypted record without exposing plaintext', () => {
    const directory = tempDir();
    try {
        const store = createProviderSecretStore({
            safeStorage: fakeSafeStorage(),
            userDataPath: directory,
            platform: 'linux',
        });
        store.setSecret('muapi', 'apiKey', 'abc123');
        assert.equal(store.deleteSecret('muapi', 'apiKey'), true);
        assert.equal(store.deleteSecret('muapi', 'apiKey'), false);
        assert.equal(store.getSecret('muapi', 'apiKey'), null);
        assert.equal(store.getReadiness('muapi', 'apiKey').hasSecret, false);
    } finally {
        cleanup(directory);
    }
});

test('Linux basic_text backend is rejected instead of silently storing weakly protected data', () => {
    const directory = tempDir();
    try {
        const store = createProviderSecretStore({
            safeStorage: fakeSafeStorage({ backend: 'basic_text' }),
            userDataPath: directory,
            platform: 'linux',
        });
        const readiness = store.getReadiness('muapi', 'apiKey');
        assert.equal(readiness.available, false);
        assert.equal(readiness.secure, false);
        assert.equal(readiness.reason, 'insecure-linux-backend');
        assert.throws(
            () => store.setSecret('muapi', 'apiKey', 'secret'),
            (error) => error.code === 'SECURE_STORAGE_UNAVAILABLE',
        );
        assert.equal(fs.existsSync(store.filePath), false);
    } finally {
        cleanup(directory);
    }
});

test('unavailable OS encryption is surfaced without plaintext fallback', () => {
    const directory = tempDir();
    try {
        const store = createProviderSecretStore({
            safeStorage: fakeSafeStorage({ available: false }),
            userDataPath: directory,
            platform: 'win32',
        });
        const readiness = store.getReadiness('muapi', 'apiKey');
        assert.equal(readiness.available, false);
        assert.equal(readiness.reason, 'encryption-unavailable');
        assert.throws(
            () => store.setSecret('muapi', 'apiKey', 'secret'),
            (error) => error.code === 'SECURE_STORAGE_UNAVAILABLE',
        );
    } finally {
        cleanup(directory);
    }
});

test('corrupt secret store is reported and is never overwritten by setSecret', () => {
    const directory = tempDir();
    try {
        const store = createProviderSecretStore({
            safeStorage: fakeSafeStorage(),
            userDataPath: directory,
            platform: 'linux',
        });
        fs.mkdirSync(path.dirname(store.filePath), { recursive: true });
        fs.writeFileSync(store.filePath, '{not-json', 'utf8');

        const readiness = store.getReadiness('muapi', 'apiKey');
        assert.equal(readiness.storeState, 'corrupt');
        assert.equal(readiness.hasSecret, false);
        assert.throws(
            () => store.setSecret('muapi', 'apiKey', 'secret'),
            (error) => error.code === 'STORE_CORRUPT',
        );
        assert.equal(fs.readFileSync(store.filePath, 'utf8'), '{not-json');
    } finally {
        cleanup(directory);
    }
});

test('provider and secret identifiers are constrained', () => {
    const directory = tempDir();
    try {
        const store = createProviderSecretStore({
            safeStorage: fakeSafeStorage(),
            userDataPath: directory,
            platform: 'linux',
        });
        assert.throws(() => store.getReadiness('../escape', 'apiKey'), /Invalid provider id/);
        assert.throws(() => store.setSecret('muapi', 'bad key', 'secret'), /Invalid secret name/);
    } finally {
        cleanup(directory);
    }
});
