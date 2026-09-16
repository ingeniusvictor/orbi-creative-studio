import {
    createShadowCompatibilityDiagnostics,
    SHADOW_DIAGNOSTICS_STATUS,
} from './shadowCompatibilityDiagnostics.mjs';
import {
    publishShadowCompatibilitySnapshot,
    SHADOW_SNAPSHOT_HANDOFF_STATUS,
} from './shadowCompatibilitySnapshotHandoff.mjs';

export const SHADOW_SNAPSHOT_PRODUCER_STATUS = Object.freeze({
    PUBLISHED: 'SHADOW_SNAPSHOT_PRODUCER_PUBLISHED',
    UNCHANGED: 'SHADOW_SNAPSHOT_PRODUCER_UNCHANGED',
    REJECTED: 'SHADOW_SNAPSHOT_PRODUCER_REJECTED',
});

const ALLOWED_HANDOFF_REJECTION_REASONS = new Set([
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
    capturedAt = null,
    compatibilityStatus = null,
    handoffStatus = null,
} = {}) {
    return Object.freeze({
        status,
        reason,
        capturedAt,
        compatibilityStatus,
        handoffStatus,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validRegistry(registry) {
    return Boolean(registry)
        && typeof registry === 'object'
        && registry.schemaVersion === 1
        && registry.mode === 'immutable-shadow-registry'
        && typeof registry.evaluateShadowCompatibility === 'function'
        && registry.routingEligible === false
        && registry.cutoverAuthorized === false
        && registry.executionAuthority === 'legacy-dispatcher-only';
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function sanitizedHandoffReason(publishResult) {
    return ALLOWED_HANDOFF_REJECTION_REASONS.has(publishResult?.reason)
        ? publishResult.reason
        : 'PRODUCER_HANDOFF_REJECTED';
}

export function createShadowCompatibilitySnapshotProducer({
    publishSnapshot = publishShadowCompatibilitySnapshot,
} = {}) {
    if (typeof publishSnapshot !== 'function') {
        throw new TypeError('shadow snapshot publisher must be a function');
    }

    const produce = ({
        registry,
        runtime,
        model,
        hardware,
        width,
        height,
        capturedAt,
    } = {}) => {
        if (!validRegistry(registry)) {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
                reason: 'PRODUCER_REGISTRY_INVALID',
            });
        }
        if (!positiveInteger(width) || !positiveInteger(height)) {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
                reason: 'PRODUCER_RESOLUTION_INVALID',
            });
        }

        let shadowEvaluation;
        try {
            shadowEvaluation = registry.evaluateShadowCompatibility({
                runtime,
                model,
                hardware,
                width,
                height,
            });
        } catch {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
                reason: 'PRODUCER_EVALUATION_FAILED',
            });
        }

        const diagnostics = createShadowCompatibilityDiagnostics({
            shadowEvaluation,
            requestedContext: {
                modelId: model?.id,
                backend: runtime?.backend,
                width,
                height,
            },
            capturedAt,
        });

        if (diagnostics.status !== SHADOW_DIAGNOSTICS_STATUS.READY || !diagnostics.snapshot) {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
                reason: diagnostics.reason || 'PRODUCER_DIAGNOSTICS_REJECTED',
            });
        }

        let publishResult;
        try {
            publishResult = publishSnapshot(diagnostics.snapshot);
        } catch {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
                reason: 'PRODUCER_HANDOFF_FAILED',
                capturedAt: diagnostics.snapshot.capturedAt,
                compatibilityStatus: diagnostics.snapshot.compatibility.status,
            });
        }

        const authorityValid = publishResult
            && publishResult.diagnosticOnly === true
            && publishResult.routingEligible === false
            && publishResult.cutoverAuthorized === false
            && publishResult.executionAuthority === 'legacy-dispatcher-only';

        if (!authorityValid) {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
                reason: 'PRODUCER_HANDOFF_AUTHORITY_INVALID',
                capturedAt: diagnostics.snapshot.capturedAt,
                compatibilityStatus: diagnostics.snapshot.compatibility.status,
            });
        }

        if (publishResult.status === SHADOW_SNAPSHOT_HANDOFF_STATUS.ACCEPTED) {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.PUBLISHED,
                capturedAt: diagnostics.snapshot.capturedAt,
                compatibilityStatus: diagnostics.snapshot.compatibility.status,
                handoffStatus: publishResult.status,
            });
        }

        if (publishResult.status === SHADOW_SNAPSHOT_HANDOFF_STATUS.UNCHANGED) {
            return response({
                status: SHADOW_SNAPSHOT_PRODUCER_STATUS.UNCHANGED,
                capturedAt: diagnostics.snapshot.capturedAt,
                compatibilityStatus: diagnostics.snapshot.compatibility.status,
                handoffStatus: publishResult.status,
            });
        }

        return response({
            status: SHADOW_SNAPSHOT_PRODUCER_STATUS.REJECTED,
            reason: sanitizedHandoffReason(publishResult),
            capturedAt: diagnostics.snapshot.capturedAt,
            compatibilityStatus: diagnostics.snapshot.compatibility.status,
            handoffStatus: publishResult?.status || null,
        });
    };

    return Object.freeze({
        produce,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

const defaultProducer = createShadowCompatibilitySnapshotProducer();

export function produceAndPublishShadowCompatibilitySnapshot(input) {
    return defaultProducer.produce(input);
}

export {
    ALLOWED_HANDOFF_REJECTION_REASONS,
    sanitizedHandoffReason,
    validRegistry,
};
