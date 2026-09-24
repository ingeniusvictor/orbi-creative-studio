'use strict';

const SAFE_ERROR_MESSAGES = Object.freeze({
    POLICY_DENIED: 'Scene3D request was denied by policy',
    REPLAY_DENIED: 'Scene3D execution request was already used',
    REQUEST_ID_CONFLICT: 'Scene3D execution request identity conflicts with prior history',
    PROVIDER_UNAVAILABLE: 'Scene3D provider is unavailable',
    PROVIDER_FAILURE: 'Scene3D provider operation failed',
    UNSUPPORTED_OPERATION: 'Scene3D operation is unsupported',
});

function sanitizeError(error) {
    if (!error || typeof error !== 'object') return null;
    const code = String(error.code || 'SCENE3D_OPERATION_FAILED');
    return Object.freeze({
        code,
        message: SAFE_ERROR_MESSAGES[code] || 'Scene3D operation failed',
        retryable: Boolean(error.retryable),
    });
}

function sanitizeAudit(audit) {
    if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return null;

    const rest = { ...audit };
    delete rest.provider;
    return Object.freeze(rest);
}

function sanitizeExecutionData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;

    if ('execution' in data && 'recipe' in data) {
        return Object.freeze({
            execution: data.execution,
            recipe: data.recipe,
            providerCalled: Boolean(data.audit && data.audit.provider_called),
        });
    }

    return data;
}

function sanitizeOrbiResponse(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new TypeError('Scene3D ORBI response must be an object');
    }

    const response = {
        ok: Boolean(result.ok),
        request_id: result.request_id ?? null,
        interface: result.interface ?? null,
        operation: result.operation ?? null,
        data: sanitizeExecutionData(result.data),
        policy: result.policy && typeof result.policy === 'object'
            ? { ...result.policy }
            : {},
        audit: sanitizeAudit(result.audit),
    };

    if (!response.ok) {
        response.error = sanitizeError(result.error);
    }

    return Object.freeze(response);
}

function sanitizePendingReceipt(receipt) {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
        throw new TypeError('Scene3D pending receipt must be an object');
    }

    const rest = { ...receipt };
    delete rest.provider;
    return Object.freeze(rest);
}

function sanitizePendingRecoveries(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('Scene3D pending recovery result must be an array');
    }
    return Object.freeze(value.map(sanitizePendingReceipt));
}

function sanitizeReconciliationHistory(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('Scene3D reconciliation history must be an array');
    }

    return Object.freeze(value.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new TypeError('Scene3D reconciliation record must be an object');
        }

        return Object.freeze({
            schema: item.schema ?? null,
            reconciliation_sequence: item.reconciliation_sequence ?? null,
            execution_sequence: item.execution_sequence ?? null,
            request_id: item.request_id ?? null,
            request_fingerprint: item.request_fingerprint ?? null,
            resolution: item.resolution ?? null,
            actor: item.actor ?? null,
            evidence_sha256: item.evidence_sha256 ?? null,
            final: Boolean(item.final),
            reservation_released: Boolean(item.reservation_released),
            retry_semantics: item.retry_semantics ?? null,
        });
    }));
}

module.exports = {
    sanitizeAudit,
    sanitizeError,
    sanitizeOrbiResponse,
    sanitizePendingRecoveries,
    sanitizeReconciliationHistory,
};
