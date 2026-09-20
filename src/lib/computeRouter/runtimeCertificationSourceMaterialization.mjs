import {
    createCertifiedResourceProfileRegistry,
    REGISTRY_STATUS,
} from './certifiedResourceProfileRegistry.mjs';
import {
    RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
} from './runtimeResourceProfileCertifications.mjs';
import {
    validateRuntimeCertificationSource,
} from './runtimeCertifiedResourceProfileRegistry.mjs';
import {
    cloneCertificationEntry,
    readRuntimeCertificationPromotionPackage,
    validatePromotionPackage,
} from './runtimeCertificationPromotion.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_STATUS = Object.freeze({
    EMPTY: 'RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_EMPTY',
    READY: 'RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_READY',
    REJECTED: 'RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_REJECTED',
});

const SOURCE_KEYS = new Set([
    'schemaVersion',
    'sourceType',
    'sourceRevision',
    'certifications',
    'authenticityVerified',
    'routingEligible',
    'cutoverAuthorized',
    'executionAuthority',
]);

const materializations = new Map();

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }

    return Object.freeze(value);
}

function isDeepFrozen(value) {
    if (!value || typeof value !== 'object') return true;
    if (!Object.isFrozen(value)) return false;
    return Object.values(value).every((entry) => isDeepFrozen(entry));
}

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function authorityFields() {
    return Object.freeze({
        materializationOnly: true,
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

function cloneSourceSnapshot(source) {
    return deepFreeze({
        schemaVersion: source.schemaVersion,
        sourceType: source.sourceType,
        sourceRevision: source.sourceRevision,
        certifications: source.certifications.map((entry) => cloneCertificationEntry(entry)),
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneMaterialization(materialization) {
    return deepFreeze({
        schemaVersion: 1,
        materializationType: 'p1c25-runtime-certification-source-materialization',
        status: 'source-commit-required',
        context: { ...materialization.context },
        baseSourceRevision: materialization.baseSourceRevision,
        proposedSourceRevision: materialization.proposedSourceRevision,
        certificationCountBefore: materialization.certificationCountBefore,
        certificationCountAfter: materialization.certificationCountAfter,
        sourceSnapshot: cloneSourceSnapshot(materialization.sourceSnapshot),
        candidateRegistryValidated: true,
        ...authorityFields(),
    });
}

function buildSummary(materialization) {
    return Object.freeze({
        modelId: materialization.context.modelId,
        backend: materialization.context.backend,
        resolution: Object.freeze({
            width: materialization.context.width,
            height: materialization.context.height,
        }),
        baseSourceRevision: materialization.baseSourceRevision,
        proposedSourceRevision: materialization.proposedSourceRevision,
        certificationCountBefore: materialization.certificationCountBefore,
        certificationCountAfter: materialization.certificationCountAfter,
        candidateRegistryValidated: true,
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
        status: RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

export function validateMaterializedRuntimeCertificationSource(source, {
    expectedRevision,
} = {}) {
    if (!hasExactKeys(source, SOURCE_KEYS)) {
        return Object.freeze({ ok: false, reason: 'MATERIALIZED_SOURCE_SHAPE_INVALID' });
    }
    if (source.schemaVersion !== 1
        || source.sourceType !== 'source-controlled-static-bundle'
        || !Number.isInteger(expectedRevision)
        || source.sourceRevision !== expectedRevision
        || !Array.isArray(source.certifications)
        || source.certifications.length < 1) {
        return Object.freeze({ ok: false, reason: 'MATERIALIZED_SOURCE_IDENTITY_INVALID' });
    }
    if (source.authenticityVerified !== false
        || source.routingEligible !== false
        || source.cutoverAuthorized !== false
        || source.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'MATERIALIZED_SOURCE_AUTHORITY_INVALID' });
    }
    if (!isDeepFrozen(source)) {
        return Object.freeze({ ok: false, reason: 'MATERIALIZED_SOURCE_MUTABLE' });
    }

    const registryResult = createCertifiedResourceProfileRegistry({
        certifications: source.certifications,
    });
    if (registryResult.status !== REGISTRY_STATUS.READY
        || !registryResult.registry
        || registryResult.registry.size !== source.certifications.length
        || registryResult.routingEligible !== false
        || registryResult.cutoverAuthorized !== false
        || registryResult.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({
            ok: false,
            reason: registryResult.reason || 'MATERIALIZED_SOURCE_REGISTRY_REJECTED',
        });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        certificationCount: source.certifications.length,
    });
}

export function createRuntimeCertificationSourceMaterialization({
    readPromotionPackage = readRuntimeCertificationPromotionPackage,
    sourceProvider = () => RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
    store = materializations,
} = {}) {
    if (typeof readPromotionPackage !== 'function') {
        throw new TypeError('promotion package reader must be a function');
    }
    if (typeof sourceProvider !== 'function') {
        throw new TypeError('runtime certification source provider must be a function');
    }
    if (!(store instanceof Map)) throw new TypeError('materialization store must be a Map');

    const prepare = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        let currentSource;
        try {
            currentSource = sourceProvider();
        } catch {
            return rejected('MATERIALIZATION_SOURCE_READ_FAILED', normalizedTarget);
        }

        const currentSourceValidation = validateRuntimeCertificationSource(currentSource);
        if (!currentSourceValidation.ok) {
            return rejected('MATERIALIZATION_SOURCE_INVALID', normalizedTarget);
        }

        const currentRegistry = createCertifiedResourceProfileRegistry({
            certifications: currentSourceValidation.certifications,
        });
        if (currentRegistry.status !== REGISTRY_STATUS.READY
            || !currentRegistry.registry
            || currentRegistry.routingEligible !== false
            || currentRegistry.cutoverAuthorized !== false
            || currentRegistry.executionAuthority !== 'legacy-dispatcher-only') {
            return rejected('MATERIALIZATION_BASE_REGISTRY_INVALID', normalizedTarget);
        }

        let promotionPackage;
        try {
            promotionPackage = readPromotionPackage(normalizedTarget);
        } catch {
            return rejected('MATERIALIZATION_PROMOTION_READ_FAILED', normalizedTarget);
        }
        if (!promotionPackage) {
            return rejected('MATERIALIZATION_PROMOTION_MISSING', normalizedTarget);
        }

        const promotionValidation = validatePromotionPackage(promotionPackage);
        if (!promotionValidation.ok) {
            return rejected('MATERIALIZATION_PROMOTION_INVALID', normalizedTarget);
        }

        if (promotionPackage.context.modelId !== normalizedTarget.modelId
            || promotionPackage.context.backend !== normalizedTarget.backend
            || promotionPackage.context.width !== normalizedTarget.width
            || promotionPackage.context.height !== normalizedTarget.height) {
            return rejected('MATERIALIZATION_PROMOTION_CONTEXT_MISMATCH', normalizedTarget);
        }

        if (promotionPackage.source.baseSourceRevision !== currentSource.sourceRevision
            || promotionPackage.source.proposedSourceRevision !== currentSource.sourceRevision + 1) {
            return rejected('MATERIALIZATION_SOURCE_REVISION_MISMATCH', normalizedTarget);
        }

        const nextSource = deepFreeze({
            schemaVersion: 1,
            sourceType: currentSource.sourceType,
            sourceRevision: promotionPackage.source.proposedSourceRevision,
            certifications: [
                ...currentSource.certifications.map((entry) => cloneCertificationEntry(entry)),
                cloneCertificationEntry(promotionPackage.certificationEntry),
            ],
            authenticityVerified: false,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });

        const nextValidation = validateMaterializedRuntimeCertificationSource(nextSource, {
            expectedRevision: promotionPackage.source.proposedSourceRevision,
        });
        if (!nextValidation.ok) {
            return rejected(nextValidation.reason, normalizedTarget);
        }

        const materialization = deepFreeze({
            schemaVersion: 1,
            materializationType: 'p1c25-runtime-certification-source-materialization',
            status: 'source-commit-required',
            context: { ...normalizedTarget },
            baseSourceRevision: currentSource.sourceRevision,
            proposedSourceRevision: nextSource.sourceRevision,
            certificationCountBefore: currentSource.certifications.length,
            certificationCountAfter: nextSource.certifications.length,
            sourceSnapshot: nextSource,
            candidateRegistryValidated: true,
            ...authorityFields(),
        });

        const detached = cloneMaterialization(materialization);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_STATUS.READY,
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
        const materialization = store.get(targetKey(normalizedTarget));
        if (!materialization) return empty(normalizedTarget);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(materialization),
            ...authorityFields(),
        });
    };

    const readMaterialization = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const materialization = store.get(targetKey(targetValidation.target));
        return materialization ? cloneMaterialization(materialization) : null;
    };

    return Object.freeze({
        prepare,
        getSummary,
        readMaterialization,
        ...authorityFields(),
    });
}

const defaultMaterialization = createRuntimeCertificationSourceMaterialization();

export function prepareRuntimeCertificationSourceMaterialization(target) {
    return defaultMaterialization.prepare(target);
}

export function getRuntimeCertificationSourceMaterializationSummary(target) {
    return defaultMaterialization.getSummary(target);
}

export function readRuntimeCertificationSourceMaterialization(target) {
    return defaultMaterialization.readMaterialization(target);
}

export {
    SOURCE_KEYS,
    authorityFields,
    buildSummary,
    cloneMaterialization,
    cloneSourceSnapshot,
    deepFreeze,
    hasExactKeys,
    isDeepFrozen,
    targetKey,
};
