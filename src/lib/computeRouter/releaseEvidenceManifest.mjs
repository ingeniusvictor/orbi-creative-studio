import { STUDIO_PARITY_PROFILE_ID } from './studioParityTargets.mjs';

const RELEASE_EVIDENCE_SCHEMA_VERSION = 1;
const RELEASE_EXECUTION_AUTHORITY = 'legacy-dispatcher-only';
const REQUIRED_PLATFORMS = Object.freeze(['linux', 'macos', 'windows']);
const RELEASE_GATE_KEYS = Object.freeze([
    'ciGreen',
    'platformMatrixGreen',
    'securityReviewApproved',
    'rollbackPlanApproved',
]);
const MAX_FUTURE_SKEW_MS = 60 * 1000;

function releaseEvidenceError(message) {
    const error = new Error(message);
    error.code = 'INVALID_RELEASE_EVIDENCE';
    return error;
}

function normalizeCommit(value, label = 'sourceCommit') {
    if (typeof value !== 'string' || !/^[0-9a-f]{40}$/i.test(value.trim())) {
        throw releaseEvidenceError(`${label} must be a 40-character Git commit SHA`);
    }
    return value.trim().toLowerCase();
}

function normalizeTimestamp(value, label, generatedAt) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
    if (timestamp > generatedAt + MAX_FUTURE_SKEW_MS) return undefined;
    return timestamp;
}

function normalizeProofId(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeStatus(value) {
    return ['passed', 'failed', 'unavailable'].includes(value)
        ? value
        : 'unavailable';
}

function normalizeCommitEvidence(record, {
    sourceCommit,
    generatedAt,
    proofField,
    timeField,
} = {}) {
    const evidence = record && typeof record === 'object' && !Array.isArray(record)
        ? record
        : {};

    let evidenceCommit;
    try {
        evidenceCommit = normalizeCommit(evidence.sourceCommit, 'evidence.sourceCommit');
    } catch {
        evidenceCommit = undefined;
    }

    const commitMatches = evidenceCommit === sourceCommit;
    const status = normalizeStatus(evidence.status);
    const proofId = normalizeProofId(evidence[proofField]);
    const timestamp = normalizeTimestamp(evidence[timeField], timeField, generatedAt);

    return Object.freeze({
        sourceCommit: evidenceCommit,
        commitMatches,
        status,
        proofId,
        timestamp,
        passed: (
            status === 'passed'
            && commitMatches
            && Boolean(proofId)
            && Number.isFinite(timestamp)
        ),
    });
}

function normalizeApprovalEvidence(record, {
    sourceCommit,
    generatedAt,
    proofField,
    timeField,
} = {}) {
    const evidence = record && typeof record === 'object' && !Array.isArray(record)
        ? record
        : {};

    let evidenceCommit;
    try {
        evidenceCommit = normalizeCommit(evidence.sourceCommit, 'evidence.sourceCommit');
    } catch {
        evidenceCommit = undefined;
    }

    const commitMatches = evidenceCommit === sourceCommit;
    const proofId = normalizeProofId(evidence[proofField]);
    const timestamp = normalizeTimestamp(evidence[timeField], timeField, generatedAt);
    const approved = evidence.approved === true;

    return Object.freeze({
        sourceCommit: evidenceCommit,
        commitMatches,
        approved,
        proofId,
        timestamp,
        passed: (
            approved
            && commitMatches
            && Boolean(proofId)
            && Number.isFinite(timestamp)
        ),
    });
}

function normalizePlatforms(platforms, sourceCommit, generatedAt) {
    const input = platforms && typeof platforms === 'object' && !Array.isArray(platforms)
        ? platforms
        : {};

    const normalized = {};
    for (const platform of REQUIRED_PLATFORMS) {
        normalized[platform] = normalizeCommitEvidence(input[platform], {
            sourceCommit,
            generatedAt,
            proofField: 'evidenceId',
            timeField: 'completedAt',
        });
    }
    return Object.freeze(normalized);
}

function evidenceIssues({
    ci,
    platforms,
    securityReview,
    rollbackPlan,
} = {}) {
    const issues = [];

    if (!ci.commitMatches) issues.push('ci:commit-mismatch');
    if (ci.status !== 'passed') issues.push(`ci:status-${ci.status}`);
    if (!ci.proofId) issues.push('ci:proof-missing');
    if (!ci.timestamp) issues.push('ci:timestamp-invalid');

    for (const platform of REQUIRED_PLATFORMS) {
        const item = platforms[platform];
        if (!item.commitMatches) issues.push(`platform:${platform}:commit-mismatch`);
        if (item.status !== 'passed') issues.push(`platform:${platform}:status-${item.status}`);
        if (!item.proofId) issues.push(`platform:${platform}:proof-missing`);
        if (!item.timestamp) issues.push(`platform:${platform}:timestamp-invalid`);
    }

    if (!securityReview.commitMatches) issues.push('security:commit-mismatch');
    if (!securityReview.approved) issues.push('security:not-approved');
    if (!securityReview.proofId) issues.push('security:proof-missing');
    if (!securityReview.timestamp) issues.push('security:timestamp-invalid');

    if (!rollbackPlan.commitMatches) issues.push('rollback:commit-mismatch');
    if (!rollbackPlan.approved) issues.push('rollback:not-approved');
    if (!rollbackPlan.proofId) issues.push('rollback:proof-missing');
    if (!rollbackPlan.timestamp) issues.push('rollback:timestamp-invalid');

    return Object.freeze(issues);
}

function buildReleaseEvidenceManifest({
    sourceCommit,
    profileId = STUDIO_PARITY_PROFILE_ID,
    generatedAt = Date.now(),
    ci,
    platforms,
    securityReview,
    rollbackPlan,
} = {}) {
    const commit = normalizeCommit(sourceCommit);
    const timestamp = Number(generatedAt);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw releaseEvidenceError('generatedAt must be a positive finite timestamp');
    }

    if (profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw releaseEvidenceError(`unsupported release profile: ${profileId}`);
    }

    const normalizedCi = normalizeCommitEvidence(ci, {
        sourceCommit: commit,
        generatedAt: timestamp,
        proofField: 'runId',
        timeField: 'completedAt',
    });

    const normalizedPlatforms = normalizePlatforms(platforms, commit, timestamp);

    const normalizedSecurity = normalizeApprovalEvidence(securityReview, {
        sourceCommit: commit,
        generatedAt: timestamp,
        proofField: 'reviewId',
        timeField: 'reviewedAt',
    });

    const normalizedRollback = normalizeApprovalEvidence(rollbackPlan, {
        sourceCommit: commit,
        generatedAt: timestamp,
        proofField: 'planId',
        timeField: 'reviewedAt',
    });

    const releaseGates = Object.freeze({
        ciGreen: normalizedCi.passed,
        platformMatrixGreen: REQUIRED_PLATFORMS.every(
            (platform) => normalizedPlatforms[platform].passed,
        ),
        securityReviewApproved: normalizedSecurity.passed,
        rollbackPlanApproved: normalizedRollback.passed,
    });

    const issues = evidenceIssues({
        ci: normalizedCi,
        platforms: normalizedPlatforms,
        securityReview: normalizedSecurity,
        rollbackPlan: normalizedRollback,
    });

    const ready = RELEASE_GATE_KEYS.every((gate) => releaseGates[gate] === true)
        && issues.length === 0;

    return Object.freeze({
        schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
        profileId: STUDIO_PARITY_PROFILE_ID,
        sourceCommit: commit,
        generatedAt: timestamp,
        ready,
        status: ready ? 'RELEASE_EVIDENCE_COMPLETE' : 'RELEASE_EVIDENCE_INCOMPLETE',
        cutoverAuthorized: false,
        executionAuthority: RELEASE_EXECUTION_AUTHORITY,
        releaseGates,
        issues,
        evidence: Object.freeze({
            ci: normalizedCi,
            platforms: normalizedPlatforms,
            securityReview: normalizedSecurity,
            rollbackPlan: normalizedRollback,
        }),
    });
}

