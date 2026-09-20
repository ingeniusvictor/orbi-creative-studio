import {
    RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
} from './runtimeResourceProfileCertifications.mjs';
import {
    RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS,
    validateRuntimeCertificationSource,
} from './runtimeCertifiedResourceProfileRegistry.mjs';
import {
    readRuntimeCertificationSourceMaterialization,
} from './runtimeCertificationSourceMaterialization.mjs';
import {
    readRuntimeCertificationSourceReviewArtifact,
    validateRuntimeCertificationSourceReviewArtifact,
} from './runtimeCertificationSourceReview.mjs';
import {
    readRuntimeCertificationSourceCommitHandoff,
    validateRuntimeCertificationSourceCommitHandoff,
    validateRuntimeCertificationSourceCommitHandoffAgainstState,
} from './runtimeCertificationSourceCommitHandoff.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS = Object.freeze({
    EMPTY: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_EMPTY',
    READY: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_READY',
    BLOCKED: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_BLOCKED',
    REJECTED: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_REJECTED',
});

const dryRuns = new Map();

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

function normalizeSupportedRevisions(value) {
    if (!Array.isArray(value)
        || value.length === 0
        || value.some((entry) => !Number.isInteger(entry) || entry < 1)) {
        return null;
    }
    return Object.freeze([...new Set(value)].sort((a, b) => a - b));
}

