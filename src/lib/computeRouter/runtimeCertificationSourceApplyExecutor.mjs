import {
    readRuntimeCertificationSourceApplyDryRun,
    validateRuntimeCertificationSourceApplyDryRun,
} from './runtimeCertificationSourceApplyDryRun.mjs';
import {
    readRuntimeCertificationEvidenceProvenanceAttestation,
    validateRuntimeCertificationEvidenceProvenanceAttestation,
} from './runtimeCertificationEvidenceProvenance.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_STATUS = Object.freeze({
    UNAVAILABLE: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_UNAVAILABLE',
    REJECTED: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_REJECTED',
    INDETERMINATE: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_INDETERMINATE',
    EXECUTED: 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_EXECUTED',
});

const SHA40 = /^[0-9a-f]{40}$/;
const executionAttempts = new Map();

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }

    return Object.freeze(value);
}

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateSha40(value) {
    return typeof value === 'string' && SHA40.test(value);
}

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function executionKey(plan) {
    return [
        targetKey(plan.context),
        plan.operation.expectedCurrent.baseCommitSha,
        plan.operation.expectedCurrent.sourceBlobSha,
        plan.operation.proposed.sourceRevision,
        plan.operation.proposed.certificationCount,
    ].join('::');
}

function authorityFields({
    sourceApplyApproved = false,
    realEvidenceProvenanceVerified = false,
    finalStateValidated = false,
    externalWriterInvoked = false,
    externalMutationReported = false,
    retryAllowed = true,
} = {}) {
    return Object.freeze({
        executorContractOnly: true,
        sourceApplyApproved,
        realEvidenceProvenanceVerified,
        finalStateValidated,
        externalWriterInvoked,
        externalMutationReported,
        retryAllowed,
        sourceMutationAppliedByModule: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        sourceControlAuthority: 'external-injected-writer-only',
    });
}

function unavailable(reason, target = null) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_STATUS.UNAVAILABLE,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        receipt: null,
        ...authorityFields(),
    });
}

function rejected(reason, target = null, extras = {}) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        receipt: null,
        ...authorityFields(extras),
    });
}

function indeterminate(reason, target, extras = {}) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_STATUS.INDETERMINATE,
        reason,
        context: Object.freeze({ ...target }),
        receipt: null,
        ...authorityFields({
            sourceApplyApproved: true,
            realEvidenceProvenanceVerified: true,
            finalStateValidated: true,
            externalWriterInvoked: true,
            externalMutationReported: false,
            retryAllowed: false,
            ...extras,
        }),
    });
}

function validateApplyApproval(approval) {
    if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_APPROVAL_REQUIRED' });
    }

    const operatorId = normalizeText(approval.operatorId);
    const operatorDisplayName = normalizeText(approval.operatorDisplayName);
    const approvalNote = normalizeText(approval.approvalNote);
    const approvedAt = normalizeText(approval.approvedAt);

    if (approval.sourceApplyApproved !== true) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_NOT_APPROVED' });
    }
    if (!operatorId) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_OPERATOR_ID_REQUIRED' });
    }
    if (!operatorDisplayName) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_OPERATOR_NAME_REQUIRED' });
    }
    if (!approvalNote) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_APPROVAL_NOTE_REQUIRED' });
    }
    if (!approvedAt || Number.isNaN(Date.parse(approvedAt))) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_APPROVED_AT_INVALID' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        approval: deepFreeze({
            sourceApplyApproved: true,
            operatorId,
            operatorDisplayName,
            approvalNote,
            approvedAt,
            operatorIdentityVerified: false,
        }),
    });
}

