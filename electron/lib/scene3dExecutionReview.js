'use strict';

const { createHash, randomUUID } = require('node:crypto');

const DEFAULT_REVIEW_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_REVIEWS = 128;

function createReviewError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeJson(value, path = '$') {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`${path} must contain only finite JSON numbers`);
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeJson(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
            throw new TypeError(`${path} must contain only plain JSON objects`);
        }
        const out = Object.create(null);
        for (const key of Object.keys(value).sort()) {
            const item = value[key];
            if (item === undefined) {
                throw new TypeError(`${path}.${key} must not be undefined`);
            }
            out[key] = normalizeJson(item, `${path}.${key}`);
        }
        return out;
    }
    throw new TypeError(`${path} must contain only JSON-compatible values`);
}

function executionFingerprint(recipeId, parameters) {
    const normalized = normalizeJson({
        recipeId,
        parameters,
    });
    const canonical = JSON.stringify(normalized);
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function createScene3DExecutionReviewRegistry({
    randomUUIDImpl = randomUUID,
    nowImpl = Date.now,
    ttlMs = DEFAULT_REVIEW_TTL_MS,
    maxReviews = DEFAULT_MAX_REVIEWS,
} = {}) {
    if (!Number.isInteger(ttlMs) || ttlMs < 1000 || ttlMs > 60 * 60 * 1000) {
        throw new TypeError('Scene3D review TTL must be between 1000 and 3600000 ms');
    }
    if (!Number.isInteger(maxReviews) || maxReviews < 1 || maxReviews > 1024) {
        throw new TypeError('Scene3D review capacity must be between 1 and 1024');
    }

    const reviews = new Map();

    function pruneExpired() {
        const now = nowImpl();
        for (const [token, review] of reviews) {
            if (review.expiresAt <= now) reviews.delete(token);
        }
    }

    function issue({ recipeId, parameters, dryRunResponse }) {
        if (!dryRunResponse
            || dryRunResponse.ok !== true
            || dryRunResponse.data?.execution !== 'dry-run'
            || dryRunResponse.data?.providerCalled !== false) {
            throw createReviewError(
                'SCENE3D_REVIEW_DRY_RUN_REQUIRED',
                'A successful provider-free dry-run is required before review issuance',
            );
        }

        const fingerprint = executionFingerprint(recipeId, parameters);
        const recipeEvidence = dryRunResponse.data.recipe || {};
        const codeSha256 = typeof recipeEvidence.code_sha256 === 'string'
            ? recipeEvidence.code_sha256
            : null;

        pruneExpired();
        if (reviews.size >= maxReviews) {
            throw createReviewError(
                'SCENE3D_REVIEW_CAPACITY',
                'Scene3D execution review capacity is exhausted',
            );
        }

        const token = randomUUIDImpl();
        if (typeof token !== 'string' || !token || reviews.has(token)) {
            throw createReviewError(
                'SCENE3D_REVIEW_TOKEN_INVALID',
                'Scene3D review token generator returned an invalid or duplicate token',
            );
        }

        const issuedAt = nowImpl();
        const record = Object.freeze({
            token,
            recipeId,
            fingerprint,
            codeSha256,
            issuedAt,
            expiresAt: issuedAt + ttlMs,
        });
        reviews.set(token, record);

        return Object.freeze({
            token,
            recipeId,
            fingerprint,
            codeSha256,
            expiresAt: record.expiresAt,
            oneShot: true,
        });
    }

    function consume({ token, recipeId, parameters }) {
        const reviewToken = typeof token === 'string' ? token.trim() : '';
        if (!reviewToken) {
            throw createReviewError(
                'SCENE3D_REVIEW_REQUIRED',
                'A Scene3D dry-run review token is required',
            );
        }

        const record = reviews.get(reviewToken);
        if (!record) {
            throw createReviewError(
                'SCENE3D_REVIEW_REQUIRED',
                'Scene3D review token is missing, expired, or already used',
            );
        }

        // Capability tokens are one-shot even when the attempted execution is malformed.
        reviews.delete(reviewToken);

        if (record.expiresAt <= nowImpl()) {
            throw createReviewError(
                'SCENE3D_REVIEW_EXPIRED',
                'Scene3D execution review has expired',
            );
        }

        const fingerprint = executionFingerprint(recipeId, parameters);
        if (record.recipeId !== recipeId || record.fingerprint !== fingerprint) {
            throw createReviewError(
                'SCENE3D_REVIEW_MISMATCH',
                'Scene3D execution payload does not match the reviewed dry-run',
            );
        }

        return Object.freeze({
            recipeId: record.recipeId,
            fingerprint: record.fingerprint,
            codeSha256: record.codeSha256,
            reviewedAt: record.issuedAt,
            expiresAt: record.expiresAt,
        });
    }

    function invalidateAll() {
        reviews.clear();
    }

    return Object.freeze({
        issue,
        consume,
        invalidateAll,
        size: () => reviews.size,
        ttlMs,
        oneShot: true,
    });
}

module.exports = {
    DEFAULT_MAX_REVIEWS,
    DEFAULT_REVIEW_TTL_MS,
    createScene3DExecutionReviewRegistry,
    executionFingerprint,
    normalizeJson,
};