function extractReleaseGates(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw releaseEvidenceError('release evidence manifest is required');
    }

    if (manifest.schemaVersion !== RELEASE_EVIDENCE_SCHEMA_VERSION) {
        throw releaseEvidenceError('unsupported release evidence schema version');
    }

    if (manifest.profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw releaseEvidenceError('release evidence profile mismatch');
    }

    normalizeCommit(manifest.sourceCommit);

    if (manifest.cutoverAuthorized !== false) {
        throw releaseEvidenceError('release evidence cannot authorize cutover');
    }

    if (manifest.executionAuthority !== RELEASE_EXECUTION_AUTHORITY) {
        throw releaseEvidenceError('release evidence must preserve legacy execution authority');
    }

    const input = manifest.releaseGates && typeof manifest.releaseGates === 'object'
        ? manifest.releaseGates
        : {};

    return Object.freeze({
        ciGreen: input.ciGreen === true,
        platformMatrixGreen: input.platformMatrixGreen === true,
        securityReviewApproved: input.securityReviewApproved === true,
        rollbackPlanApproved: input.rollbackPlanApproved === true,
    });
}

export {
    MAX_FUTURE_SKEW_MS,
    RELEASE_EVIDENCE_SCHEMA_VERSION,
    RELEASE_EXECUTION_AUTHORITY,
    RELEASE_GATE_KEYS,
    REQUIRED_PLATFORMS,
    buildReleaseEvidenceManifest,
    extractReleaseGates,
};