export function validateRuntimeCertificationSourceApplyFinalState(plan, currentState) {
    const planValidation = validateRuntimeCertificationSourceApplyDryRun(plan);
    if (!planValidation.ok
        || plan.status !== 'guarded-source-apply-ready'
        || plan.sourceApplyEligible !== true
        || plan.runtimeLoaderCompatible !== true
        || plan.runtimeLoaderMigrationRequired !== false) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_EXECUTOR_PLAN_NOT_READY' });
    }

    if (!currentState
        || typeof currentState !== 'object'
        || Array.isArray(currentState)
        || !validateSha40(currentState.baseCommitSha)
        || !validateSha40(currentState.sourceBlobSha)
        || !Number.isInteger(currentState.sourceRevision)
        || currentState.sourceRevision < 1
        || !Number.isInteger(currentState.certificationCount)
        || currentState.certificationCount < 0) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_FINAL_STATE_INVALID' });
    }

    const expected = plan.operation.expectedCurrent;
    if (currentState.baseCommitSha !== expected.baseCommitSha) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_FINAL_BASE_COMMIT_STALE' });
    }
    if (currentState.sourceBlobSha !== expected.sourceBlobSha) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_FINAL_SOURCE_BLOB_STALE' });
    }
    if (currentState.sourceRevision !== expected.sourceRevision) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_FINAL_SOURCE_REVISION_STALE' });
    }
    if (currentState.certificationCount !== expected.certificationCount) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_FINAL_CERTIFICATION_COUNT_STALE' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        finalStateValidated: true,
    });
}

function buildExternalWriteRequest(plan, approval, provenanceAttestation) {
    return deepFreeze({
        schemaVersion: 1,
        requestType: 'p1c30-external-source-control-update-request',
        operationType: 'replace-source-controlled-file',
        targetPath: plan.operation.targetPath,
        contentFormat: plan.operation.contentFormat,
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
        approval: {
            sourceApplyApproved: true,
            operatorId: approval.operatorId,
            operatorDisplayName: approval.operatorDisplayName,
            approvalNote: approval.approvalNote,
            approvedAt: approval.approvedAt,
            operatorIdentityVerified: false,
        },
        provenance: {
            attestationType: provenanceAttestation.attestationType,
            status: provenanceAttestation.status,
            origin: provenanceAttestation.acquisition.origin,
            evidenceClass: provenanceAttestation.acquisition.evidenceClass,
            runCount: provenanceAttestation.acquisition.runCount,
            runIndexes: [...provenanceAttestation.acquisition.runIndexes],
            realEvidenceProvenanceVerified: true,
            cryptographicAuthenticityVerified: false,
            baseCommitSha: provenanceAttestation.planBinding.baseCommitSha,
            sourceBlobSha: provenanceAttestation.planBinding.sourceBlobSha,
            proposedSourceRevision: provenanceAttestation.planBinding.proposedSourceRevision,
            proposedCertificationCount: provenanceAttestation.planBinding.proposedCertificationCount,
        },
        sourceMutationAppliedByModule: false,
        runtimeRegistryLoaded: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        sourceControlAuthority: 'external-injected-writer-only',
    });
}