function authorityFields({
    sourceReviewApproved = false,
    sourceApplyEligible = false,
    runtimeLoaderCompatible = false,
    runtimeLoaderMigrationRequired = false,
} = {}) {
    return Object.freeze({
        dryRunOnly: true,
        sourceReviewApproved,
        sourceApplyEligible,
        runtimeLoaderCompatible,
        runtimeLoaderMigrationRequired,
        guardedApplyRequired: true,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneDryRun(plan) {
    return deepFreeze({
        schemaVersion: 1,
        planType: 'p1c28-runtime-certification-source-apply-dry-run',
        status: plan.status,
        context: { ...plan.context },
        operation: {
            operationType: 'replace-source-controlled-file',
            targetPath: plan.operation.targetPath,
            contentFormat: plan.operation.contentFormat,
            writeStrategy: 'external-source-control-update',
            expectedMutationCount: 1,
            expectedCurrent: {
                baseCommitSha: plan.operation.expectedCurrent.baseCommitSha,
                sourceBlobSha: plan.operation.expectedCurrent.sourceBlobSha,
                sourceRevision: plan.operation.expectedCurrent.sourceRevision,
                certificationCount: plan.operation.expectedCurrent.certificationCount,
            },
            proposed: {
                sourceRevision: plan.operation.proposed.sourceRevision,
                certificationCount: plan.operation.proposed.certificationCount,
                sourceContent: plan.operation.proposed.sourceContent,
            },
        },
        guards: {
            handoffValidated: true,
            staleStateValidated: true,
            reviewArtifactValidated: true,
            candidateRegistryValidated: true,
            supportedSourceRevisions: [...plan.guards.supportedSourceRevisions],
            runtimeLoaderCompatible: plan.guards.runtimeLoaderCompatible,
            runtimeLoaderMigrationRequired: plan.guards.runtimeLoaderMigrationRequired,
        },
        ...authorityFields({
            sourceReviewApproved: true,
            sourceApplyEligible: plan.guards.runtimeLoaderCompatible,
            runtimeLoaderCompatible: plan.guards.runtimeLoaderCompatible,
            runtimeLoaderMigrationRequired: plan.guards.runtimeLoaderMigrationRequired,
        }),
    });
}

function buildSummary(plan) {
    return Object.freeze({
        modelId: plan.context.modelId,
        backend: plan.context.backend,
        resolution: Object.freeze({
            width: plan.context.width,
            height: plan.context.height,
        }),
        targetPath: plan.operation.targetPath,
        baseCommitSha: plan.operation.expectedCurrent.baseCommitSha,
        sourceBlobSha: plan.operation.expectedCurrent.sourceBlobSha,
        baseSourceRevision: plan.operation.expectedCurrent.sourceRevision,
        proposedSourceRevision: plan.operation.proposed.sourceRevision,
        certificationCountBefore: plan.operation.expectedCurrent.certificationCount,
        certificationCountAfter: plan.operation.proposed.certificationCount,
        supportedSourceRevisions: Object.freeze([...plan.guards.supportedSourceRevisions]),
        handoffValidated: true,
        staleStateValidated: true,
        reviewArtifactValidated: true,
        candidateRegistryValidated: true,
        ...authorityFields({
            sourceReviewApproved: true,
            sourceApplyEligible: plan.guards.runtimeLoaderCompatible,
            runtimeLoaderCompatible: plan.guards.runtimeLoaderCompatible,
            runtimeLoaderMigrationRequired: plan.guards.runtimeLoaderMigrationRequired,
        }),
    });
}

function rejected(reason, target = null) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

export function validateRuntimeCertificationSourceApplyDryRun(plan) {
    if (!plan
        || typeof plan !== 'object'
        || Array.isArray(plan)
        || plan.schemaVersion !== 1
        || plan.planType !== 'p1c28-runtime-certification-source-apply-dry-run'
        || !['guarded-source-apply-ready', 'runtime-loader-migration-required'].includes(plan.status)
        || plan.operation?.operationType !== 'replace-source-controlled-file'
        || typeof plan.operation?.targetPath !== 'string'
        || plan.operation.targetPath.length === 0
        || plan.operation?.contentFormat !== 'utf-8-javascript-module'
        || plan.operation?.writeStrategy !== 'external-source-control-update'
        || plan.operation?.expectedMutationCount !== 1
        || typeof plan.operation?.expectedCurrent?.baseCommitSha !== 'string'
        || !/^[0-9a-f]{40}$/.test(plan.operation.expectedCurrent.baseCommitSha)
        || typeof plan.operation?.expectedCurrent?.sourceBlobSha !== 'string'
        || !/^[0-9a-f]{40}$/.test(plan.operation.expectedCurrent.sourceBlobSha)
        || !Number.isInteger(plan.operation?.expectedCurrent?.sourceRevision)
        || !Number.isInteger(plan.operation?.expectedCurrent?.certificationCount)
        || !Number.isInteger(plan.operation?.proposed?.sourceRevision)
        || plan.operation.proposed.sourceRevision !== plan.operation.expectedCurrent.sourceRevision + 1
        || !Number.isInteger(plan.operation?.proposed?.certificationCount)
        || plan.operation.proposed.certificationCount
            !== plan.operation.expectedCurrent.certificationCount + 1
        || typeof plan.operation?.proposed?.sourceContent !== 'string'
        || plan.operation.proposed.sourceContent.length === 0
        || plan.guards?.handoffValidated !== true
        || plan.guards?.staleStateValidated !== true
        || plan.guards?.reviewArtifactValidated !== true
        || plan.guards?.candidateRegistryValidated !== true
        || !Array.isArray(plan.guards?.supportedSourceRevisions)
        || plan.guards.supportedSourceRevisions.length === 0
        || plan.dryRunOnly !== true
        || plan.sourceReviewApproved !== true
        || plan.guardedApplyRequired !== true
        || plan.sourceMutationApplied !== false
        || plan.runtimeRegistryLoaded !== false
        || plan.authenticityVerified !== false
        || plan.routingEligible !== false
        || plan.cutoverAuthorized !== false
        || plan.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_DRY_RUN_SHAPE_INVALID' });
    }

    const compatible = plan.guards.supportedSourceRevisions.includes(
        plan.operation.proposed.sourceRevision,
    );
    if (plan.guards.runtimeLoaderCompatible !== compatible
        || plan.guards.runtimeLoaderMigrationRequired !== !compatible
        || plan.runtimeLoaderCompatible !== compatible
        || plan.runtimeLoaderMigrationRequired !== !compatible
        || plan.sourceApplyEligible !== compatible
        || plan.status !== (
            compatible
                ? 'guarded-source-apply-ready'
                : 'runtime-loader-migration-required'
        )) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_DRY_RUN_COMPATIBILITY_INVALID' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        runtimeLoaderCompatible: compatible,
        runtimeLoaderMigrationRequired: !compatible,
        sourceApplyEligible: compatible,
        proposedSourceRevision: plan.operation.proposed.sourceRevision,
    });
}

export function createRuntimeCertificationSourceApplyDryRun({
    readHandoff = readRuntimeCertificationSourceCommitHandoff,
    readReviewArtifact = readRuntimeCertificationSourceReviewArtifact,
    readMaterialization = readRuntimeCertificationSourceMaterialization,
    sourceProvider = () => RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
    supportedSourceRevisionsProvider = () => RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS,
    store = dryRuns,
} = {}) {
    if (typeof readHandoff !== 'function') throw new TypeError('source commit handoff reader must be a function');
    if (typeof readReviewArtifact !== 'function') throw new TypeError('source review artifact reader must be a function');
    if (typeof readMaterialization !== 'function') throw new TypeError('source materialization reader must be a function');
    if (typeof sourceProvider !== 'function') throw new TypeError('runtime certification source provider must be a function');
    if (typeof supportedSourceRevisionsProvider !== 'function') {
        throw new TypeError('supported source revisions provider must be a function');
    }
    if (!(store instanceof Map)) throw new TypeError('source apply dry-run store must be a Map');

    const prepare = (target, {
        baseCommitSha,
        sourceBlobSha,
    } = {}) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        let currentSource;
        try {
            currentSource = sourceProvider();
        } catch {
            return rejected('SOURCE_APPLY_CURRENT_SOURCE_READ_FAILED', normalizedTarget);
        }

        const currentSourceValidation = validateRuntimeCertificationSource(currentSource);
        if (!currentSourceValidation.ok) {
            return rejected('SOURCE_APPLY_CURRENT_SOURCE_INVALID', normalizedTarget);
        }

        let handoff;
        let reviewArtifact;
        let materialization;
        try {
            handoff = readHandoff(normalizedTarget);
            reviewArtifact = readReviewArtifact(normalizedTarget);
            materialization = readMaterialization(normalizedTarget);
        } catch {
            return rejected('SOURCE_APPLY_ARTIFACT_READ_FAILED', normalizedTarget);
        }

        if (!handoff) return rejected('SOURCE_APPLY_HANDOFF_MISSING', normalizedTarget);
        if (!reviewArtifact) return rejected('SOURCE_APPLY_REVIEW_ARTIFACT_MISSING', normalizedTarget);
        if (!materialization) return rejected('SOURCE_APPLY_MATERIALIZATION_MISSING', normalizedTarget);

        const handoffValidation = validateRuntimeCertificationSourceCommitHandoff(handoff);
        if (!handoffValidation.ok) {
            return rejected('SOURCE_APPLY_HANDOFF_INVALID', normalizedTarget);
        }

        const reviewValidation = validateRuntimeCertificationSourceReviewArtifact(
            reviewArtifact,
            materialization,
        );
        if (!reviewValidation.ok) {
            return rejected('SOURCE_APPLY_REVIEW_ARTIFACT_INVALID', normalizedTarget);
        }

        if (handoff.context.modelId !== normalizedTarget.modelId
            || handoff.context.backend !== normalizedTarget.backend
            || handoff.context.width !== normalizedTarget.width
            || handoff.context.height !== normalizedTarget.height
            || reviewArtifact.context.modelId !== normalizedTarget.modelId
            || reviewArtifact.context.backend !== normalizedTarget.backend
            || reviewArtifact.context.width !== normalizedTarget.width
            || reviewArtifact.context.height !== normalizedTarget.height) {
            return rejected('SOURCE_APPLY_CONTEXT_MISMATCH', normalizedTarget);
        }

        if (handoff.proposal.sourceContent !== reviewArtifact.sourceContent
            || handoff.proposal.proposedSourceRevision !== reviewArtifact.proposedSourceRevision
            || handoff.proposal.proposedCertificationCount !== reviewArtifact.certificationCountAfter) {
            return rejected('SOURCE_APPLY_HANDOFF_REVIEW_MISMATCH', normalizedTarget);
        }

        const staleValidation = validateRuntimeCertificationSourceCommitHandoffAgainstState(
            handoff,
            {
                baseCommitSha,
                sourceBlobSha,
                sourceRevision: currentSource.sourceRevision,
                certificationCount: currentSource.certifications.length,
            },
        );
        if (!staleValidation.ok) {
            return rejected(staleValidation.reason, normalizedTarget);
        }

        let supportedSourceRevisions;
        try {
            supportedSourceRevisions = normalizeSupportedRevisions(
                supportedSourceRevisionsProvider(),
            );
        } catch {
            supportedSourceRevisions = null;
        }
        if (!supportedSourceRevisions) {
            return rejected('SOURCE_APPLY_LOADER_CAPABILITY_INVALID', normalizedTarget);
        }

        const runtimeLoaderCompatible = supportedSourceRevisions.includes(
            handoff.proposal.proposedSourceRevision,
        );
        const runtimeLoaderMigrationRequired = !runtimeLoaderCompatible;

        const plan = deepFreeze({
            schemaVersion: 1,
            planType: 'p1c28-runtime-certification-source-apply-dry-run',
            status: runtimeLoaderCompatible
                ? 'guarded-source-apply-ready'
                : 'runtime-loader-migration-required',
            context: { ...normalizedTarget },
            operation: {
                operationType: 'replace-source-controlled-file',
                targetPath: handoff.targetPath,
                contentFormat: handoff.contentFormat,
                writeStrategy: 'external-source-control-update',
                expectedMutationCount: 1,
                expectedCurrent: {
                    baseCommitSha,
                    sourceBlobSha,
                    sourceRevision: currentSource.sourceRevision,
                    certificationCount: currentSource.certifications.length,
                },
                proposed: {
                    sourceRevision: handoff.proposal.proposedSourceRevision,
                    certificationCount: handoff.proposal.proposedCertificationCount,
                    sourceContent: handoff.proposal.sourceContent,
                },
            },
            guards: {
                handoffValidated: true,
                staleStateValidated: true,
                reviewArtifactValidated: true,
                candidateRegistryValidated: true,
                supportedSourceRevisions,
                runtimeLoaderCompatible,
                runtimeLoaderMigrationRequired,
            },
            ...authorityFields({
                sourceReviewApproved: true,
                sourceApplyEligible: runtimeLoaderCompatible,
                runtimeLoaderCompatible,
                runtimeLoaderMigrationRequired,
            }),
        });

        const validation = validateRuntimeCertificationSourceApplyDryRun(plan);
        if (!validation.ok) return rejected(validation.reason, normalizedTarget);

        const detached = cloneDryRun(plan);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: runtimeLoaderCompatible
                ? RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS.READY
                : RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS.BLOCKED,
            reason: runtimeLoaderCompatible ? null : 'SOURCE_APPLY_RUNTIME_LOADER_MIGRATION_REQUIRED',
            context: normalizedTarget,
            summary: buildSummary(detached),
            ...authorityFields({
                sourceReviewApproved: true,
                sourceApplyEligible: runtimeLoaderCompatible,
                runtimeLoaderCompatible,
                runtimeLoaderMigrationRequired,
            }),
        });
    };

    const getSummary = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;
        const plan = store.get(targetKey(normalizedTarget));
        if (!plan) return empty(normalizedTarget);

        const compatible = plan.guards.runtimeLoaderCompatible;
        return Object.freeze({
            status: compatible
                ? RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS.READY
                : RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_STATUS.BLOCKED,
            reason: compatible ? null : 'SOURCE_APPLY_RUNTIME_LOADER_MIGRATION_REQUIRED',
            context: normalizedTarget,
            summary: buildSummary(plan),
            ...authorityFields({
                sourceReviewApproved: true,
                sourceApplyEligible: compatible,
                runtimeLoaderCompatible: compatible,
                runtimeLoaderMigrationRequired: !compatible,
            }),
        });
    };

    const readDryRun = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const plan = store.get(targetKey(targetValidation.target));
        return plan ? cloneDryRun(plan) : null;
    };

    return Object.freeze({
        prepare,
        getSummary,
        readDryRun,
        ...authorityFields(),
    });
}

const defaultDryRun = createRuntimeCertificationSourceApplyDryRun();

export function prepareRuntimeCertificationSourceApplyDryRun(target, options) {
    return defaultDryRun.prepare(target, options);
}

export function getRuntimeCertificationSourceApplyDryRunSummary(target) {
    return defaultDryRun.getSummary(target);
}

export function readRuntimeCertificationSourceApplyDryRun(target) {
    return defaultDryRun.readDryRun(target);
}

export {
    authorityFields,
    buildSummary,
    cloneDryRun,
    deepFreeze,
    normalizeSupportedRevisions,
    targetKey,
};
