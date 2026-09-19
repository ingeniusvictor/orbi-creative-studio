import { certifyResourceProfile, CERTIFICATION_STATUS } from './resourceProfileCertification.mjs';
import { readUserBenchmarkReviewSession } from './userBenchmarkReview.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const USER_BENCHMARK_CERTIFICATION_STATUS = Object.freeze({
    EMPTY: 'USER_BENCHMARK_CERTIFICATION_EMPTY',
    CERTIFIED: 'USER_BENCHMARK_CERTIFICATION_RECORDED',
    REJECTED: 'USER_BENCHMARK_CERTIFICATION_REJECTED',
});

const certifications = new Map();

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function normalizeReviewer(reviewer) {
    if (!reviewer
        || typeof reviewer !== 'object'
        || Array.isArray(reviewer)
        || Object.keys(reviewer).length !== 2
        || typeof reviewer.id !== 'string'
        || !reviewer.id.trim()
        || reviewer.id.trim().length > 200
        || typeof reviewer.displayName !== 'string'
        || !reviewer.displayName.trim()
        || reviewer.displayName.trim().length > 200) {
        return null;
    }

    return Object.freeze({
        id: reviewer.id.trim(),
        displayName: reviewer.displayName.trim(),
    });
}

function authorityFields() {
    return Object.freeze({
        certificationOnly: true,
        runtimeRegistryLoaded: false,
        reviewerIdentityVerified: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason, target = null) {
    return Object.freeze({
        status: USER_BENCHMARK_CERTIFICATION_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: USER_BENCHMARK_CERTIFICATION_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

function cloneRequirements(requirements, backend) {
    return Object.freeze({
        minSystemRamMiB: requirements.minSystemRamMiB,
        ...(backend === 'cuda12' ? { minVramMiB: requirements.minVramMiB } : {}),
    });
}

function buildSummary(certificationResult) {
    const record = certificationResult.certificationRecord;
    const profile = certificationResult.certifiedProfile;
    return Object.freeze({
        modelId: profile.modelId,
        backend: profile.backend,
        resolution: Object.freeze({ ...profile.resolution }),
        certifiedAt: record.certifiedAt,
        requirements: cloneRequirements(profile.requirements, profile.backend),
        reviewerDisplayName: record.reviewer.displayName,
        reviewerIdentityVerified: false,
        authenticityVerified: false,
        runtimeRegistryLoaded: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneCertificationResult(result) {
    const record = result.certificationRecord;
    const profile = result.certifiedProfile;

    return Object.freeze({
        status: result.status,
        reason: null,
        certificationRecord: Object.freeze({
            ...record,
            session: Object.freeze({
                ...record.session,
                resolution: Object.freeze({ ...record.session.resolution }),
                runIndexes: Object.freeze([...record.session.runIndexes]),
                auxiliaryArtifacts: Object.freeze(record.session.auxiliaryArtifacts.map((artifact) => Object.freeze({ ...artifact }))),
            }),
            approvedRequirements: Object.freeze({ ...record.approvedRequirements }),
            reviewer: Object.freeze({ ...record.reviewer }),
        }),
        certifiedProfile: Object.freeze({
            ...profile,
            resolution: Object.freeze({ ...profile.resolution }),
            requirements: Object.freeze({ ...profile.requirements }),
            evidence: Object.freeze({ ...profile.evidence }),
        }),
        reviewerIdentityVerified: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateCertificationResult(result, target) {
    if (!result
        || result.status !== CERTIFICATION_STATUS.CERTIFIED
        || result.reason !== null
        || !result.certificationRecord
        || !result.certifiedProfile
        || result.reviewerIdentityVerified !== false
        || result.authenticityVerified !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return false;
    }

    const profile = result.certifiedProfile;
    const record = result.certificationRecord;
    return profile.modelId === target.modelId
        && profile.backend === target.backend
        && profile.resolution?.width === target.width
        && profile.resolution?.height === target.height
        && profile.status === 'certified'
        && record.evidenceType === 'p1c8-human-certification-record'
        && record.decision === 'approve'
        && record.authenticityVerified === false
        && record.routingEligible === false
        && record.cutoverAuthorized === false
        && record.executionAuthority === 'legacy-dispatcher-only';
}

export function createUserBenchmarkCertification({
    readReviewSession = readUserBenchmarkReviewSession,
    certify = certifyResourceProfile,
    now = () => new Date(),
    store = certifications,
} = {}) {
    if (typeof readReviewSession !== 'function') throw new TypeError('review session reader must be a function');
    if (typeof certify !== 'function') throw new TypeError('resource profile certifier must be a function');
    if (typeof now !== 'function') throw new TypeError('clock must be a function');
    if (!(store instanceof Map)) throw new TypeError('certification store must be a Map');

    const recordCertification = ({
        target,
        decision,
        reviewer,
        reviewNote,
    } = {}) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        if (decision !== 'approve') {
            return rejected('USER_BENCHMARK_CERTIFICATION_DECISION_NOT_APPROVED', normalizedTarget);
        }

        const normalizedReviewer = normalizeReviewer(reviewer);
        if (!normalizedReviewer) {
            return rejected('USER_BENCHMARK_CERTIFICATION_REVIEWER_INVALID', normalizedTarget);
        }

        if (typeof reviewNote !== 'string'
            || !reviewNote.trim()
            || reviewNote.trim().length > 2000) {
            return rejected('USER_BENCHMARK_CERTIFICATION_NOTE_INVALID', normalizedTarget);
        }

        let sessionResult;
        try {
            sessionResult = readReviewSession(normalizedTarget);
        } catch {
            return rejected('USER_BENCHMARK_CERTIFICATION_REVIEW_UNAVAILABLE', normalizedTarget);
        }
        if (!sessionResult) {
            return rejected('USER_BENCHMARK_CERTIFICATION_REVIEW_UNAVAILABLE', normalizedTarget);
        }

        let certifiedAt;
        try {
            certifiedAt = now().toISOString();
        } catch {
            return rejected('USER_BENCHMARK_CERTIFICATION_TIMESTAMP_INVALID', normalizedTarget);
        }
        if (!validIsoTimestamp(certifiedAt)) {
            return rejected('USER_BENCHMARK_CERTIFICATION_TIMESTAMP_INVALID', normalizedTarget);
        }

        let result;
        try {
            result = certify({
                sessionResult,
                decision: 'approve',
                reviewer: normalizedReviewer,
                certifiedAt,
                reviewNote: reviewNote.trim(),
            });
        } catch {
            return rejected('USER_BENCHMARK_CERTIFICATION_FAILED', normalizedTarget);
        }

        if (!validateCertificationResult(result, normalizedTarget)) {
            return rejected('USER_BENCHMARK_CERTIFICATION_RESULT_INVALID', normalizedTarget);
        }

        const detached = cloneCertificationResult(result);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: USER_BENCHMARK_CERTIFICATION_STATUS.CERTIFIED,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(detached),
            ...authorityFields(),
        });
    };

    const getSummary = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;
        const result = store.get(targetKey(normalizedTarget));
        if (!result) return empty(normalizedTarget);

        return Object.freeze({
            status: USER_BENCHMARK_CERTIFICATION_STATUS.CERTIFIED,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(result),
            ...authorityFields(),
        });
    };

    const readCertification = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const result = store.get(targetKey(targetValidation.target));
        return result ? cloneCertificationResult(result) : null;
    };

    return Object.freeze({
        recordCertification,
        getSummary,
        readCertification,
        ...authorityFields(),
    });
}

const defaultCertification = createUserBenchmarkCertification();

export function recordUserBenchmarkCertification(input) {
    return defaultCertification.recordCertification(input);
}

export function getUserBenchmarkCertificationSummary(target) {
    return defaultCertification.getSummary(target);
}

export function readUserBenchmarkCertification(target) {
    return defaultCertification.readCertification(target);
}

export {
    buildSummary,
    cloneCertificationResult,
    normalizeReviewer,
    targetKey,
    validateCertificationResult,
};
