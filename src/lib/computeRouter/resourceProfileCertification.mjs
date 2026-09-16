import {
    RESOURCE_PROFILE_STATUS,
    validateCertifiedResourceProfile,
} from './modelResourceProfiles.mjs';

export const CERTIFICATION_STATUS = Object.freeze({
    CERTIFIED: 'RESOURCE_PROFILE_CERTIFICATION_RECORDED',
    REJECTED: 'RESOURCE_PROFILE_CERTIFICATION_REJECTED',
});

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function reject(reason) {
    return Object.freeze({
        status: CERTIFICATION_STATUS.REJECTED,
        reason,
        certificationRecord: null,
        certifiedProfile: null,
        reviewerIdentityVerified: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateReviewableSession(sessionResult) {
    if (!isPlainObject(sessionResult)) return Object.freeze({ ok: false, reason: 'SESSION_RESULT_NOT_OBJECT' });
    if (sessionResult.status !== 'BENCHMARK_SESSION_READY_FOR_REVIEW' || sessionResult.reason !== null) {
        return Object.freeze({ ok: false, reason: 'SESSION_NOT_READY_FOR_REVIEW' });
    }
    if (sessionResult.productionProfilePromoted !== false
        || sessionResult.routingEligible !== false
        || sessionResult.cutoverAuthorized !== false
        || sessionResult.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'SESSION_AUTHORITY_INVALID' });
    }

    const bundle = sessionResult.evidenceBundle;
    if (!isPlainObject(bundle)
        || bundle.schemaVersion !== 1
        || bundle.evidenceType !== 'p1c7-benchmark-session-evidence'
        || bundle.status !== 'review-only'
        || bundle.requiresHumanCertification !== true
        || bundle.productionProfilePromoted !== false
        || bundle.routingEligible !== false
        || bundle.cutoverAuthorized !== false
        || bundle.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'SESSION_BUNDLE_INVALID' });
    }
    if (!Number.isInteger(bundle.runCount) || bundle.runCount < 3) {
        return Object.freeze({ ok: false, reason: 'SESSION_RUN_COUNT_INVALID' });
    }
    if (!Array.isArray(bundle.runIndexes)
        || bundle.runIndexes.length !== bundle.runCount
        || new Set(bundle.runIndexes).size !== bundle.runIndexes.length
        || bundle.runIndexes.some((value) => !Number.isInteger(value) || value <= 0)) {
        return Object.freeze({ ok: false, reason: 'SESSION_RUN_INDEXES_INVALID' });
    }
    if (!Array.isArray(bundle.auxiliaryArtifacts)) {
        return Object.freeze({ ok: false, reason: 'SESSION_AUXILIARY_EVIDENCE_INVALID' });
    }
    if (!validIsoTimestamp(bundle.reviewedAt)) {
        return Object.freeze({ ok: false, reason: 'SESSION_REVIEW_TIMESTAMP_INVALID' });
    }

    const candidate = bundle.candidate;
    if (!isPlainObject(candidate)
        || candidate.schemaVersion !== 1
        || candidate.status !== 'benchmark-candidate'
        || candidate.requiresHumanCertification !== true
        || candidate.productionProfilePromoted !== false) {
        return Object.freeze({ ok: false, reason: 'SESSION_CANDIDATE_INVALID' });
    }
    if (candidate.modelId !== bundle.modelId
        || candidate.backend !== bundle.backend
        || candidate.resolution?.width !== bundle.resolution?.width
        || candidate.resolution?.height !== bundle.resolution?.height) {
        return Object.freeze({ ok: false, reason: 'SESSION_CANDIDATE_CONTEXT_MISMATCH' });
    }
    if (!isPlainObject(candidate.benchmarkContext)
        || typeof candidate.benchmarkContext.harnessVersion !== 'string'
        || !candidate.benchmarkContext.harnessVersion.trim()
        || typeof candidate.benchmarkContext.sourceCommit !== 'string'
        || !/^[a-f0-9]{40}$/.test(candidate.benchmarkContext.sourceCommit)) {
        return Object.freeze({ ok: false, reason: 'SESSION_CANDIDATE_BENCHMARK_CONTEXT_INVALID' });
    }
    if (!isPlainObject(candidate.observations)
        || candidate.observations.sampleCount !== bundle.runCount) {
        return Object.freeze({ ok: false, reason: 'SESSION_CANDIDATE_SAMPLE_COUNT_INVALID' });
    }
    if (!isPlainObject(candidate.recommendation)
        || !Number.isFinite(candidate.recommendation.safetyMarginPct)
        || candidate.recommendation.safetyMarginPct < 0
        || candidate.recommendation.safetyMarginPct > 100
        || !isPlainObject(candidate.recommendation.requirements)) {
        return Object.freeze({ ok: false, reason: 'SESSION_CANDIDATE_RECOMMENDATION_INVALID' });
    }

    return Object.freeze({ ok: true, reason: null, bundle, candidate });
}

