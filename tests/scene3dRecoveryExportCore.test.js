const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
    createScene3DRecoveryExportPlan,
    filenameFromIso,
    sanitizeRecoverySnapshot,
} = require('../electron/lib/scene3dRecoveryExportCore');

const CAPTURED_AT = '2026-09-23T05:10:00.000Z';

function pending(overrides = {}) {
    return {
        schema: 'orbi.execution-audit/v1',
        sequence: 5,
        request_id: 'pending-request-1',
        request_fingerprint: 'f'.repeat(64),
        interface: 'orbi.scene3d.v1',
        operation: 'execute_recipe',
        risk_class: 'R2_EXECUTE_SANDBOXED',
        outcome: 'pending',
        provider_called: null,
        provider: {
            family: 'qwen-mm-plugins',
            capability: 'blender',
            version: '1.1.0',
        },
        replay_reserved: true,
        retry_semantics: 'new-request-id-required-after-execution-attempt',
        ...overrides,
    };
}

function history(overrides = {}) {
    return {
        schema: 'orbi.execution-reconciliation/v1',
        reconciliation_sequence: 2,
        execution_sequence: 5,
        request_id: 'pending-request-1',
        request_fingerprint: 'f'.repeat(64),
        resolution: 'inconclusive',
        actor: 'operator',
        evidence: {
            source: 'blender-object-info',
            private_detail: 'must-not-export',
        },
        evidence_sha256: 'e'.repeat(64),
        final: false,
        reservation_released: false,
        retry_semantics: 'original-request-id-remains-reserved;new-request-id-required',
        ...overrides,
    };
}

function snapshot(overrides = {}) {
    return {
        capturedAt: CAPTURED_AT,
        pending: [pending()],
        history: [history()],
        localPath: '/home/user/private/ledger.sqlite3',
        pythonPath: '/home/user/.venv/bin/python',
        ...overrides,
    };
}

test('QB-19 sanitizes recovery handoff to a minimal read-only bundle', () => {
    const bundle = sanitizeRecoverySnapshot(snapshot());

    assert.deepEqual(bundle.pendingExecutions, [{
        sequence: 5,
        requestId: 'pending-request-1',
        operation: 'execute_recipe',
        outcome: 'pending',
        providerCalled: null,
        replayReserved: true,
    }]);

    assert.deepEqual(bundle.reconciliationHistory, [{
        sequence: 2,
        requestId: 'pending-request-1',
        resolution: 'inconclusive',
        actor: 'operator',
        final: false,
        reservationReleased: false,
    }]);

    assert.equal(bundle.requiresOperatorReview, true);
    assert.deepEqual(bundle.privacy, {
        providerMetadataIncluded: false,
        requestFingerprintIncluded: false,
        rawEvidenceIncluded: false,
        localPathsIncluded: false,
    });
    assert.deepEqual(bundle.authority, {
        readOnly: true,
        executionAuthorized: false,
        retryAuthorized: false,
        reconciliationAuthorized: false,
        requestIdReleaseAuthorized: false,
        productionCutoverAuthorized: false,
    });
});

test('QB-19 serializer excludes raw provider, fingerprints, evidence, paths and Qwen identity', () => {
    const plan = createScene3DRecoveryExportPlan(snapshot());
    const serialized = plan.serialized;

    for (const forbidden of [
        'qwen-mm-plugins',
        'blender',
        'request_fingerprint',
        'must-not-export',
        'evidence_sha256',
        'retry_semantics',
        '/home/user',
        'ledger.sqlite3',
        '.venv',
        'execute_blender_code',
    ]) {
        assert.equal(serialized.includes(forbidden), false, forbidden);
    }

    assert.ok(serialized.includes('pending-request-1'));
    assert.ok(serialized.includes('inconclusive'));
});

test('QB-19 export plan has deterministic bytes, hash and create-only authority', () => {
    const plan = createScene3DRecoveryExportPlan(snapshot());

    assert.equal(plan.status, 'SCENE3D_RECOVERY_EXPORT_PLAN_READY');
    assert.match(plan.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
        plan.sha256,
        crypto.createHash('sha256').update(plan.serialized, 'utf8').digest('hex'),
    );
    assert.equal(plan.bytes, Buffer.byteLength(plan.serialized, 'utf8'));
    assert.ok(plan.serialized.endsWith('\n'));
    assert.equal(plan.defaultFilename, 'orbi-scene3d-recovery-20260923051000.json');
    assert.equal(plan.createOnly, true);
    assert.equal(plan.overwriteAllowed, false);
    assert.equal(plan.executionAuthorized, false);
    assert.equal(plan.retryAuthorized, false);
    assert.equal(plan.reconciliationAuthorized, false);
    assert.equal(plan.requestIdReleaseAuthorized, false);
    assert.equal(plan.productionCutoverAuthorized, false);
});

test('QB-19 filename is derived only from ISO capture time', () => {
    assert.equal(
        filenameFromIso('2026-01-02T03:04:05.000Z'),
        'orbi-scene3d-recovery-20260102030405.json',
    );
});

test('QB-19 rejects invalid capture timestamps', () => {
    assert.throws(
        () => sanitizeRecoverySnapshot(snapshot({ capturedAt: 'not-a-date' })),
        /snapshot is invalid/,
    );
});

test('QB-19 rejects forged pending state and known provider outcome', () => {
    for (const item of [
        pending({ outcome: 'executed' }),
        pending({ provider_called: true }),
        pending({ provider_called: false }),
        pending({ replay_reserved: false }),
        pending({ request_id: '' }),
    ]) {
        assert.throws(
            () => sanitizeRecoverySnapshot(snapshot({ pending: [item] })),
            /pending recovery item is invalid/,
        );
    }
});

test('QB-19 rejects unknown reconciliation resolutions and released reservations', () => {
    assert.throws(
        () => sanitizeRecoverySnapshot(snapshot({
            history: [history({ resolution: 'retry' })],
        })),
        /history item is invalid/,
    );

    assert.throws(
        () => sanitizeRecoverySnapshot(snapshot({
            history: [history({ reservation_released: true })],
        })),
        /history item is invalid/,
    );
});

test('QB-19 empty recovery snapshot is valid and needs no operator review', () => {
    const bundle = sanitizeRecoverySnapshot(snapshot({
        pending: [],
        history: [],
    }));

    assert.deepEqual(bundle.pendingExecutions, []);
    assert.deepEqual(bundle.reconciliationHistory, []);
    assert.equal(bundle.requiresOperatorReview, false);
});

test('QB-19 injected top-level renderer fields never enter export', () => {
    const plan = createScene3DRecoveryExportPlan({
        ...snapshot(),
        apiKey: 'SECRET',
        destination: 'C:\\private\\recovery.json',
        code: 'import os',
        provider: 'qwen',
    });

    for (const forbidden of ['SECRET', 'C:\\private', 'import os', '"provider"']) {
        assert.equal(plan.serialized.includes(forbidden), false, forbidden);
    }
});
