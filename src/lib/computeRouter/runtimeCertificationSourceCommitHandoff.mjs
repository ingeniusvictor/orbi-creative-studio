import {
    RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
} from './runtimeResourceProfileCertifications.mjs';
import {
    validateRuntimeCertificationSource,
} from './runtimeCertifiedResourceProfileRegistry.mjs';
import {
    readRuntimeCertificationSourceMaterialization,
} from './runtimeCertificationSourceMaterialization.mjs';
import {
    RUNTIME_CERTIFICATION_SOURCE_PATH,
    readRuntimeCertificationSourceReviewArtifact,
    validateRuntimeCertificationSourceReviewArtifact,
} from './runtimeCertificationSourceReview.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_STATUS = Object.freeze({
    EMPTY: 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_EMPTY',
    READY: 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_READY',
    REJECTED: 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_REJECTED',
});

const SHA40 = /^[0-9a-f]{40}$/;
const handoffs = new Map();

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }

    return Object.freeze(value);
}

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateSha40(value) {
    return typeof value === 'string' && SHA40.test(value);
}

function validateReviewApproval(review) {
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
        return Object.freeze({ ok: false, reason: 'SOURCE_HANDOFF_REVIEW_REQUIRED' });
    }

    const reviewerId = normalizeText(review.reviewerId);
    const reviewerDisplayName = normalizeText(review.reviewerDisplayName);
    const reviewNote = normalizeText(review.reviewNote);
    const reviewedAt = normalizeText(review.reviewedAt);

    if (review.sourceReviewApproved !== true) {
        return Object.freeze({ ok: false, reason: 'SOURCE_HANDOFF_REVIEW_NOT_APPROVED' });
    }
    if (!reviewerId) {
        return Object.freeze({ ok: false, reason: 'SOURCE_HANDOFF_REVIEWER_ID_REQUIRED' });
    }
    if (!reviewerDisplayName) {
        return Object.freeze({ ok: false, reason: 'SOURCE_HANDOFF_REVIEWER_NAME_REQUIRED' });
    }
    if (!reviewNote) {
        return Object.freeze({ ok: false, reason: 'SOURCE_HANDOFF_REVIEW_NOTE_REQUIRED' });
    }
    if (!reviewedAt || Number.isNaN(Date.parse(reviewedAt))) {
        return Object.freeze({ ok: false, reason: 'SOURCE_HANDOFF_REVIEWED_AT_INVALID' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        review: deepFreeze({
            sourceReviewApproved: true,
            reviewerId,
            reviewerDisplayName,
            reviewNote,
            reviewedAt,
            reviewerIdentityVerified: false,
        }),
    });
}

