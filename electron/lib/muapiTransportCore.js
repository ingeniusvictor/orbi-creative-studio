'use strict';

const MUAPI_BASE_URL = 'https://api.muapi.ai';
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;

function transportError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeMuapiPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/api/v1/')) {
        throw transportError('INVALID_MUAPI_PATH', 'MuAPI transport requires an /api/v1/ path');
    }
    if (value.includes('\\') || value.includes('..') || value.length > 4096) {
        throw transportError('INVALID_MUAPI_PATH', 'MuAPI transport path is invalid');
    }

    const parsed = new URL(value, MUAPI_BASE_URL);
    if (parsed.origin !== MUAPI_BASE_URL || !parsed.pathname.startsWith('/api/v1/')) {
        throw transportError('INVALID_MUAPI_PATH', 'MuAPI transport path escaped the allowed origin');
    }

    return parsed.pathname + parsed.search;
}

function normalizeMethod(value) {
    const method = String(value || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
        throw transportError('INVALID_MUAPI_METHOD', 'Only GET and POST are allowed for MuAPI desktop transport');
    }
    return method;
}

function normalizeJsonBody(body) {
    if (body === undefined || body === null) return undefined;
    const serialized = JSON.stringify(body);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BODY_BYTES) {
        throw transportError('MUAPI_BODY_TOO_LARGE', 'MuAPI JSON request exceeds the desktop transport limit');
    }
    return serialized;
}

function toUploadBuffer(bytes) {
    if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
    if (ArrayBuffer.isView(bytes)) {
        return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    throw transportError('INVALID_UPLOAD', 'Upload bytes must be an ArrayBuffer or typed array');
}

function normalizeFilename(value) {
    if (typeof value !== 'string' || !value.trim()) return 'upload.bin';
    return value.replace(/[\\/\0]/g, '_').slice(0, 255) || 'upload.bin';
}

async function readResponse(response) {
    const text = await response.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); } catch { data = null; }
    }
    return {
        ok: Boolean(response.ok),
        status: Number(response.status) || 0,
        statusText: String(response.statusText || ''),
        data,
        text: text.slice(0, 65536),
    };
}

async function authenticatedRequest({ store, fetchImpl = fetch, request }) {
    if (!store || typeof store.getSecret !== 'function') {
        throw new TypeError('Provider secret store is required');
    }

    const path = normalizeMuapiPath(request?.path);
    const method = normalizeMethod(request?.method);
    const apiKey = store.getSecret('muapi', 'apiKey');
    if (!apiKey) throw transportError('MUAPI_CREDENTIAL_MISSING', 'MuAPI credential is not configured in secure desktop storage');

    const serialized = normalizeJsonBody(request?.body);
    const headers = { 'x-api-key': apiKey };
    if (serialized !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetchImpl(`${MUAPI_BASE_URL}${path}`, {
        method,
        headers,
        ...(serialized !== undefined ? { body: serialized } : {}),
    });

    return readResponse(response);
}

async function authenticatedUpload({ store, fetchImpl = fetch, payload }) {
    if (!store || typeof store.getSecret !== 'function') {
        throw new TypeError('Provider secret store is required');
    }

    const apiKey = store.getSecret('muapi', 'apiKey');
    if (!apiKey) throw transportError('MUAPI_CREDENTIAL_MISSING', 'MuAPI credential is not configured in secure desktop storage');

    const bytes = toUploadBuffer(payload?.bytes);
    if (bytes.byteLength === 0) throw transportError('INVALID_UPLOAD', 'Upload is empty');
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        throw transportError('UPLOAD_TOO_LARGE', 'Upload exceeds the desktop transport limit');
    }

    const filename = normalizeFilename(payload?.name);
    const mimeType = typeof payload?.type === 'string' && payload.type ? payload.type.slice(0, 255) : 'application/octet-stream';
    const formData = new FormData();
    formData.append('file', new Blob([bytes], { type: mimeType }), filename);

    const response = await fetchImpl(`${MUAPI_BASE_URL}/api/v1/upload_file`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData,
    });

    return readResponse(response);
}

module.exports = {
    MUAPI_BASE_URL,
    MAX_JSON_BODY_BYTES,
    MAX_UPLOAD_BYTES,
    normalizeMuapiPath,
    normalizeMethod,
    authenticatedRequest,
    authenticatedUpload,
};
