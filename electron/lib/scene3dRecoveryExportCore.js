'use strict';

const crypto = require('node:crypto');

const RESOLUTIONS = new Set(['applied', 'not_applied', 'inconclusive']);

function plain(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validIso(value) {
    return typeof value === 'string'
        && Number.isFinite(Date.parse(value))
        && new Date(Date.parse(value)).toISOString() === value;
}

function sanitizePending(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('Scene3D pending recovery evidence must be an array');
    }

    return Object.freeze(value.map((item) => {
        if (!plain(item)
            || !Number.isInteger(item.sequence)
            || item.sequence < 1
            || typeof item.request_id !== 'string'
            || !item.request_id
            || item.outcome !== 'pending'
            || item.provider_called !== null
            || item.replay_reserved !== true) {
            throw new TypeError('Scene3D pending recovery item is invalid');
        }

        return Object.freeze({
            sequence: item.sequence,
            requestId: item.request_id,
            operation: typeof item.operation === 'string' && item.operation
                ? item.operation
                : 'execute_recipe',
            outcome: 'pending',
            providerCalled: null,
            replayReserved: true,
        });
    }));
}

function sanitizeHistory(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('Scene3D reconciliation history must be an array');
    }

    return Object.freeze(value.map((item) => {
        if (!plain(item)
            || !Number.isInteger(item.reconciliation_sequence)
            || item.reconciliation_sequence < 1
            || typeof item.request_id !== 'string'
            || !item.request_id
            || !RESOLUTIONS.has(item.resolution)
            || typeof item.actor !== 'string'
            || !item.actor
            || typeof item.final !== 'boolean'
            || item.reservation_released !== false) {
            throw new TypeError('Scene3D reconciliation history item is invalid');
        }

        return Object.freeze({
            sequence: item.reconciliation_sequence,
            requestId: item.request_id,
            resolution: item.resolution,
            actor: item.actor,
            final: item.final,
            reservationReleased: false,
        });
    }));
}

function sanitizeRecoverySnapshot(snapshot) {
    if (!plain(snapshot) || !validIso(snapshot.capturedAt)) {
        throw new TypeError('Scene3D recovery snapshot is invalid');
    }

    const pendingExecutions = sanitizePending(snapshot.pending);
    const reconciliationHistory = sanitizeHistory(snapshot.history);

    const sanitized = Object.freeze({
        schemaVersion: 1,
        evidenceType: 'orbi-scene3d-recovery-handoff',
        capturedAt: snapshot.capturedAt,
        pendingExecutions,
        reconciliationHistory,
        requiresOperatorReview: pendingExecutions.length > 0,
        privacy: Object.freeze({
            providerMetadataIncluded: false,
            requestFingerprintIncluded: false,
            rawEvidenceIncluded: false,
            localPathsIncluded: false,
        }),
        authority: Object.freeze({
            readOnly: true,
            executionAuthorized: false,
            retryAuthorized: false,
            reconciliationAuthorized: false,
            requestIdReleaseAuthorized: false,
            productionCutoverAuthorized: false,
        }),
    });

    const serialized = JSON.stringify(sanitized);
    for (const forbidden of [
        'request_fingerprint',
        'evidence_sha256',
        '"evidence":',
        '"provider":',
        'provider_family',
        'provider_capability',
        'provider_version',
        'retry_semantics',
        'sqlite',
        'ledgerPath',
        'pythonPath',
        'qwen',
        'execute_blender_code',
        'C:\\',
        '/home/',
        '/tmp/',
    ]) {
        if (serialized.includes(forbidden)) {
            throw new TypeError('Scene3D recovery export privacy boundary is invalid');
        }
    }

    return sanitized;
}

function filenameFromIso(capturedAt) {
    const stamp = capturedAt.replace(/[^0-9]/g, '').slice(0, 14);
    return `orbi-scene3d-recovery-${stamp || 'snapshot'}.json`;
}

function createScene3DRecoveryExportPlan(snapshot) {
    const bundle = sanitizeRecoverySnapshot(snapshot);
    const serialized = `${JSON.stringify(bundle, null, 2)}\n`;
    const sha256 = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');

    return Object.freeze({
        schemaVersion: 1,
        status: 'SCENE3D_RECOVERY_EXPORT_PLAN_READY',
        serialized,
        sha256,
        bytes: Buffer.byteLength(serialized, 'utf8'),
        defaultFilename: filenameFromIso(bundle.capturedAt),
        bundle,
        createOnly: true,
        overwriteAllowed: false,
        executionAuthorized: false,
        retryAuthorized: false,
        reconciliationAuthorized: false,
        requestIdReleaseAuthorized: false,
        productionCutoverAuthorized: false,
    });
}

module.exports = {
    createScene3DRecoveryExportPlan,
    filenameFromIso,
    sanitizeRecoverySnapshot,
};
