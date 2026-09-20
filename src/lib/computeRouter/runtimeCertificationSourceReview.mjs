import {
    readRuntimeCertificationSourceMaterialization,
    validateMaterializedRuntimeCertificationSource,
} from './runtimeCertificationSourceMaterialization.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const RUNTIME_CERTIFICATION_SOURCE_REVIEW_STATUS = Object.freeze({
    EMPTY: 'RUNTIME_CERTIFICATION_SOURCE_REVIEW_EMPTY',
    READY: 'RUNTIME_CERTIFICATION_SOURCE_REVIEW_READY',
    REJECTED: 'RUNTIME_CERTIFICATION_SOURCE_REVIEW_REJECTED',
});

export const RUNTIME_CERTIFICATION_SOURCE_PATH =
    'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs';

const reviewArtifacts = new Map();

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }

    return Object.freeze(value);
}

function stableNormalize(value) {
    if (Array.isArray(value)) return value.map((entry) => stableNormalize(entry));
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
        .sort()
        .reduce((result, key) => {
            result[key] = stableNormalize(value[key]);
            return result;
        }, {});
}

export function stableStringify(value, space = 4) {
    return JSON.stringify(stableNormalize(value), null, space);
}

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function authorityFields() {
    return Object.freeze({
        reviewArtifactOnly: true,
        sourceReviewRequired: true,
        sourceCommitRequired: true,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export function renderRuntimeCertificationSourceModule(sourceSnapshot) {
    const validation = validateMaterializedRuntimeCertificationSource(sourceSnapshot, {
        expectedRevision: sourceSnapshot?.sourceRevision,
    });
    if (!validation.ok) {
        throw new TypeError('materialized runtime certification source is invalid');
    }

    const certifications = stableStringify(sourceSnapshot.certifications, 4);

    return `function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }

    return Object.freeze(value);
}

/*
 * Governed runtime certification source.
 *
 * Certifications in this bundle must originate from controlled benchmark evidence,
 * explicit human approval, and deliberate source review.
 *
 * Do not insert synthetic/demo/fixture certifications here.
 */
const certifications = ${certifications};

export const RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE = deepFreeze({
    schemaVersion: 1,
    sourceType: 'source-controlled-static-bundle',
    sourceRevision: ${sourceSnapshot.sourceRevision},
    certifications,
    authenticityVerified: false,
    routingEligible: false,
    cutoverAuthorized: false,
    executionAuthority: 'legacy-dispatcher-only',
});
`;
}

function cloneArtifact(artifact) {
    return deepFreeze({
        schemaVersion: 1,
        artifactType: 'p1c26-runtime-certification-source-review-artifact',
        status: 'source-review-required',
        context: { ...artifact.context },
        targetPath: artifact.targetPath,
        contentFormat: 'utf-8-javascript-module',
        baseSourceRevision: artifact.baseSourceRevision,
        proposedSourceRevision: artifact.proposedSourceRevision,
        certificationCountBefore: artifact.certificationCountBefore,
        certificationCountAfter: artifact.certificationCountAfter,
        candidateRegistryValidated: true,
        sourceContent: artifact.sourceContent,
        deterministicSerialization: true,
        ...authorityFields(),
    });
}

function buildSummary(artifact) {
    return Object.freeze({
        modelId: artifact.context.modelId,
        backend: artifact.context.backend,
        resolution: Object.freeze({
            width: artifact.context.width,
            height: artifact.context.height,
        }),
        targetPath: artifact.targetPath,
        contentFormat: artifact.contentFormat,
        baseSourceRevision: artifact.baseSourceRevision,
        proposedSourceRevision: artifact.proposedSourceRevision,
        certificationCountBefore: artifact.certificationCountBefore,
        certificationCountAfter: artifact.certificationCountAfter,
        candidateRegistryValidated: true,
        deterministicSerialization: true,
        sourceReviewRequired: true,
        sourceCommitRequired: true,
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
        status: RUNTIME_CERTIFICATION_SOURCE_REVIEW_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_REVIEW_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

export function validateRuntimeCertificationSourceReviewArtifact(
    artifact,
    materialization,
) {
    if (!artifact
        || typeof artifact !== 'object'
        || Array.isArray(artifact)
        || artifact.schemaVersion !== 1
        || artifact.artifactType !== 'p1c26-runtime-certification-source-review-artifact'
        || artifact.status !== 'source-review-required'
        || artifact.targetPath !== RUNTIME_CERTIFICATION_SOURCE_PATH
        || artifact.contentFormat !== 'utf-8-javascript-module'
        || artifact.deterministicSerialization !== true
        || artifact.candidateRegistryValidated !== true
        || artifact.reviewArtifactOnly !== true
        || artifact.sourceReviewRequired !== true
        || artifact.sourceCommitRequired !== true
        || artifact.sourceMutationApplied !== false
        || artifact.runtimeRegistryLoaded !== false
        || artifact.authenticityVerified !== false
        || artifact.routingEligible !== false
        || artifact.cutoverAuthorized !== false
        || artifact.executionAuthority !== 'legacy-dispatcher-only'
        || typeof artifact.sourceContent !== 'string'
        || artifact.sourceContent.length === 0) {
        return Object.freeze({ ok: false, reason: 'SOURCE_REVIEW_ARTIFACT_SHAPE_INVALID' });
    }

    if (!materialization
        || materialization.materializationType !== 'p1c25-runtime-certification-source-materialization'
        || materialization.status !== 'source-commit-required'
        || materialization.candidateRegistryValidated !== true
        || materialization.sourceMutationApplied !== false
        || materialization.runtimeRegistryLoaded !== false
        || materialization.routingEligible !== false
        || materialization.cutoverAuthorized !== false
        || materialization.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'SOURCE_REVIEW_MATERIALIZATION_INVALID' });
    }

    if (artifact.context?.modelId !== materialization.context.modelId
        || artifact.context?.backend !== materialization.context.backend
        || artifact.context?.width !== materialization.context.width
        || artifact.context?.height !== materialization.context.height
        || artifact.baseSourceRevision !== materialization.baseSourceRevision
        || artifact.proposedSourceRevision !== materialization.proposedSourceRevision
        || artifact.certificationCountBefore !== materialization.certificationCountBefore
        || artifact.certificationCountAfter !== materialization.certificationCountAfter) {
        return Object.freeze({ ok: false, reason: 'SOURCE_REVIEW_ARTIFACT_CONTEXT_MISMATCH' });
    }

    const sourceValidation = validateMaterializedRuntimeCertificationSource(
        materialization.sourceSnapshot,
        { expectedRevision: artifact.proposedSourceRevision },
    );
    if (!sourceValidation.ok) {
        return Object.freeze({ ok: false, reason: sourceValidation.reason });
    }

    let expectedSourceContent;
    try {
        expectedSourceContent = renderRuntimeCertificationSourceModule(
            materialization.sourceSnapshot,
        );
    } catch {
        return Object.freeze({ ok: false, reason: 'SOURCE_REVIEW_RENDER_FAILED' });
    }

    if (artifact.sourceContent !== expectedSourceContent) {
        return Object.freeze({ ok: false, reason: 'SOURCE_REVIEW_ARTIFACT_CONTENT_MISMATCH' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        targetPath: artifact.targetPath,
        proposedSourceRevision: artifact.proposedSourceRevision,
        certificationCount: artifact.certificationCountAfter,
    });
}

export function createRuntimeCertificationSourceReview({
    readMaterialization = readRuntimeCertificationSourceMaterialization,
    store = reviewArtifacts,
} = {}) {
    if (typeof readMaterialization !== 'function') {
        throw new TypeError('source materialization reader must be a function');
    }
    if (!(store instanceof Map)) throw new TypeError('source review artifact store must be a Map');

    const prepare = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        let materialization;
        try {
            materialization = readMaterialization(normalizedTarget);
        } catch {
            return rejected('SOURCE_REVIEW_MATERIALIZATION_READ_FAILED', normalizedTarget);
        }
        if (!materialization) {
            return rejected('SOURCE_REVIEW_MATERIALIZATION_MISSING', normalizedTarget);
        }

        const sourceValidation = validateMaterializedRuntimeCertificationSource(
            materialization.sourceSnapshot,
            { expectedRevision: materialization.proposedSourceRevision },
        );
        if (!sourceValidation.ok) {
            return rejected('SOURCE_REVIEW_MATERIALIZATION_INVALID', normalizedTarget);
        }

        if (materialization.context?.modelId !== normalizedTarget.modelId
            || materialization.context?.backend !== normalizedTarget.backend
            || materialization.context?.width !== normalizedTarget.width
            || materialization.context?.height !== normalizedTarget.height) {
            return rejected('SOURCE_REVIEW_MATERIALIZATION_CONTEXT_MISMATCH', normalizedTarget);
        }

        let sourceContent;
        try {
            sourceContent = renderRuntimeCertificationSourceModule(
                materialization.sourceSnapshot,
            );
        } catch {
            return rejected('SOURCE_REVIEW_RENDER_FAILED', normalizedTarget);
        }

        const artifact = deepFreeze({
            schemaVersion: 1,
            artifactType: 'p1c26-runtime-certification-source-review-artifact',
            status: 'source-review-required',
            context: { ...normalizedTarget },
            targetPath: RUNTIME_CERTIFICATION_SOURCE_PATH,
            contentFormat: 'utf-8-javascript-module',
            baseSourceRevision: materialization.baseSourceRevision,
            proposedSourceRevision: materialization.proposedSourceRevision,
            certificationCountBefore: materialization.certificationCountBefore,
            certificationCountAfter: materialization.certificationCountAfter,
            candidateRegistryValidated: true,
            sourceContent,
            deterministicSerialization: true,
            ...authorityFields(),
        });

        const artifactValidation = validateRuntimeCertificationSourceReviewArtifact(
            artifact,
            materialization,
        );
        if (!artifactValidation.ok) {
            return rejected(artifactValidation.reason, normalizedTarget);
        }

        const detached = cloneArtifact(artifact);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_REVIEW_STATUS.READY,
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
        const artifact = store.get(targetKey(normalizedTarget));
        if (!artifact) return empty(normalizedTarget);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_REVIEW_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(artifact),
            ...authorityFields(),
        });
    };

    const readArtifact = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const artifact = store.get(targetKey(targetValidation.target));
        return artifact ? cloneArtifact(artifact) : null;
    };

    return Object.freeze({
        prepare,
        getSummary,
        readArtifact,
        ...authorityFields(),
    });
}

const defaultReview = createRuntimeCertificationSourceReview();

export function prepareRuntimeCertificationSourceReviewArtifact(target) {
    return defaultReview.prepare(target);
}

export function getRuntimeCertificationSourceReviewSummary(target) {
    return defaultReview.getSummary(target);
}

export function readRuntimeCertificationSourceReviewArtifact(target) {
    return defaultReview.readArtifact(target);
}

export {
    authorityFields,
    buildSummary,
    cloneArtifact,
    deepFreeze,
    stableNormalize,
    targetKey,
};