function authorityFields(sourceReviewApproved = false) {
    return Object.freeze({
        handoffOnly: true,
        sourceReviewApproved,
        sourceCommitRequired: true,
        requiresExternalSourceCommit: true,
        baseIdentityBound: true,
        staleProtectionRequired: true,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneHandoff(handoff) {
    return deepFreeze({
        schemaVersion: 1,
        handoffType: 'p1c27-runtime-certification-source-commit-handoff',
        status: 'external-source-commit-required',
        context: { ...handoff.context },
        targetPath: handoff.targetPath,
        contentFormat: handoff.contentFormat,
        baseIdentity: {
            baseCommitSha: handoff.baseIdentity.baseCommitSha,
            sourceBlobSha: handoff.baseIdentity.sourceBlobSha,
            sourceRevision: handoff.baseIdentity.sourceRevision,
            certificationCount: handoff.baseIdentity.certificationCount,
        },
        proposal: {
            proposedSourceRevision: handoff.proposal.proposedSourceRevision,
            proposedCertificationCount: handoff.proposal.proposedCertificationCount,
            sourceContent: handoff.proposal.sourceContent,
            deterministicSerialization: true,
            candidateRegistryValidated: true,
        },
        review: {
            sourceReviewApproved: true,
            reviewerId: handoff.review.reviewerId,
            reviewerDisplayName: handoff.review.reviewerDisplayName,
            reviewNote: handoff.review.reviewNote,
            reviewedAt: handoff.review.reviewedAt,
            reviewerIdentityVerified: false,
        },
        ...authorityFields(true),
    });
}

function buildSummary(handoff) {
    return Object.freeze({
        modelId: handoff.context.modelId,
        backend: handoff.context.backend,
        resolution: Object.freeze({
            width: handoff.context.width,
            height: handoff.context.height,
        }),
        targetPath: handoff.targetPath,
        contentFormat: handoff.contentFormat,
        baseCommitSha: handoff.baseIdentity.baseCommitSha,
        sourceBlobSha: handoff.baseIdentity.sourceBlobSha,
        baseSourceRevision: handoff.baseIdentity.sourceRevision,
        proposedSourceRevision: handoff.proposal.proposedSourceRevision,
        certificationCountBefore: handoff.baseIdentity.certificationCount,
        certificationCountAfter: handoff.proposal.proposedCertificationCount,
        deterministicSerialization: true,
        candidateRegistryValidated: true,
        sourceReviewApproved: true,
        reviewerIdentityVerified: false,
        sourceCommitRequired: true,
        requiresExternalSourceCommit: true,
        baseIdentityBound: true,
        staleProtectionRequired: true,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason, target = null) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(false),
    });
}

function empty(target) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(false),
    });
}

export function validateRuntimeCertificationSourceCommitHandoff(handoff) {
    if (!handoff
        || typeof handoff !== 'object'
        || Array.isArray(handoff)
        || handoff.schemaVersion !== 1
        || handoff.handoffType !== 'p1c27-runtime-certification-source-commit-handoff'
        || handoff.status !== 'external-source-commit-required'
        || handoff.targetPath !== RUNTIME_CERTIFICATION_SOURCE_PATH
        || handoff.contentFormat !== 'utf-8-javascript-module'
        || !validateSha40(handoff.baseIdentity?.baseCommitSha)
        || !validateSha40(handoff.baseIdentity?.sourceBlobSha)
        || !Number.isInteger(handoff.baseIdentity?.sourceRevision)
        || handoff.baseIdentity.sourceRevision < 1
        || !Number.isInteger(handoff.baseIdentity?.certificationCount)
        || handoff.baseIdentity.certificationCount < 0
        || !Number.isInteger(handoff.proposal?.proposedSourceRevision)
        || handoff.proposal.proposedSourceRevision !== handoff.baseIdentity.sourceRevision + 1
        || !Number.isInteger(handoff.proposal?.proposedCertificationCount)
        || handoff.proposal.proposedCertificationCount !== handoff.baseIdentity.certificationCount + 1
        || typeof handoff.proposal?.sourceContent !== 'string'
        || handoff.proposal.sourceContent.length === 0
        || handoff.proposal.deterministicSerialization !== true
        || handoff.proposal.candidateRegistryValidated !== true
        || handoff.review?.sourceReviewApproved !== true
        || !normalizeText(handoff.review?.reviewerId)
        || !normalizeText(handoff.review?.reviewerDisplayName)
        || !normalizeText(handoff.review?.reviewNote)
        || !normalizeText(handoff.review?.reviewedAt)
        || handoff.review?.reviewerIdentityVerified !== false
        || handoff.handoffOnly !== true
        || handoff.sourceReviewApproved !== true
        || handoff.sourceCommitRequired !== true
        || handoff.requiresExternalSourceCommit !== true
        || handoff.baseIdentityBound !== true
        || handoff.staleProtectionRequired !== true
        || handoff.sourceMutationApplied !== false
        || handoff.runtimeRegistryLoaded !== false
        || handoff.authenticityVerified !== false
        || handoff.routingEligible !== false
        || handoff.cutoverAuthorized !== false
        || handoff.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'SOURCE_COMMIT_HANDOFF_SHAPE_INVALID' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        targetPath: handoff.targetPath,
        baseCommitSha: handoff.baseIdentity.baseCommitSha,
        sourceBlobSha: handoff.baseIdentity.sourceBlobSha,
        baseSourceRevision: handoff.baseIdentity.sourceRevision,
        proposedSourceRevision: handoff.proposal.proposedSourceRevision,
    });
}

