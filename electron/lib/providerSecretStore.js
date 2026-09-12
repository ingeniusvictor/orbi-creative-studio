'use strict';

const fs = require('fs');
const path = require('path');

const STORE_VERSION = 1;
const STORE_DIR = 'orbi-security';
const STORE_FILE = 'provider-secrets.json';
const IDENTIFIER_RE = /^[a-z0-9._-]+$/i;

function createStoreError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
}

function assertIdentifier(value, label) {
    if (typeof value !== 'string' || !IDENTIFIER_RE.test(value)) {
        throw createStoreError('INVALID_IDENTIFIER', `Invalid ${label}`);
    }
}

function normalizeSecret(value) {
    if (typeof value !== 'string' || !value.trim()) {
        throw createStoreError('INVALID_SECRET', 'Provider secret must be a non-empty string');
    }
    return value.trim();
}

function createProviderSecretStore({
    safeStorage,
    userDataPath,
    fsImpl = fs,
    pathImpl = path,
    platform = process.platform,
} = {}) {
    if (!safeStorage) throw new TypeError('safeStorage is required');
    if (typeof userDataPath !== 'string' || !userDataPath) {
        throw new TypeError('userDataPath is required');
    }

    const directoryPath = pathImpl.join(userDataPath, STORE_DIR);
    const filePath = pathImpl.join(directoryPath, STORE_FILE);

    function selectedBackend() {
        if (platform !== 'linux') return 'os-protected';
        if (typeof safeStorage.getSelectedStorageBackend !== 'function') return 'unknown';
        try {
            return safeStorage.getSelectedStorageBackend();
        } catch {
            return 'unknown';
        }
    }

    function encryptionState() {
        let encryptionAvailable = false;
        try {
            encryptionAvailable = Boolean(safeStorage.isEncryptionAvailable());
        } catch {
            encryptionAvailable = false;
        }

        const backend = selectedBackend();
        if (!encryptionAvailable) {
            return {
                available: false,
                secure: false,
                backend,
                reason: 'encryption-unavailable',
            };
        }

        if (platform === 'linux' && backend === 'basic_text') {
            return {
                available: false,
                secure: false,
                backend,
                reason: 'insecure-linux-backend',
            };
        }

        return {
            available: true,
            secure: true,
            backend,
            reason: null,
        };
    }

    function emptyDocument() {
        return { version: STORE_VERSION, providers: {} };
    }

    function readDocument() {
        if (!fsImpl.existsSync(filePath)) return emptyDocument();

        let parsed;
        try {
            parsed = JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
        } catch (error) {
            throw createStoreError('STORE_CORRUPT', 'Provider secret store is unreadable or corrupt', error);
        }

        if (!parsed || parsed.version !== STORE_VERSION || typeof parsed.providers !== 'object' || Array.isArray(parsed.providers)) {
            throw createStoreError('STORE_CORRUPT', 'Provider secret store has an unsupported structure');
        }

        return parsed;
    }

    function writeDocument(document) {
        fsImpl.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
        const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
        const payload = `${JSON.stringify(document, null, 2)}\n`;

        try {
            fsImpl.writeFileSync(tempPath, payload, { encoding: 'utf8', mode: 0o600, flag: 'w' });
            fsImpl.renameSync(tempPath, filePath);
            try {
                fsImpl.chmodSync(filePath, 0o600);
            } catch {
                // Windows and some filesystems do not support POSIX mode semantics.
            }
        } catch (error) {
            try {
                if (fsImpl.existsSync(tempPath)) fsImpl.unlinkSync(tempPath);
            } catch {
                // Preserve the original write failure.
            }
            throw createStoreError('STORE_WRITE_FAILED', 'Unable to persist provider secret store', error);
        }
    }

    function assertSecureBackend() {
        const state = encryptionState();
        if (!state.available || !state.secure) {
            throw createStoreError('SECURE_STORAGE_UNAVAILABLE', `Secure provider storage unavailable: ${state.reason}`);
        }
        return state;
    }

    function getRecord(document, providerId, secretName) {
        return document.providers?.[providerId]?.[secretName] || null;
    }

    function getReadiness(providerId, secretName) {
        assertIdentifier(providerId, 'provider id');
        assertIdentifier(secretName, 'secret name');
        const state = encryptionState();

        let hasSecret = false;
        let storeState = 'ready';
        try {
            hasSecret = Boolean(getRecord(readDocument(), providerId, secretName));
        } catch (error) {
            if (error.code === 'STORE_CORRUPT') {
                storeState = 'corrupt';
            } else {
                throw error;
            }
        }

        return { ...state, hasSecret, storeState };
    }

    function setSecret(providerId, secretName, value) {
        assertIdentifier(providerId, 'provider id');
        assertIdentifier(secretName, 'secret name');
        const secret = normalizeSecret(value);
        const state = assertSecureBackend();
        const document = readDocument();

        let encrypted;
        try {
            encrypted = safeStorage.encryptString(secret);
        } catch (error) {
            throw createStoreError('ENCRYPT_FAILED', 'Unable to encrypt provider secret', error);
        }

        if (!Buffer.isBuffer(encrypted)) {
            throw createStoreError('ENCRYPT_FAILED', 'safeStorage returned an invalid encrypted payload');
        }

        if (!document.providers[providerId]) document.providers[providerId] = {};
        document.providers[providerId][secretName] = {
            encoding: 'base64',
            ciphertext: encrypted.toString('base64'),
            updatedAt: new Date().toISOString(),
        };
        writeDocument(document);

        return { stored: true, backend: state.backend };
    }

    function getSecret(providerId, secretName) {
        assertIdentifier(providerId, 'provider id');
        assertIdentifier(secretName, 'secret name');
        assertSecureBackend();
        const record = getRecord(readDocument(), providerId, secretName);
        if (!record) return null;
        if (record.encoding !== 'base64' || typeof record.ciphertext !== 'string') {
            throw createStoreError('STORE_CORRUPT', 'Provider secret record has an unsupported structure');
        }

        try {
            return safeStorage.decryptString(Buffer.from(record.ciphertext, 'base64'));
        } catch (error) {
            throw createStoreError('DECRYPT_FAILED', 'Unable to decrypt provider secret', error);
        }
    }

    function deleteSecret(providerId, secretName) {
        assertIdentifier(providerId, 'provider id');
        assertIdentifier(secretName, 'secret name');
        assertSecureBackend();
        const document = readDocument();
        if (!document.providers[providerId] || !document.providers[providerId][secretName]) return false;

        delete document.providers[providerId][secretName];
        if (Object.keys(document.providers[providerId]).length === 0) {
            delete document.providers[providerId];
        }
        writeDocument(document);
        return true;
    }

    return {
        filePath,
        getReadiness,
        setSecret,
        getSecret,
        deleteSecret,
    };
}

module.exports = {
    STORE_VERSION,
    createProviderSecretStore,
};
