import {
    collectShadowCompatibilityEvidence,
    SHADOW_EVIDENCE_COLLECTOR_STATUS,
} from './shadowCompatibilityEvidenceCollector.mjs';
import {
    produceAndPublishShadowCompatibilitySnapshot,
    SHADOW_SNAPSHOT_PRODUCER_STATUS,
} from './shadowCompatibilitySnapshotProducer.mjs';

export const SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS = Object.freeze({
    PUBLISHED: 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_PUBLISHED',
    UNCHANGED: 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_UNCHANGED',
    REJECTED: 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_REJECTED',
});

const ALLOWED_COLLECTOR_REASONS = new Set([
    'COLLECTOR_MODEL_ID_INVALID',
    'COLLECTOR_BACKEND_INVALID',
    'COLLECTOR_RESOLUTION_INVALID',
    'COLLECTOR_BRIDGE_RESOLUTION_FAILED',
    'COLLECTOR_BRIDGE_UNAVAILABLE',
    'COLLECTOR_READINESS_FAILED',
    'COLLECTOR_SNAPSHOT_INVALID',
    'COLLECTOR_RUNTIME_EVIDENCE_MISSING',
    'COLLECTOR_RUNTIME_EVIDENCE_INCOMPLETE',
    'COLLECTOR_RUNTIME_BACKEND_MISMATCH',
    'COLLECTOR_MODEL_SET_MISSING',
    'COLLECTOR_MODEL_EVIDENCE_NOT_FOUND',
    'COLLECTOR_MODEL_EVIDENCE_DUPLICATE',
    'COLLECTOR_MODEL_STATE_INVALID',
    'COLLECTOR_CLOCK_INVALID',
]);

const ALLOWED_PRODUCER_REASONS = new Set([
    'PRODUCER_REGISTRY_INVALID',
    'PRODUCER_RESOLUTION_INVALID',
    'PRODUCER_EVALUATION_FAILED',
    'PRODUCER_DIAGNOSTICS_REJECTED',
    'PRODUCER_HANDOFF_FAILED',
    'PRODUCER_HANDOFF_AUTHORITY_INVALID',
    'PRODUCER_HANDOFF_REJECTED',
    'DIAGNOSTIC_SHADOW_EVALUATION_INVALID',
    'DIAGNOSTIC_SHADOW_AUTHORITY_INVALID',
    'DIAGNOSTIC_CONTEXT_INVALID',
    'DIAGNOSTIC_CONTEXT_MISMATCH',
    'DIAGNOSTIC_COMPATIBILITY_INVALID',
    'DIAGNOSTIC_TIMESTAMP_INVALID',
    'DIAGNOSTIC_REASON_SET_INVALID',
    'DIAGNOSTIC_DETAIL_SET_INVALID',
    'SNAPSHOT_SHAPE_INVALID',
    'SNAPSHOT_IDENTITY_INVALID',
    'SNAPSHOT_TIMESTAMP_INVALID',
    'SNAPSHOT_CONTEXT_INVALID',
    'SNAPSHOT_REGISTRY_INVALID',
    'SNAPSHOT_COMPATIBILITY_INVALID',
    'SNAPSHOT_HARDWARE_INVALID',
    'SNAPSHOT_RESOURCES_INVALID',
    'SNAPSHOT_AUTHORITY_INVALID',
    'HANDOFF_SNAPSHOT_OLDER_THAN_CURRENT',
    'HANDOFF_TIMESTAMP_CONFLICT',
]);