export function validateRuntimeCertificationSourceCommitHandoffAgainstState(
    handoff,
    {
        baseCommitSha,
        sourceBlobSha,
        sourceRevision,
        certificationCount,
    } = {},
) {
    const validation = validateRuntimeCertificationSourceCommitHandoff(handoff);
    if (!validation.ok) return validation;

    if (!validateSha40(baseCommitSha)
        || !validateSha40(sourceBlobSha)
        || !Number.isInteger(sourceRevision)
        || !Number.isInteger(certificationCount)) {
        return Object.freeze({ ok: false, reason: 'SOURCE_COMMIT_CURRENT_STATE_INVALID' });
    }

    if (handoff.baseIdentity.baseCommitSha !== baseCommitSha) {
        return Object.freeze({ ok: false, reason: 'SOURCE_COMMIT_BASE_COMMIT_STALE' });
    }
    if (handoff.baseIdentity.sourceBlobSha !== sourceBlobSha) {
        return Object.freeze({ ok: false, reason: 'SOURCE_COMMIT_SOURCE_BLOB_STALE' });
    }
    if (handoff.baseIdentity.sourceRevision !== sourceRevision) {
        return Object.freeze({ ok: false, reason: 'SOURCE_COMMIT_SOURCE_REVISION_STALE' });
    }
    if (handoff.baseIdentity.certificationCount !== certificationCount) {
        return Object.freeze({ ok: false, reason: 'SOURCE_COMMIT_CERTIFICATION_COUNT_STALE' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        stale: false,
        targetPath: handoff.targetPath,
        proposedSourceRevision: handoff.proposal.proposedSourceRevision,
    });
}

export function createRuntimeCertificationSourceCommitHandoff({
    readReviewArtifact = readRuntimeCertificationSourceReviewArtifact,
    readMaterialization = readRuntimeCertificationSourceMaterialization,
    sourceProvider = () => RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
    store = handoffs,
} = {}) {
    if (typeof readReviewArtifact !== 'function') {
        throw new TypeError('source review artifact reader must be a function');
    }
    if (typeof readMaterialization !== 'function') {
        throw new TypeError('source materialization reader must be a function');
    }
    if (typeof sourceProvider !== 'function') {
        throw new TypeError('runtime certification source provider must be a function');
    }
    if (!(store instanceof Map)) throw new TypeError('source commit handoff store must be a Map');

    const prepare = (target, {
        baseCommitSha,
        sourceBlobSha,
        review,
    } = {}) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        if (!validateSha40(baseCommitSha)) {
            return rejected('SOURCE_HANDOFF_BASE_COMMIT_SHA_INVALID', normalizedTarget);
        }
        if (!validateSha40(sourceBlobSha)) {
            return rejected('SOURCE_HANDOFF_SOURCE_BLOB_SHA_INVALID', normalizedTarget);
        }

        const reviewValidation = validateReviewApproval(review);
        if (!reviewValidation.ok) return rejected(reviewValidation.reason, normalizedTarget);

        let currentSource;
        try {
            currentSource = sourceProvider();
        } catch {
            return rejected('SOURCE_HANDOFF_CURRENT_SOURCE_READ_FAILED', normalizedTarget);
        }
        const currentSourceValidation = validateRuntimeCertificationSource(currentSource);
        if (!currentSourceValidation.ok) {
            return rejected('SOURCE_HANDOFF_CURRENT_SOURCE_INVALID', normalizedTarget);
        }

        let materialization;
        let reviewArtifact;
        try {
            materialization = readMaterialization(normalizedTarget);
            reviewArtifact = readReviewArtifact(normalizedTarget);
        } catch {
            return rejected('SOURCE_HANDOFF_ARTIFACT_READ_FAILED', normalizedTarget);
        }
        if (!materialization) {
            return rejected('SOURCE_HANDOFF_MATERIALIZATION_MISSING', normalizedTarget);
        }
        if (!reviewArtifact) {
            return rejected('SOURCE_HANDOFF_REVIEW_ARTIFACT_MISSING', normalizedTarget);
        }

        const reviewArtifactValidation = validateRuntimeCertificationSourceReviewArtifact(
            reviewArtifact,
            materialization,
        );
        if (!reviewArtifactValidation.ok) {
            return rejected('SOURCE_HANDOFF_REVIEW_ARTIFACT_INVALID', normalizedTarget);
        }

        if (reviewArtifact.context.modelId !== normalizedTarget.modelId
            || reviewArtifact.context.backend !== normalizedTarget.backend
            || reviewArtifact.context.width !== normalizedTarget.width
            || reviewArtifact.context.height !== normalizedTarget.height) {
            return rejected('SOURCE_HANDOFF_REVIEW_CONTEXT_MISMATCH', normalizedTarget);
        }

        if (reviewArtifact.baseSourceRevision !== currentSource.sourceRevision
            || reviewArtifact.certificationCountBefore !== currentSource.certifications.length) {
            return rejected('SOURCE_HANDOFF_BASE_SOURCE_STALE', normalizedTarget);
        }

        if (reviewArtifact.proposedSourceRevision !== currentSource.sourceRevision + 1
            || reviewArtifact.certificationCountAfter !== currentSource.certifications.length + 1) {
            return rejected('SOURCE_HANDOFF_PROPOSAL_TRANSITION_INVALID', normalizedTarget);
        }

        const handoff = deepFreeze({
            schemaVersion: 1,
            handoffType: 'p1c27-runtime-certification-source-commit-handoff',
            status: 'external-source-commit-required',
            context: { ...normalizedTarget },
            targetPath: reviewArtifact.targetPath,
            contentFormat: reviewArtifact.contentFormat,
            baseIdentity: {
                baseCommitSha,
                sourceBlobSha,
                sourceRevision: currentSource.sourceRevision,
                certificationCount: currentSource.certifications.length,
            },
            proposal: {
                proposedSourceRevision: reviewArtifact.proposedSourceRevision,
                proposedCertificationCount: reviewArtifact.certificationCountAfter,
                sourceContent: reviewArtifact.sourceContent,
                deterministicSerialization: true,
                candidateRegistryValidated: true,
            },
            review: reviewValidation.review,
            ...authorityFields(true),
        });

        const handoffValidation = validateRuntimeCertificationSourceCommitHandoff(handoff);
        if (!handoffValidation.ok) {
            return rejected(handoffValidation.reason, normalizedTarget);
        }

        const detached = cloneHandoff(handoff);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(detached),
            ...authorityFields(true),
        });
    };

    const getSummary = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;
        const handoff = store.get(targetKey(normalizedTarget));
        if (!handoff) return empty(normalizedTarget);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(handoff),
            ...authorityFields(true),
        });
    };

    const readHandoff = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const handoff = store.get(targetKey(targetValidation.target));
        return handoff ? cloneHandoff(handoff) : null;
    };

    return Object.freeze({
        prepare,
        getSummary,
        readHandoff,
        ...authorityFields(false),
    });
}

const defaultHandoff = createRuntimeCertificationSourceCommitHandoff();

export function prepareRuntimeCertificationSourceCommitHandoff(target, options) {
    return defaultHandoff.prepare(target, options);
}

export function getRuntimeCertificationSourceCommitHandoffSummary(target) {
    return defaultHandoff.getSummary(target);
}

export function readRuntimeCertificationSourceCommitHandoff(target) {
    return defaultHandoff.readHandoff(target);
}

export {
    SHA40,
    authorityFields,
    buildSummary,
    cloneHandoff,
    deepFreeze,
    normalizeText,
    targetKey,
    validateReviewApproval,
    validateSha40,
};
