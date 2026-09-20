import {
    readUserBenchmarkSessionProvenance,
    validateTarget,
} from './userBenchmarkSession.mjs';
import {
    readRuntimeCertificationPromotionPackage,
    validatePromotionPackage,
} from './runtimeCertificationPromotion.mjs';
import {
    readRuntimeCertificationSourceApplyDryRun,
    validateRuntimeCertificationSourceApplyDryRun,
} from './runtimeCertificationSourceApplyDryRun.mjs';
import { stableNormalize } from './runtimeCertificationSourceReview.mjs';

export const RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_STATUS = Object.freeze({
    EMPTY: 'RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_EMPTY',
    VERIFIED: 'RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_VERIFIED',
    REJECTED: 'RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_REJECTED',
});

const attestations = new Map();
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SHA40_PATTERN = /^[a-f0-9]{40}$/;

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

function authorityFields({ provenanceVerified = false } = {}) {
    return Object.freeze({
        provenanceGateOnly: true,
        realEvidenceProvenanceVerified: provenanceVerified,
        trustedMainProcessAcquisition: provenanceVerified,
        cryptographicAuthenticityVerified: false,
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
        status: RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

function sameAuxiliaryArtifacts(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    const normalize = (items) => [...items]
        .map((item) => ({ role: item.role, sha256: item.sha256 }))
        .sort((a, b) => a.role.localeCompare(b.role));
    const a = normalize(left);
    const b = normalize(right);
    return a.every((item, index) => (
        item.role === b[index].role && item.sha256 === b[index].sha256
    ));
}

export function validateRealBenchmarkAcquisitionProof(proof) {
    if (!proof
        || typeof proof !== 'object'
        || Array.isArray(proof)
        || proof.schemaVersion !== 1
        || proof.proofType !== 'p1c31-real-benchmark-acquisition-proof'
        || proof.origin !== 'electron-main-controlled-benchmark'
        || proof.evidenceClass !== 'real-runtime-measurement'
        || proof.trustedMainProcess !== true
        || proof.runtimeIntegrityVerified !== true
        || proof.runtimeManifestPinned !== true
        || proof.modelStateResolved !== true
        || proof.buildIdentityResolved !== true
        || proof.benchmarkProcessExecuted !== true
        || proof.fixture !== false
        || proof.synthetic !== false
        || proof.demo !== false
        || proof.cryptographicAuthenticityVerified !== false
        || proof.routingEligible !== false
        || proof.cutoverAuthorized !== false
        || proof.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'REAL_EVIDENCE_PROVENANCE_PROOF_INVALID' });
    }

    const context = proof.context;
    const benchmark = proof.benchmarkContext;
    if (!context
        || typeof context.modelId !== 'string'
        || !context.modelId.trim()
        || !['cpu', 'cuda12'].includes(context.backend)
        || !Number.isInteger(context.resolution?.width)
        || context.resolution.width <= 0
        || !Number.isInteger(context.resolution?.height)
        || context.resolution.height <= 0
        || !Number.isInteger(context.runIndex)
        || context.runIndex < 1
        || context.runIndex > 3
        || !benchmark
        || typeof benchmark.harnessVersion !== 'string'
        || !benchmark.harnessVersion.trim()
        || typeof benchmark.sourceCommit !== 'string'
        || !SHA40_PATTERN.test(benchmark.sourceCommit)
        || typeof benchmark.runtimeIdentity !== 'string'
        || !benchmark.runtimeIdentity.trim()
        || typeof benchmark.runtimeVersion !== 'string'
        || !benchmark.runtimeVersion.trim()
        || typeof benchmark.runtimeBinarySha256 !== 'string'
        || !SHA256_PATTERN.test(benchmark.runtimeBinarySha256)
        || typeof benchmark.modelArtifactSha256 !== 'string'
        || !SHA256_PATTERN.test(benchmark.modelArtifactSha256)
        || !Array.isArray(benchmark.auxiliaryArtifacts)
        || benchmark.auxiliaryArtifacts.some((artifact) => (
            !artifact
            || typeof artifact.role !== 'string'
            || !artifact.role.trim()
            || typeof artifact.sha256 !== 'string'
            || !SHA256_PATTERN.test(artifact.sha256)
        ))) {
        return Object.freeze({ ok: false, reason: 'REAL_EVIDENCE_PROVENANCE_CONTEXT_INVALID' });
    }

    return Object.freeze({ ok: true, reason: null });
}

function sameBenchmarkContext(left, right) {
    return left.harnessVersion === right.harnessVersion
        && left.sourceCommit === right.sourceCommit
        && left.runtimeIdentity === right.runtimeIdentity
        && left.runtimeVersion === right.runtimeVersion
        && left.runtimeBinarySha256 === right.runtimeBinarySha256
        && left.modelArtifactSha256 === right.modelArtifactSha256
        && sameAuxiliaryArtifacts(left.auxiliaryArtifacts, right.auxiliaryArtifacts);
}

function cloneAttestation(attestation) {
    return deepFreeze({
        schemaVersion: 1,
        attestationType: 'p1c31-real-evidence-provenance-attestation',
        status: 'real-evidence-provenance-verified',
        context: {
            ...attestation.context,
            resolution: { ...attestation.context.resolution },
        },
        acquisition: {
            origin: attestation.acquisition.origin,
            evidenceClass: attestation.acquisition.evidenceClass,
            runCount: attestation.acquisition.runCount,
            runIndexes: [...attestation.acquisition.runIndexes],
            trustedMainProcess: true,
            runtimeIntegrityVerified: true,
            runtimeManifestPinned: true,
            modelStateResolved: true,
            buildIdentityResolved: true,
            benchmarkProcessExecuted: true,
            fixture: false,
            synthetic: false,
            demo: false,
        },
        benchmarkContext: {
            ...attestation.benchmarkContext,
            auxiliaryArtifacts: attestation.benchmarkContext.auxiliaryArtifacts.map((item) => ({ ...item })),
        },
        bindings: {
            promotionPackageValidated: true,
            certificationEntryBound: true,
            sourceApplyPlanValidated: true,
            sourceApplyPlanBound: true,
        },
        ...authorityFields({ provenanceVerified: true }),
    });
}

export function validateRuntimeCertificationEvidenceProvenanceAttestation(attestation) {
    if (!attestation
        || typeof attestation !== 'object'
        || Array.isArray(attestation)
        || attestation.schemaVersion !== 1
        || attestation.attestationType !== 'p1c31-real-evidence-provenance-attestation'
        || attestation.status !== 'real-evidence-provenance-verified'
        || attestation.acquisition?.origin !== 'electron-main-controlled-benchmark'
        || attestation.acquisition?.evidenceClass !== 'real-runtime-measurement'
        || attestation.acquisition?.runCount !== 3
        || !Array.isArray(attestation.acquisition?.runIndexes)
        || attestation.acquisition.runIndexes.length !== 3
        || attestation.acquisition.runIndexes.join(',') !== '1,2,3'
        || attestation.acquisition?.trustedMainProcess !== true
        || attestation.acquisition?.runtimeIntegrityVerified !== true
        || attestation.acquisition?.runtimeManifestPinned !== true
        || attestation.acquisition?.modelStateResolved !== true
        || attestation.acquisition?.buildIdentityResolved !== true
        || attestation.acquisition?.benchmarkProcessExecuted !== true
        || attestation.acquisition?.fixture !== false
        || attestation.acquisition?.synthetic !== false
        || attestation.acquisition?.demo !== false
        || attestation.bindings?.promotionPackageValidated !== true
        || attestation.bindings?.certificationEntryBound !== true
        || attestation.bindings?.sourceApplyPlanValidated !== true
        || attestation.bindings?.sourceApplyPlanBound !== true
        || attestation.provenanceGateOnly !== true
        || attestation.realEvidenceProvenanceVerified !== true
        || attestation.trustedMainProcessAcquisition !== true
        || attestation.cryptographicAuthenticityVerified !== false
        || attestation.sourceMutationApplied !== false
        || attestation.runtimeRegistryLoaded !== false
        || attestation.authenticityVerified !== false
        || attestation.routingEligible !== false
        || attestation.cutoverAuthorized !== false
        || attestation.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'REAL_EVIDENCE_PROVENANCE_ATTESTATION_INVALID' });
    }
    return Object.freeze({ ok: true, reason: null });
}

