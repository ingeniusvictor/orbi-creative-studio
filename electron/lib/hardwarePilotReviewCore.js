'use strict';

const REVIEW_STATUS = Object.freeze({
    READY: 'HARDWARE_PILOT_REVIEW_READY',
    REJECTED: 'HARDWARE_PILOT_REVIEW_REJECTED',
});

const DECISION_STATUS = Object.freeze({
    APPROVED: 'HARDWARE_PILOT_REVIEW_APPROVED',
    REJECTED: 'HARDWARE_PILOT_REVIEW_DECISION_REJECTED',
});

function authorityFields({ humanReviewCompleted = false } = {}) {
    return Object.freeze({
        reviewOnly: true,
        humanReviewCompleted,
        reviewerIdentityVerified: false,
        cryptographicAuthenticityVerified: false,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validSha256(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validIso(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function normalizeTarget(target) {
    if (!target
        || typeof target !== 'object'
        || Array.isArray(target)
        || typeof target.modelId !== 'string'
        || !target.modelId.trim()
        || !['cpu', 'cuda12'].includes(target.backend)
        || !Number.isInteger(target.width)
        || target.width <= 0
        || !Number.isInteger(target.height)
        || target.height <= 0) {
        return null;
    }

    return Object.freeze({
        modelId: target.modelId.trim(),
        backend: target.backend,
        width: target.width,
        height: target.height,
    });
}

function finitePositive(value) {
    return Number.isFinite(value) && value > 0;
}

function rejectedReview(reason) {
    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c67-hardware-pilot-review-projection',
        status: REVIEW_STATUS.REJECTED,
        reason,
        sha256: null,
        target: null,
        sampleCount: 0,
        runs: Object.freeze([]),
        timing: null,
        observedResources: null,
        requiresHumanReview: true,
        ...authorityFields(),
    });
}

function reviewRun(runEvidence, performanceEvidence, target, expectedIndex) {
    const sample = runEvidence?.sample;
    if (!sample
        || sample.runIndex !== expectedIndex
        || performanceEvidence?.runIndex !== expectedIndex
        || sample.modelId !== target.modelId
        || performanceEvidence.modelId !== target.modelId
        || sample.backend !== target.backend
        || performanceEvidence.backend !== target.backend
        || sample.resolution?.width !== target.width
        || sample.resolution?.height !== target.height
        || performanceEvidence.resolution?.width !== target.width
        || performanceEvidence.resolution?.height !== target.height
        || !validIso(sample.measuredAt)
        || performanceEvidence.measuredAt !== sample.measuredAt
        || !finitePositive(performanceEvidence.durationMs)
        || !finitePositive(sample.peakSystemRamMiB)) {
        return null;
    }

    let peakVramMiB = null;
    if (target.backend === 'cuda12') {
        if (!finitePositive(sample.peakVramMiB)) return null;
        peakVramMiB = sample.peakVramMiB;
    }

    return Object.freeze({
        runIndex: expectedIndex,
        measuredAt: sample.measuredAt,
        durationMs: performanceEvidence.durationMs,
        peakSystemRamMiB: sample.peakSystemRamMiB,
        peakVramMiB,
    });
}

function safeRuntimeContext(bundle) {
    const context = bundle?.benchmarkContext;
    if (!context
        || typeof context.runtimeIdentity !== 'string'
        || !context.runtimeIdentity.trim()
        || typeof context.runtimeVersion !== 'string'
        || !context.runtimeVersion.trim()
        || typeof context.harnessVersion !== 'string'
        || !context.harnessVersion.trim()) {
        return null;
    }

    return Object.freeze({
        runtimeIdentity: context.runtimeIdentity.trim(),
        runtimeVersion: context.runtimeVersion.trim(),
        harnessVersion: context.harnessVersion.trim(),
    });
}

function roundAverage(values) {
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function validateBundleEnvelope(bundle, target) {
    return Boolean(
        bundle
        && bundle.schemaVersion === 1
        && bundle.evidenceType === 'p1c62-hardware-pilot-evidence-bundle'
        && bundle.evidenceClass === 'real-runtime-hardware-pilot'
        && bundle.sampleCount === 3
        && Array.isArray(bundle.runIndexes)
        && bundle.runIndexes.length === 3
        && bundle.runIndexes[0] === 1
        && bundle.runIndexes[1] === 2
        && bundle.runIndexes[2] === 3
        && Array.isArray(bundle.runEvidence)
        && bundle.runEvidence.length === 3
        && Array.isArray(bundle.performanceEvidence)
        && bundle.performanceEvidence.length === 3
        && bundle.target?.modelId === target.modelId
        && bundle.target?.backend === target.backend
        && bundle.target?.width === target.width
        && bundle.target?.height === target.height
        && validIso(bundle.capturedFrom)
        && validIso(bundle.capturedTo)
        && bundle.localPathsIncluded === false
        && bundle.hardwareIdentityIncluded === false
        && bundle.promptContentIncluded === false
        && bundle.cryptographicAuthenticityVerified === false
        && bundle.requiresHumanReview === true
        && bundle.productionProfilePromoted === false
        && bundle.routingEligible === false
        && bundle.cutoverAuthorized === false
        && bundle.executionAuthority === 'legacy-dispatcher-only'
    );
}

function validateProjection(projection) {
    return Boolean(
        projection
        && projection.status === REVIEW_STATUS.READY
        && validSha256(projection.sha256)
        && normalizeTarget(projection.target)
        && projection.sampleCount === 3
        && Array.isArray(projection.runs)
        && projection.runs.length === 3
        && projection.reviewOnly === true
        && projection.requiresHumanReview === true
        && projection.humanReviewCompleted === false
        && projection.reviewerIdentityVerified === false
        && projection.cryptographicAuthenticityVerified === false
        && projection.productionProfilePromoted === false
        && projection.routingEligible === false
        && projection.cutoverAuthorized === false
        && projection.executionAuthority === 'legacy-dispatcher-only'
    );
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function buildHardwarePilotReviewProjection({ sha256, bundle } = {}) {
    if (!validSha256(sha256)) return rejectedReview('HARDWARE_PILOT_REVIEW_SHA_INVALID');

    const target = normalizeTarget(bundle?.target);
    if (!target || !validateBundleEnvelope(bundle, target)) {
        return rejectedReview('HARDWARE_PILOT_REVIEW_BUNDLE_INVALID');
    }

    const runtime = safeRuntimeContext(bundle);
    if (!runtime) return rejectedReview('HARDWARE_PILOT_REVIEW_RUNTIME_CONTEXT_INVALID');

    const runs = [];
    for (let index = 0; index < 3; index += 1) {
        const run = reviewRun(bundle.runEvidence[index], bundle.performanceEvidence[index], target, index + 1);
        if (!run) return rejectedReview('HARDWARE_PILOT_REVIEW_RUN_INVALID');
        runs.push(run);
    }

    const durations = runs.map((run) => run.durationMs);
    const systemRam = runs.map((run) => run.peakSystemRamMiB);
    const vram = runs.map((run) => run.peakVramMiB).filter((value) => value !== null);

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c67-hardware-pilot-review-projection',
        status: REVIEW_STATUS.READY,
        reason: null,
        sha256,
        target,
        sampleCount: 3,
        capturedFrom: bundle.capturedFrom,
        capturedTo: bundle.capturedTo,
        runtime,
        runs: Object.freeze(runs),
        timing: Object.freeze({
            minDurationMs: Math.min(...durations),
            maxDurationMs: Math.max(...durations),
            averageDurationMs: roundAverage(durations),
        }),
        observedResources: Object.freeze({
            peakSystemRamMiB: Math.max(...systemRam),
            peakVramMiB: vram.length ? Math.max(...vram) : null,
        }),
        requiresHumanReview: true,
        ...authorityFields(),
    });
}

function buildPilotCertifiedProfile(projection, certifiedAt) {
    return Object.freeze({
        schemaVersion: 1,
        profileType: 'p1c69-human-reviewed-hardware-pilot-profile',
        status: 'pilot-certified',
        certificationScope: 'hardware-pilot-evidence-review-only',
        evidenceSha256: projection.sha256,
        target: Object.freeze({ ...projection.target }),
        sampleCount: 3,
        timing: Object.freeze({ ...projection.timing }),
        observedResources: Object.freeze({ ...projection.observedResources }),
        certifiedAt,
        reviewerIdentityVerified: false,
        cryptographicAuthenticityVerified: false,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function recordHardwarePilotReviewDecision({
    projection,
    decision,
    reviewNote,
    decidedAt,
} = {}) {
    if (!validateProjection(projection)) {
        throw new TypeError('hardware pilot review projection is invalid');
    }
    if (!['approve', 'reject'].includes(decision)) {
        throw new TypeError('hardware pilot review decision is invalid');
    }
    if (typeof reviewNote !== 'string' || !reviewNote.trim() || reviewNote.trim().length > 2000) {
        throw new TypeError('hardware pilot review note is invalid');
    }
    if (!validIso(decidedAt)) {
        throw new TypeError('hardware pilot review timestamp is invalid');
    }

    const approved = decision === 'approve';
    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c68-hardware-pilot-human-review-decision',
        status: approved ? DECISION_STATUS.APPROVED : DECISION_STATUS.REJECTED,
        reason: null,
        sha256: projection.sha256,
        decision,
        reviewNote: reviewNote.trim(),
        decidedAt,
        target: Object.freeze({ ...projection.target }),
        sampleCount: 3,
        humanReviewCompleted: true,
        requiresHumanReview: false,
        reviewerIdentityVerified: false,
        cryptographicAuthenticityVerified: false,
        profile: approved ? buildPilotCertifiedProfile(projection, decidedAt) : null,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sanitizeDecisionResult(record) {
    if (!record || !validSha256(record.sha256)) return null;
    return Object.freeze({
        schemaVersion: record.schemaVersion,
        evidenceType: record.evidenceType,
        status: record.status,
        sha256: record.sha256,
        decision: record.decision,
        reviewNoteRecorded: true,
        decidedAt: record.decidedAt,
        target: Object.freeze({ ...record.target }),
        sampleCount: 3,
        humanReviewCompleted: true,
        requiresHumanReview: false,
        reviewerIdentityVerified: false,
        cryptographicAuthenticityVerified: false,
        profile: record.profile ? Object.freeze(clone(record.profile)) : null,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    REVIEW_STATUS,
    DECISION_STATUS,
    buildHardwarePilotReviewProjection,
    recordHardwarePilotReviewDecision,
    sanitizeDecisionResult,
};
