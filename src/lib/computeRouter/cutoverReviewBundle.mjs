import { assessStudioCutoverEligibility } from './cutoverEligibility.mjs';
import { buildCutoverReviewReport } from './cutoverReviewReport.mjs';
import { extractBoundCertification } from './parityBuildBinding.mjs';
import { extractReleaseGates } from './releaseEvidenceManifest.mjs';
import { STUDIO_PARITY_PROFILE_ID } from './studioParityTargets.mjs';

const CUTOVER_REVIEW_BUNDLE_SCHEMA_VERSION = 1;
const CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY = 'legacy-dispatcher-only';

function bundleError(message) {
    const error = new Error(message);
    error.code = 'INVALID_CUTOVER_REVIEW_BUNDLE';
    return error;
}

function normalizeCommit(value, label = 'sourceCommit') {
    if (typeof value !== 'string' || !/^[0-9a-f]{40}$/i.test(value.trim())) {
        throw bundleError(`${label} must be a 40-character Git commit SHA`);
    }
    return value.trim().toLowerCase();
}

function normalizeTimestamp(value, label) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw bundleError(`${label} must be a positive finite timestamp`);
    }
    return timestamp;
}

function requireObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw bundleError(`${label} is required`);
    }
    return value;
}

function buildStudioCutoverReviewBundle({
    sourceCommit,
    parityBinding,
    releaseManifest,
    providers = [],
    generatedAt = Date.now(),
} = {}) {
    const commit = normalizeCommit(sourceCommit);
    const timestamp = normalizeTimestamp(generatedAt, 'generatedAt');
    const binding = requireObject(parityBinding, 'parityBinding');
    const release = requireObject(releaseManifest, 'releaseManifest');

    const releaseCommit = normalizeCommit(release.sourceCommit, 'releaseManifest.sourceCommit');
    if (releaseCommit !== commit) {
        throw bundleError('release evidence commit does not match review bundle commit');
    }

    if (release.profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw bundleError('release evidence profile does not match Studio parity profile');
    }

    const certification = extractBoundCertification(binding, commit);
    const releaseGates = extractReleaseGates(release);

    const eligibilityAssessment = assessStudioCutoverEligibility({
        certification,
        providers,
        releaseGates,
        profileId: STUDIO_PARITY_PROFILE_ID,
    });

    const reviewReport = buildCutoverReviewReport({
        assessment: eligibilityAssessment,
        generatedAt: timestamp,
    });

    const releaseEvidenceComplete = Object.values(releaseGates).every((value) => value === true);
    const readyForReview = (
        releaseEvidenceComplete
        && eligibilityAssessment.eligibleForCutoverReview === true
        && reviewReport.readyForReview === true
    );

    return Object.freeze({
        schemaVersion: CUTOVER_REVIEW_BUNDLE_SCHEMA_VERSION,
        sourceCommit: commit,
        profileId: STUDIO_PARITY_PROFILE_ID,
        generatedAt: timestamp,
        parityBindingId: String(binding.bindingId || ''),
        releaseEvidenceStatus: String(release.status || 'UNKNOWN'),
        releaseEvidenceComplete,
        releaseGates,
        readyForReview,
        reviewStatus: readyForReview ? 'READY_FOR_REVIEW' : 'BLOCKED',
        cutoverAuthorized: false,
        executionAuthority: CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY,
        eligibilityAssessment,
        reviewReport,
    });
}

function validateStudioCutoverReviewBundle(bundle, expectedSourceCommit) {
    const input = requireObject(bundle, 'bundle');

    if (input.schemaVersion !== CUTOVER_REVIEW_BUNDLE_SCHEMA_VERSION) {
        throw bundleError('unsupported cutover review bundle schema version');
    }

    const sourceCommit = normalizeCommit(input.sourceCommit);
    const expectedCommit = normalizeCommit(expectedSourceCommit, 'expectedSourceCommit');
    if (sourceCommit !== expectedCommit) {
        throw bundleError('cutover review bundle commit mismatch');
    }

    if (input.profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw bundleError('cutover review bundle profile mismatch');
    }

    normalizeTimestamp(input.generatedAt, 'generatedAt');

    if (input.cutoverAuthorized !== false) {
        throw bundleError('cutover review bundle cannot authorize cutover');
    }

    if (input.executionAuthority !== CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY) {
        throw bundleError('cutover review bundle must preserve legacy execution authority');
    }

    if (!input.eligibilityAssessment || input.eligibilityAssessment.cutoverAuthorized !== false) {
        throw bundleError('embedded eligibility assessment is authorizing or missing');
    }

    if (!input.reviewReport || input.reviewReport.cutoverAuthorized !== false) {
        throw bundleError('embedded review report is authorizing or missing');
    }

    if (
        input.eligibilityAssessment.executionAuthority !== CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY
        || input.reviewReport.executionAuthority !== CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY
    ) {
        throw bundleError('embedded review evidence changed execution authority');
    }

    const releaseGates = input.releaseGates && typeof input.releaseGates === 'object'
        ? input.releaseGates
        : {};
    const releaseEvidenceComplete = [
        'ciGreen',
        'platformMatrixGreen',
        'securityReviewApproved',
        'rollbackPlanApproved',
    ].every((gate) => releaseGates[gate] === true);

    const recomputedReady = (
        releaseEvidenceComplete
        && input.eligibilityAssessment.eligibleForCutoverReview === true
        && input.reviewReport.readyForReview === true
    );

    if (input.releaseEvidenceComplete !== releaseEvidenceComplete) {
        throw bundleError('release evidence completeness flag is inconsistent');
    }

    if (input.readyForReview !== recomputedReady) {
        throw bundleError('cutover review readiness flag is inconsistent');
    }

    if (input.reviewStatus !== (recomputedReady ? 'READY_FOR_REVIEW' : 'BLOCKED')) {
        throw bundleError('cutover review status is inconsistent');
    }

    return Object.freeze({
        valid: true,
        sourceCommit,
        readyForReview: recomputedReady,
        cutoverAuthorized: false,
        executionAuthority: CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY,
    });
}

export {
    CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY,
    CUTOVER_REVIEW_BUNDLE_SCHEMA_VERSION,
    buildStudioCutoverReviewBundle,
    validateStudioCutoverReviewBundle,
};