export function certifyResourceProfile({
    sessionResult,
    decision,
    reviewer,
    certifiedAt,
    reviewNote,
} = {}) {
    const sessionValidation = validateReviewableSession(sessionResult);
    if (!sessionValidation.ok) return reject(sessionValidation.reason);
    if (decision !== 'approve') return reject('CERTIFICATION_DECISION_NOT_APPROVED');
    if (!isPlainObject(reviewer)
        || typeof reviewer.id !== 'string'
        || !reviewer.id.trim()
        || typeof reviewer.displayName !== 'string'
        || !reviewer.displayName.trim()) {
        return reject('CERTIFICATION_REVIEWER_INVALID');
    }
    if (!validIsoTimestamp(certifiedAt)) return reject('CERTIFICATION_TIMESTAMP_INVALID');
    if (typeof reviewNote !== 'string' || !reviewNote.trim() || reviewNote.length > 2000) {
        return reject('CERTIFICATION_REVIEW_NOTE_INVALID');
    }

    const { bundle, candidate } = sessionValidation;
    const requirements = candidate.recommendation.requirements;
    const certifiedProfile = Object.freeze({
        schemaVersion: 1,
        modelId: candidate.modelId,
        backend: candidate.backend,
        resolution: Object.freeze({
            width: candidate.resolution.width,
            height: candidate.resolution.height,
        }),
        status: RESOURCE_PROFILE_STATUS.CERTIFIED,
        requirements: Object.freeze({
            minSystemRamMiB: requirements.minSystemRamMiB,
            ...(candidate.backend === 'cuda12'
                ? { minVramMiB: requirements.minVramMiB }
                : {}),
        }),
        evidence: Object.freeze({
            method: 'controlled-benchmark',
            sampleCount: bundle.runCount,
            harnessVersion: candidate.benchmarkContext.harnessVersion,
            sourceCommit: candidate.benchmarkContext.sourceCommit,
            certifiedAt,
            safetyMarginPct: candidate.recommendation.safetyMarginPct,
        }),
    });

    const profileValidation = validateCertifiedResourceProfile(certifiedProfile);
    if (!profileValidation.ok) return reject(profileValidation.reason);

    const certificationRecord = Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c8-human-certification-record',
        decision: 'approve',
        session: Object.freeze({
            modelId: bundle.modelId,
            backend: bundle.backend,
            resolution: Object.freeze({ ...bundle.resolution }),
            runCount: bundle.runCount,
            runIndexes: Object.freeze([...bundle.runIndexes]),
            reviewedAt: bundle.reviewedAt,
            auxiliaryArtifacts: Object.freeze(bundle.auxiliaryArtifacts.map((artifact) => Object.freeze({ ...artifact }))),
        }),
        approvedRequirements: certifiedProfile.requirements,
        reviewer: Object.freeze({
            id: reviewer.id.trim(),
            displayName: reviewer.displayName.trim(),
            reviewerIdentityVerified: false,
        }),
        certifiedAt,
        reviewNote: reviewNote.trim(),
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });

    return Object.freeze({
        status: CERTIFICATION_STATUS.CERTIFIED,
        reason: null,
        certificationRecord,
        certifiedProfile,
        reviewerIdentityVerified: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export { validateReviewableSession };
