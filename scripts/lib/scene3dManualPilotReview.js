'use strict';

const { createHash } = require('node:crypto');

const REVIEW_SCHEMA = 'orbi.scene3d-manual-pilot-review/v1';
const RESULT_SCHEMA = 'orbi.scene3d-manual-pilot-review-result/v1';

const DECISIONS = Object.freeze([
    'APPROVE_MANUAL_PILOT_REVIEW',
    'REJECT_MANUAL_PILOT_REVIEW',
]);

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
            if (value[key] === undefined) {
                throw new TypeError(`${path}.${key} must not be undefined`);
            }
            out[key] = normalizeJson(value[key], `${path}.${key}`);
        }
        return out;
    }
    throw new TypeError(`${path} must contain only JSON-compatible values`);
}

function digest(value) {
    return createHash('sha256')
        .update(JSON.stringify(normalizeJson(value)), 'utf8')
        .digest('hex');
}

function nonEmptyString(value, label, max = 256) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > max) {
        throw new TypeError(`${label} must be a non-empty string up to ${max} characters`);
    }
    return normalized;
}

function validateManualPilotReview(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new TypeError('manual pilot review must be an object');
    }
    if (record.schema !== REVIEW_SCHEMA) {
        throw new TypeError(`schema must be ${REVIEW_SCHEMA}`);
    }
    if (!DECISIONS.includes(record.decision)) {
        throw new TypeError('decision is not supported');
    }

    const reviewer = nonEmptyString(record.reviewer, 'reviewer', 128);
    const rationale = nonEmptyString(record.rationale, 'rationale', 4096);
    const readinessEvidenceSha256 = nonEmptyString(
        record.readinessEvidenceSha256,
        'readinessEvidenceSha256',
        64,
    );
    if (!/^[0-9a-f]{64}$/.test(readinessEvidenceSha256)) {
        throw new TypeError('readinessEvidenceSha256 must be lowercase SHA-256');
    }

    const reviewedCommit = nonEmptyString(record.reviewedCommit, 'reviewedCommit', 40);
    if (!/^[0-9a-f]{40}$/.test(reviewedCommit)) {
        throw new TypeError('reviewedCommit must be a lowercase 40-character Git SHA');
    }

    const readinessState = nonEmptyString(record.readinessState, 'readinessState', 128);
    if (readinessState !== 'EVIDENCE_COMPLETE_FOR_MANUAL_PILOT_REVIEW') {
        throw new TypeError('readinessState is not complete for manual review');
    }

    const normalized = Object.freeze({
        schema: REVIEW_SCHEMA,
        decision: record.decision,
        reviewer,
        rationale,
        readinessEvidenceSha256,
        readinessState,
        reviewedCommit,
    });

    return Object.freeze({
        schema: RESULT_SCHEMA,
        valid: true,
        decision: normalized.decision,
        reviewSha256: digest(normalized),
        manualPilotReviewApproved:
            normalized.decision === 'APPROVE_MANUAL_PILOT_REVIEW',
        featureEnableAuthorized: false,
        productionCutoverAuthorized: false,
        computeRouterAuthorityChanged: false,
        mhsActuationEnabled: false,
        record: normalized,
    });
}

module.exports = {
    DECISIONS,
    REVIEW_SCHEMA,
    RESULT_SCHEMA,
    digest,
    normalizeJson,
    validateManualPilotReview,
};
