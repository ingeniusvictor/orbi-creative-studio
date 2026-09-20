import {
    createCertifiedResourceProfileRegistry,
    REGISTRY_STATUS,
    validateCertificationEntry,
} from './certifiedResourceProfileRegistry.mjs';
import { readUserBenchmarkCertification } from './userBenchmarkCertification.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const RUNTIME_CERTIFICATION_PROMOTION_STATUS = Object.freeze({
    EMPTY: 'RUNTIME_CERTIFICATION_PROMOTION_EMPTY',
    READY: 'RUNTIME_CERTIFICATION_PROMOTION_READY',
    REJECTED: 'RUNTIME_CERTIFICATION_PROMOTION_REJECTED',
});

const promotionPackages = new Map();

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function authorityFields() {
    return Object.freeze({
        promotionOnly: true,
        sourceReviewRequired: true,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneCertificationEntry(entry) {
    const record = entry.certificationRecord;
    const profile = entry.certifiedProfile;

    return Object.freeze({
        status: entry.status,
        reason: null,
        certificationRecord: Object.freeze({
            ...record,
            session: Object.freeze({
                ...record.session,
                resolution: Object.freeze({ ...record.session.resolution }),
                runIndexes: Object.freeze([...record.session.runIndexes]),
                auxiliaryArtifacts: Object.freeze(record.session.auxiliaryArtifacts.map((artifact) => (
                    Object.freeze({ ...artifact })
                ))),
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

function clonePackage(pkg) {
    return Object.freeze({
        schemaVersion: 1,
        packageType: 'p1c24-runtime-certification-promotion-package',
        status: 'source-review-required',
        context: Object.freeze({ ...pkg.context }),
        source: Object.freeze({ ...pkg.source }),
        certificationEntry: cloneCertificationEntry(pkg.certificationEntry),
        sourceReviewRequired: true,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function buildSummary(pkg) {
    const profile = pkg.certificationEntry.certifiedProfile;
    return Object.freeze({
        modelId: profile.modelId,
        backend: profile.backend,
        resolution: Object.freeze({ ...profile.resolution }),
        certifiedAt: profile.evidence.certifiedAt,
        minSystemRamMiB: profile.requirements.minSystemRamMiB,
        minVramMiB: profile.backend === 'cuda12'
            ? profile.requirements.minVramMiB
            : null,
        sourceType: pkg.source.sourceType,
        baseSourceRevision: pkg.source.baseSourceRevision,
        proposedSourceRevision: pkg.source.proposedSourceRevision,
        sourceReviewRequired: true,
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
        status: RUNTIME_CERTIFICATION_PROMOTION_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_PROMOTION_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

function validatePromotionPackage(pkg) {
    if (!pkg
        || typeof pkg !== 'object'
        || pkg.schemaVersion !== 1
        || pkg.packageType !== 'p1c24-runtime-certification-promotion-package'
        || pkg.status !== 'source-review-required'
        || !pkg.context
        || !pkg.source
        || pkg.source.sourceType !== 'source-controlled-static-bundle'
        || pkg.source.baseSourceRevision !== 1
        || pkg.source.proposedSourceRevision !== 2
        || pkg.sourceReviewRequired !== true
        || pkg.sourceMutationApplied !== false
        || pkg.runtimeRegistryLoaded !== false
        || pkg.authenticityVerified !== false
        || pkg.routingEligible !== false
        || pkg.cutoverAuthorized !== false
        || pkg.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'PROMOTION_PACKAGE_SHAPE_INVALID' });
    }

    const certificationValidation = validateCertificationEntry(pkg.certificationEntry);
    if (!certificationValidation.ok) {
        return Object.freeze({ ok: false, reason: certificationValidation.reason });
    }

    const profile = certificationValidation.profile;
    if (profile.modelId !== pkg.context.modelId
        || profile.backend !== pkg.context.backend
        || profile.resolution.width !== pkg.context.width
        || profile.resolution.height !== pkg.context.height) {
        return Object.freeze({ ok: false, reason: 'PROMOTION_PACKAGE_CONTEXT_MISMATCH' });
    }

    const registry = createCertifiedResourceProfileRegistry({
        certifications: [pkg.certificationEntry],
    });
    if (registry.status !== REGISTRY_STATUS.READY
        || !registry.registry
        || registry.registry.size !== 1
        || registry.routingEligible !== false
        || registry.cutoverAuthorized !== false
        || registry.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'PROMOTION_PACKAGE_REGISTRY_REJECTED' });
    }

    return Object.freeze({ ok: true, reason: null });
}

export function createRuntimeCertificationPromotion({
    readCertification = readUserBenchmarkCertification,
    store = promotionPackages,
} = {}) {
    if (typeof readCertification !== 'function') {
        throw new TypeError('certification reader must be a function');
    }
    if (!(store instanceof Map)) throw new TypeError('promotion store must be a Map');

    const prepare = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        let certification;
        try {
            certification = readCertification(normalizedTarget);
        } catch {
            return rejected('PROMOTION_CERTIFICATION_READ_FAILED', normalizedTarget);
        }
        if (!certification) {
            return rejected('PROMOTION_CERTIFICATION_MISSING', normalizedTarget);
        }

        const certificationValidation = validateCertificationEntry(certification);
        if (!certificationValidation.ok) {
            return rejected('PROMOTION_CERTIFICATION_INVALID', normalizedTarget);
        }

        const profile = certificationValidation.profile;
        if (profile.modelId !== normalizedTarget.modelId
            || profile.backend !== normalizedTarget.backend
            || profile.resolution.width !== normalizedTarget.width
            || profile.resolution.height !== normalizedTarget.height) {
            return rejected('PROMOTION_CERTIFICATION_CONTEXT_MISMATCH', normalizedTarget);
        }

        const pkg = Object.freeze({
            schemaVersion: 1,
            packageType: 'p1c24-runtime-certification-promotion-package',
            status: 'source-review-required',
            context: Object.freeze({ ...normalizedTarget }),
            source: Object.freeze({
                sourceType: 'source-controlled-static-bundle',
                baseSourceRevision: 1,
                proposedSourceRevision: 2,
            }),
            certificationEntry: cloneCertificationEntry(certification),
            sourceReviewRequired: true,
            sourceMutationApplied: false,
            runtimeRegistryLoaded: false,
            authenticityVerified: false,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });

        const validation = validatePromotionPackage(pkg);
        if (!validation.ok) return rejected(validation.reason, normalizedTarget);

        const detached = clonePackage(pkg);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_PROMOTION_STATUS.READY,
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
        const pkg = store.get(targetKey(normalizedTarget));
        if (!pkg) return empty(normalizedTarget);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_PROMOTION_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(pkg),
            ...authorityFields(),
        });
    };

    const readPackage = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const pkg = store.get(targetKey(targetValidation.target));
        return pkg ? clonePackage(pkg) : null;
    };

    return Object.freeze({
        prepare,
        getSummary,
        readPackage,
        ...authorityFields(),
    });
}

const defaultPromotion = createRuntimeCertificationPromotion();

export function prepareRuntimeCertificationPromotion(target) {
    return defaultPromotion.prepare(target);
}

export function getRuntimeCertificationPromotionSummary(target) {
    return defaultPromotion.getSummary(target);
}

export function readRuntimeCertificationPromotionPackage(target) {
    return defaultPromotion.readPackage(target);
}

export {
    buildSummary,
    cloneCertificationEntry,
    clonePackage,
    targetKey,
    validatePromotionPackage,
};