function response({
    status,
    reason = null,
    stage = null,
    capturedAt = null,
    compatibilityStatus = null,
    handoffStatus = null,
} = {}) {
    return Object.freeze({
        status,
        reason,
        stage,
        capturedAt,
        compatibilityStatus,
        handoffStatus,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sanitizedReason(reason, allowed, fallback) {
    return allowed.has(reason) ? reason : fallback;
}

export function createShadowDiagnosticOrchestrator({
    collectEvidence = collectShadowCompatibilityEvidence,
    produceSnapshot = produceAndPublishShadowCompatibilitySnapshot,
} = {}) {
    if (typeof collectEvidence !== 'function') {
        throw new TypeError('shadow evidence collector must be a function');
    }
    if (typeof produceSnapshot !== 'function') {
        throw new TypeError('shadow snapshot producer must be a function');
    }

    const run = async ({ registry, modelId, backend, width, height } = {}) => {
        let collected;
        try {
            collected = await collectEvidence({ modelId, backend, width, height });
        } catch {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
                reason: 'ORCHESTRATOR_COLLECTOR_FAILED',
                stage: 'collect',
            });
        }

        const collectorAuthorityValid = collected
            && collected.diagnosticOnly === true
            && collected.routingEligible === false
            && collected.cutoverAuthorized === false
            && collected.executionAuthority === 'legacy-dispatcher-only';

        if (!collectorAuthorityValid) {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
                reason: 'ORCHESTRATOR_COLLECTOR_AUTHORITY_INVALID',
                stage: 'collect',
            });
        }

        if (collected.status !== SHADOW_EVIDENCE_COLLECTOR_STATUS.READY || !collected.evidence) {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
                reason: sanitizedReason(
                    collected.reason,
                    ALLOWED_COLLECTOR_REASONS,
                    'ORCHESTRATOR_COLLECTOR_REJECTED',
                ),
                stage: 'collect',
            });
        }

        const evidence = collected.evidence;
        if (evidence.context?.modelId !== modelId
            || evidence.context?.backend !== backend
            || evidence.context?.width !== width
            || evidence.context?.height !== height
            || evidence.diagnosticOnly !== true
            || evidence.routingEligible !== false
            || evidence.cutoverAuthorized !== false
            || evidence.executionAuthority !== 'legacy-dispatcher-only') {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
                reason: 'ORCHESTRATOR_EVIDENCE_CONTEXT_INVALID',
                stage: 'collect',
            });
        }

        let produced;
        try {
            produced = produceSnapshot({
                registry,
                runtime: evidence.runtime,
                model: evidence.model,
                hardware: evidence.hardware,
                width,
                height,
                capturedAt: evidence.capturedAt,
            });
        } catch {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
                reason: 'ORCHESTRATOR_PRODUCER_FAILED',
                stage: 'produce',
                capturedAt: evidence.capturedAt,
            });
        }

        const producerAuthorityValid = produced
            && produced.diagnosticOnly === true
            && produced.routingEligible === false
            && produced.cutoverAuthorized === false
            && produced.executionAuthority === 'legacy-dispatcher-only';

        if (!producerAuthorityValid) {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
                reason: 'ORCHESTRATOR_PRODUCER_AUTHORITY_INVALID',
                stage: 'produce',
                capturedAt: evidence.capturedAt,
            });
        }

        if (produced.status === SHADOW_SNAPSHOT_PRODUCER_STATUS.PUBLISHED) {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.PUBLISHED,
                stage: 'complete',
                capturedAt: produced.capturedAt,
                compatibilityStatus: produced.compatibilityStatus,
                handoffStatus: produced.handoffStatus,
            });
        }

        if (produced.status === SHADOW_SNAPSHOT_PRODUCER_STATUS.UNCHANGED) {
            return response({
                status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.UNCHANGED,
                stage: 'complete',
                capturedAt: produced.capturedAt,
                compatibilityStatus: produced.compatibilityStatus,
                handoffStatus: produced.handoffStatus,
            });
        }

        return response({
            status: SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.REJECTED,
            reason: sanitizedReason(
                produced.reason,
                ALLOWED_PRODUCER_REASONS,
                'ORCHESTRATOR_PRODUCER_REJECTED',
            ),
            stage: 'produce',
            capturedAt: produced.capturedAt || evidence.capturedAt,
            compatibilityStatus: produced.compatibilityStatus || null,
            handoffStatus: produced.handoffStatus || null,
        });
    };

    return Object.freeze({
        run,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

const defaultOrchestrator = createShadowDiagnosticOrchestrator();

export async function runShadowCompatibilityDiagnostic(input) {
    return defaultOrchestrator.run(input);
}

export {
    ALLOWED_COLLECTOR_REASONS,
    ALLOWED_PRODUCER_REASONS,
    sanitizedReason,
};
