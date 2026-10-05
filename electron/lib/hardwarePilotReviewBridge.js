'use strict';

const { ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const { readImportedBundle } = require('./hardwarePilotFileImportBridge');
const {
    buildHardwarePilotReviewProjection,
    recordHardwarePilotReviewDecision,
    sanitizeDecisionResult,
} = require('./hardwarePilotReviewCore');

const REVIEW_CHANNEL = 'compute-router:hardware-pilot-review';
const DECISION_CHANNEL = 'compute-router:hardware-pilot-review-decision';
const reviewDecisions = new Map();

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function rejectedReview(reason) {
    return Object.freeze({
        status: 'HARDWARE_PILOT_REVIEW_REJECTED',
        reason,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejectedDecision(reason) {
    return Object.freeze({
        status: 'HARDWARE_PILOT_REVIEW_DECISION_REJECTED',
        reason,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function exactDecisionRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) return false;
    const keys = Object.keys(request).sort();
    return keys.length === 3
        && keys[0] === 'decision'
        && keys[1] === 'reviewNote'
        && keys[2] === 'sha256';
}

function register({ now = () => new Date() } = {}) {
    ipcMain.removeHandler(REVIEW_CHANNEL);
    ipcMain.removeHandler(DECISION_CHANNEL);

    ipcMain.handle(REVIEW_CHANNEL, (event, sha256) => {
        assertTrustedSender(event);
        const bundle = readImportedBundle(sha256);
        if (!bundle) return rejectedReview('HARDWARE_PILOT_REVIEW_IMPORT_NOT_FOUND');
        return buildHardwarePilotReviewProjection({ sha256, bundle });
    });

    ipcMain.handle(DECISION_CHANNEL, (event, request) => {
        assertTrustedSender(event);
        if (!exactDecisionRequest(request)) {
            return rejectedDecision('HARDWARE_PILOT_REVIEW_DECISION_REQUEST_INVALID');
        }

        const existing = reviewDecisions.get(request.sha256);
        if (existing) return sanitizeDecisionResult(existing);

        const bundle = readImportedBundle(request.sha256);
        if (!bundle) return rejectedDecision('HARDWARE_PILOT_REVIEW_IMPORT_NOT_FOUND');

        const projection = buildHardwarePilotReviewProjection({
            sha256: request.sha256,
            bundle,
        });
        if (projection.status !== 'HARDWARE_PILOT_REVIEW_READY') {
            return rejectedDecision('HARDWARE_PILOT_REVIEW_PROJECTION_INVALID');
        }

        let decidedAt;
        try {
            decidedAt = now().toISOString();
        } catch {
            return rejectedDecision('HARDWARE_PILOT_REVIEW_DECISION_TIMESTAMP_INVALID');
        }

        let record;
        try {
            record = recordHardwarePilotReviewDecision({
                projection,
                decision: request.decision,
                reviewNote: request.reviewNote,
                decidedAt,
            });
        } catch {
            return rejectedDecision('HARDWARE_PILOT_REVIEW_DECISION_INVALID');
        }

        reviewDecisions.set(request.sha256, clone(record));
        return sanitizeDecisionResult(record);
    });

    return Object.freeze({
        reviewChannel: REVIEW_CHANNEL,
        decisionChannel: DECISION_CHANNEL,
        rendererRawEvidenceAllowed: false,
        rendererReviewerIdentityAuthority: false,
        immutableDecisionPerImportedSha: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function readReviewDecision(sha256) {
    const record = reviewDecisions.get(sha256);
    return record ? clone(record) : null;
}

module.exports = {
    REVIEW_CHANNEL,
    DECISION_CHANNEL,
    reviewDecisions,
    readReviewDecision,
    register,
};