function buildSummary(attestation) {
    return Object.freeze({
        modelId: attestation.context.modelId,
        backend: attestation.context.backend,
        resolution: Object.freeze({ ...attestation.context.resolution }),
        runCount: 3,
        runIndexes: Object.freeze([1, 2, 3]),
        origin: attestation.acquisition.origin,
        evidenceClass: attestation.acquisition.evidenceClass,
        trustedMainProcessAcquisition: true,
        runtimeIntegrityVerified: true,
        runtimeManifestPinned: true,
        modelStateResolved: true,
        buildIdentityResolved: true,
        benchmarkProcessExecuted: true,
        fixture: false,
        synthetic: false,
        demo: false,
        promotionPackageValidated: true,
        certificationEntryBound: true,
        sourceApplyPlanValidated: true,
        sourceApplyPlanBound: true,
        ...authorityFields({ provenanceVerified: true }),
    });
}

export function createRuntimeCertificationEvidenceProvenanceGate({
    readProvenance = readUserBenchmarkSessionProvenance,
    readPromotionPackage = readRuntimeCertificationPromotionPackage,
    readDryRun = readRuntimeCertificationSourceApplyDryRun,
    store = attestations,
} = {}) {
    if (typeof readProvenance !== 'function') throw new TypeError('benchmark provenance reader must be a function');
    if (typeof readPromotionPackage !== 'function') throw new TypeError('promotion package reader must be a function');
    if (typeof readDryRun !== 'function') throw new TypeError('source apply dry-run reader must be a function');
    if (!(store instanceof Map)) throw new TypeError('provenance attestation store must be a Map');

    const verify = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        let proofs;
        let promotion;
        let plan;
        try {
            proofs = readProvenance(normalizedTarget);
            promotion = readPromotionPackage(normalizedTarget);
            plan = readDryRun(normalizedTarget);
        } catch {
            return rejected('REAL_EVIDENCE_PROVENANCE_READ_FAILED', normalizedTarget);
        }

        if (!Array.isArray(proofs) || proofs.length !== 3) {
            return rejected('REAL_EVIDENCE_PROVENANCE_RUN_COUNT_INVALID', normalizedTarget);
        }
        if (!promotion) return rejected('REAL_EVIDENCE_PROVENANCE_PROMOTION_MISSING', normalizedTarget);
        if (!plan) return rejected('REAL_EVIDENCE_PROVENANCE_APPLY_PLAN_MISSING', normalizedTarget);

        for (const proof of proofs) {
            const validation = validateRealBenchmarkAcquisitionProof(proof);
            if (!validation.ok) return rejected(validation.reason, normalizedTarget);
            if (proof.context.modelId !== normalizedTarget.modelId
                || proof.context.backend !== normalizedTarget.backend
                || proof.context.resolution.width !== normalizedTarget.width
                || proof.context.resolution.height !== normalizedTarget.height) {
                return rejected('REAL_EVIDENCE_PROVENANCE_TARGET_MISMATCH', normalizedTarget);
            }
        }

        const sorted = [...proofs].sort((a, b) => a.context.runIndex - b.context.runIndex);
        if (sorted.map((proof) => proof.context.runIndex).join(',') !== '1,2,3') {
            return rejected('REAL_EVIDENCE_PROVENANCE_RUN_INDEX_INVALID', normalizedTarget);
        }

        const firstContext = sorted[0].benchmarkContext;
        if (sorted.some((proof) => !sameBenchmarkContext(firstContext, proof.benchmarkContext))) {
            return rejected('REAL_EVIDENCE_PROVENANCE_CONTEXT_DRIFT', normalizedTarget);
        }

        const promotionValidation = validatePromotionPackage(promotion);
        if (!promotionValidation.ok) {
            return rejected('REAL_EVIDENCE_PROVENANCE_PROMOTION_INVALID', normalizedTarget);
        }
        if (promotion.context.modelId !== normalizedTarget.modelId
            || promotion.context.backend !== normalizedTarget.backend
            || promotion.context.width !== normalizedTarget.width
            || promotion.context.height !== normalizedTarget.height) {
            return rejected('REAL_EVIDENCE_PROVENANCE_PROMOTION_CONTEXT_MISMATCH', normalizedTarget);
        }

        const profile = promotion.certificationEntry.certifiedProfile;
        const record = promotion.certificationEntry.certificationRecord;
        if (profile.evidence?.method !== 'controlled-benchmark'
            || profile.evidence.sampleCount !== 3
            || profile.evidence.harnessVersion !== firstContext.harnessVersion
            || profile.evidence.sourceCommit !== firstContext.sourceCommit
            || record.session?.runCount !== 3
            || !Array.isArray(record.session.runIndexes)
            || [...record.session.runIndexes].sort((a, b) => a - b).join(',') !== '1,2,3'
            || !sameAuxiliaryArtifacts(record.session.auxiliaryArtifacts, firstContext.auxiliaryArtifacts)) {
            return rejected('REAL_EVIDENCE_PROVENANCE_CERTIFICATION_BINDING_MISMATCH', normalizedTarget);
        }

        const planValidation = validateRuntimeCertificationSourceApplyDryRun(plan);
        if (!planValidation.ok
            || plan.status !== 'guarded-source-apply-ready'
            || plan.sourceApplyEligible !== true
            || plan.context.modelId !== normalizedTarget.modelId
            || plan.context.backend !== normalizedTarget.backend
            || plan.context.width !== normalizedTarget.width
            || plan.context.height !== normalizedTarget.height) {
            return rejected('REAL_EVIDENCE_PROVENANCE_APPLY_PLAN_INVALID', normalizedTarget);
        }

        const stableEntry = JSON.stringify(
            stableNormalize(promotion.certificationEntry),
            null,
            4,
        );
        if (!plan.operation.proposed.sourceContent.includes(stableEntry)) {
            return rejected('REAL_EVIDENCE_PROVENANCE_SOURCE_BINDING_MISMATCH', normalizedTarget);
        }

        const attestation = deepFreeze({
            schemaVersion: 1,
            attestationType: 'p1c31-real-evidence-provenance-attestation',
            status: 'real-evidence-provenance-verified',
            context: {
                modelId: normalizedTarget.modelId,
                backend: normalizedTarget.backend,
                resolution: {
                    width: normalizedTarget.width,
                    height: normalizedTarget.height,
                },
            },
            acquisition: {
                origin: 'electron-main-controlled-benchmark',
                evidenceClass: 'real-runtime-measurement',
                runCount: 3,
                runIndexes: [1, 2, 3],
                trustedMainProcess: true,
                runtimeIntegrityVerified: true,
                runtimeManifestPinned: true,
                modelStateResolved: true,
                buildIdentityResolved: true,
                benchmarkProcessExecuted: true,
                fixture: false,
                synthetic: false,
                demo: false,
            },
            benchmarkContext: {
                harnessVersion: firstContext.harnessVersion,
                sourceCommit: firstContext.sourceCommit,
                runtimeIdentity: firstContext.runtimeIdentity,
                runtimeVersion: firstContext.runtimeVersion,
                runtimeBinarySha256: firstContext.runtimeBinarySha256,
                modelArtifactSha256: firstContext.modelArtifactSha256,
                auxiliaryArtifacts: firstContext.auxiliaryArtifacts.map((item) => ({ ...item })),
            },
            bindings: {
                promotionPackageValidated: true,
                certificationEntryBound: true,
                sourceApplyPlanValidated: true,
                sourceApplyPlanBound: true,
            },
            ...authorityFields({ provenanceVerified: true }),
        });

        const validation = validateRuntimeCertificationEvidenceProvenanceAttestation(attestation);
        if (!validation.ok) return rejected(validation.reason, normalizedTarget);

        const detached = cloneAttestation(attestation);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_STATUS.VERIFIED,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(detached),
            ...authorityFields({ provenanceVerified: true }),
        });
    };

    const getSummary = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;
        const attestation = store.get(targetKey(normalizedTarget));
        if (!attestation) return empty(normalizedTarget);

        return Object.freeze({
            status: RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_STATUS.VERIFIED,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(attestation),
            ...authorityFields({ provenanceVerified: true }),
        });
    };

    const readAttestation = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const attestation = store.get(targetKey(targetValidation.target));
        return attestation ? cloneAttestation(attestation) : null;
    };

    return Object.freeze({
        verify,
        getSummary,
        readAttestation,
        ...authorityFields(),
    });
}

const defaultGate = createRuntimeCertificationEvidenceProvenanceGate();

export function verifyRuntimeCertificationEvidenceProvenance(target) {
    return defaultGate.verify(target);
}

export function getRuntimeCertificationEvidenceProvenanceSummary(target) {
    return defaultGate.getSummary(target);
}

export function readRuntimeCertificationEvidenceProvenanceAttestation(target) {
    return defaultGate.readAttestation(target);
}

export {
    authorityFields,
    buildSummary,
    cloneAttestation,
    deepFreeze,
    sameAuxiliaryArtifacts,
    sameBenchmarkContext,
    targetKey,
};