export function validateExternalSourceApplyReceipt(receipt, request) {
    if (!receipt
        || typeof receipt !== 'object'
        || Array.isArray(receipt)
        || receipt.applied !== true
        || receipt.mutationCount !== 1
        || receipt.targetPath !== request.targetPath
        || receipt.previousBaseCommitSha !== request.expectedCurrent.baseCommitSha
        || receipt.previousSourceBlobSha !== request.expectedCurrent.sourceBlobSha
        || !validateSha40(receipt.newCommitSha)
        || !validateSha40(receipt.newSourceBlobSha)
        || receipt.sourceRevision !== request.proposed.sourceRevision
        || receipt.certificationCount !== request.proposed.certificationCount) {
        return Object.freeze({ ok: false, reason: 'SOURCE_APPLY_EXTERNAL_RECEIPT_INVALID' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        newCommitSha: receipt.newCommitSha,
        newSourceBlobSha: receipt.newSourceBlobSha,
        sourceRevision: receipt.sourceRevision,
        certificationCount: receipt.certificationCount,
    });
}

function buildReceiptSummary(target, request, receipt) {
    return Object.freeze({
        modelId: target.modelId,
        backend: target.backend,
        resolution: Object.freeze({
            width: target.width,
            height: target.height,
        }),
        targetPath: request.targetPath,
        previousBaseCommitSha: receipt.previousBaseCommitSha,
        previousSourceBlobSha: receipt.previousSourceBlobSha,
        newCommitSha: receipt.newCommitSha,
        newSourceBlobSha: receipt.newSourceBlobSha,
        sourceRevision: receipt.sourceRevision,
        certificationCount: receipt.certificationCount,
        mutationCount: receipt.mutationCount,
        operatorIdentityVerified: false,
        ...authorityFields({
            sourceApplyApproved: true,
            finalStateValidated: true,
            externalWriterInvoked: true,
            externalMutationReported: true,
            retryAllowed: false,
        }),
    });
}

export function createRuntimeCertificationSourceApplyExecutor({
    readDryRun = readRuntimeCertificationSourceApplyDryRun,
    readProvenanceAttestation = readRuntimeCertificationEvidenceProvenanceAttestation,
    readCurrentState = null,
    applySourceUpdate = null,
    attempts = executionAttempts,
} = {}) {
    if (typeof readDryRun !== 'function') {
        throw new TypeError('source apply dry-run reader must be a function');
    }
    if (typeof readProvenanceAttestation !== 'function') {
        throw new TypeError('real evidence provenance reader must be a function');
    }
    if (readCurrentState !== null && typeof readCurrentState !== 'function') {
        throw new TypeError('current source state reader must be a function or null');
    }
    if (applySourceUpdate !== null && typeof applySourceUpdate !== 'function') {
        throw new TypeError('external source update writer must be a function or null');
    }
    if (!(attempts instanceof Map)) {
        throw new TypeError('source apply execution attempt store must be a Map');
    }

    const execute = async (target, { approval } = {}) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        if (!readCurrentState) {
            return unavailable('SOURCE_APPLY_FINAL_STATE_READER_UNAVAILABLE', normalizedTarget);
        }
        if (!applySourceUpdate) {
            return unavailable('SOURCE_APPLY_EXTERNAL_WRITER_UNAVAILABLE', normalizedTarget);
        }

        let plan;
        try {
            plan = readDryRun(normalizedTarget);
        } catch {
            return rejected('SOURCE_APPLY_DRY_RUN_READ_FAILED', normalizedTarget);
        }
        if (!plan) {
            return rejected('SOURCE_APPLY_DRY_RUN_MISSING', normalizedTarget);
        }

        const planValidation = validateRuntimeCertificationSourceApplyDryRun(plan);
        if (!planValidation.ok
            || plan.status !== 'guarded-source-apply-ready'
            || plan.sourceApplyEligible !== true) {
            return rejected('SOURCE_APPLY_EXECUTOR_PLAN_NOT_READY', normalizedTarget);
        }

        if (plan.context.modelId !== normalizedTarget.modelId
            || plan.context.backend !== normalizedTarget.backend
            || plan.context.width !== normalizedTarget.width
            || plan.context.height !== normalizedTarget.height) {
            return rejected('SOURCE_APPLY_EXECUTOR_CONTEXT_MISMATCH', normalizedTarget);
        }

        let provenanceAttestation;
        try {
            provenanceAttestation = readProvenanceAttestation(normalizedTarget);
        } catch {
            return rejected('SOURCE_APPLY_REAL_EVIDENCE_PROVENANCE_READ_FAILED', normalizedTarget);
        }
        if (!provenanceAttestation) {
            return rejected('SOURCE_APPLY_REAL_EVIDENCE_PROVENANCE_MISSING', normalizedTarget);
        }

        const provenanceValidation = validateRuntimeCertificationEvidenceProvenanceAttestation(
            provenanceAttestation,
        );
        if (!provenanceValidation.ok
            || provenanceAttestation.context.modelId !== normalizedTarget.modelId
            || provenanceAttestation.context.backend !== normalizedTarget.backend
            || provenanceAttestation.context.resolution?.width !== normalizedTarget.width
            || provenanceAttestation.context.resolution?.height !== normalizedTarget.height
            || provenanceAttestation.planBinding.baseCommitSha
                !== plan.operation.expectedCurrent.baseCommitSha
            || provenanceAttestation.planBinding.sourceBlobSha
                !== plan.operation.expectedCurrent.sourceBlobSha
            || provenanceAttestation.planBinding.baseSourceRevision
                !== plan.operation.expectedCurrent.sourceRevision
            || provenanceAttestation.planBinding.baseCertificationCount
                !== plan.operation.expectedCurrent.certificationCount
            || provenanceAttestation.planBinding.proposedSourceRevision
                !== plan.operation.proposed.sourceRevision
            || provenanceAttestation.planBinding.proposedCertificationCount
                !== plan.operation.proposed.certificationCount) {
            return rejected('SOURCE_APPLY_REAL_EVIDENCE_PROVENANCE_INVALID', normalizedTarget);
        }

        const approvalValidation = validateApplyApproval(approval);
        if (!approvalValidation.ok) {
            return rejected(approvalValidation.reason, normalizedTarget);
        }

        const key = executionKey(plan);
        if (attempts.has(key)) {
            return rejected(
                'SOURCE_APPLY_EXECUTION_ALREADY_ATTEMPTED',
                normalizedTarget,
                {
                    sourceApplyApproved: true,
                    retryAllowed: false,
                },
            );
        }

        let currentState;
        try {
            currentState = await readCurrentState({
                target: normalizedTarget,
                targetPath: plan.operation.targetPath,
            });
        } catch {
            return rejected(
                'SOURCE_APPLY_FINAL_STATE_READ_FAILED',
                normalizedTarget,
                { sourceApplyApproved: true },
            );
        }

        const finalStateValidation = validateRuntimeCertificationSourceApplyFinalState(
            plan,
            currentState,
        );
        if (!finalStateValidation.ok) {
            return rejected(
                finalStateValidation.reason,
                normalizedTarget,
                { sourceApplyApproved: true },
            );
        }

        const request = buildExternalWriteRequest(
            plan,
            approvalValidation.approval,
            provenanceAttestation,
        );

        // Mark the attempt before invoking the external writer. If the writer fails
        // or returns an invalid receipt, automatic retry is forbidden because the
        // external mutation outcome may be unknown.
        attempts.set(key, deepFreeze({
            status: 'writer-invocation-started',
            target: { ...normalizedTarget },
            targetPath: request.targetPath,
        }));

        let externalReceipt;
        try {
            externalReceipt = await applySourceUpdate(request);
        } catch {
            attempts.set(key, deepFreeze({
                status: 'writer-outcome-indeterminate',
                target: { ...normalizedTarget },
                targetPath: request.targetPath,
            }));
            return indeterminate(
                'SOURCE_APPLY_EXTERNAL_WRITER_THROWN',
                normalizedTarget,
            );
        }

        const receiptValidation = validateExternalSourceApplyReceipt(
            externalReceipt,
            request,
        );
        if (!receiptValidation.ok) {
            attempts.set(key, deepFreeze({
                status: 'writer-outcome-indeterminate',
                target: { ...normalizedTarget },
                targetPath: request.targetPath,
            }));
            return indeterminate(
                receiptValidation.reason,
                normalizedTarget,
            );
        }

        const summary = buildReceiptSummary(
            normalizedTarget,
            request,
            externalReceipt,
        );
        attempts.set(key, deepFreeze({
            status: 'external-update-receipt-accepted',
            target: { ...normalizedTarget },
            targetPath: request.targetPath,
            receipt: {
                newCommitSha: externalReceipt.newCommitSha,
                newSourceBlobSha: externalReceipt.newSourceBlobSha,
                sourceRevision: externalReceipt.sourceRevision,
                certificationCount: externalReceipt.certificationCount,
            },
        }));

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_STATUS.EXECUTED,
            reason: null,
            context: normalizedTarget,
            receipt: summary,
            ...authorityFields({
                sourceApplyApproved: true,
                realEvidenceProvenanceVerified: true,
                finalStateValidated: true,
                externalWriterInvoked: true,
                externalMutationReported: true,
                retryAllowed: false,
            }),
        });
    };

    const getAttempt = (target, plan = null) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;

        const resolvedPlan = plan || readDryRun(targetValidation.target);
        if (!resolvedPlan) return null;

        const attempt = attempts.get(executionKey(resolvedPlan));
        return attempt ? deepFreeze({
            ...attempt,
            target: attempt.target ? { ...attempt.target } : null,
            receipt: attempt.receipt ? { ...attempt.receipt } : undefined,
        }) : null;
    };

    return Object.freeze({
        execute,
        getAttempt,
        writerConfigured: Boolean(applySourceUpdate),
        finalStateReaderConfigured: Boolean(readCurrentState),
        ...authorityFields(),
    });
}

const defaultExecutor = createRuntimeCertificationSourceApplyExecutor();

export async function executeRuntimeCertificationSourceApply(target, options) {
    return defaultExecutor.execute(target, options);
}

export function getRuntimeCertificationSourceApplyAttempt(target, plan) {
    return defaultExecutor.getAttempt(target, plan);
}

export {
    SHA40,
    authorityFields,
    buildExternalWriteRequest,
    buildReceiptSummary,
    deepFreeze,
    executionKey,
    normalizeText,
    targetKey,
    validateApplyApproval,
    validateSha40,
};
