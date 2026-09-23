const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

async function loadModule() {
    return import('../src/components/Scene3DRecoveryInspectionPanel.js');
}

function validPending(overrides = {}) {
    return {
        sequence: 4,
        request_id: 'pending-request-1',
        request_fingerprint: 'f'.repeat(64),
        interface: 'orbi.scene3d.v1',
        operation: 'execute_recipe',
        risk_class: 'R2_EXECUTE_SANDBOXED',
        outcome: 'pending',
        provider_called: null,
        replay_reserved: true,
        retry_semantics: 'new-request-id-required-after-execution-attempt',
        ...overrides,
    };
}

function validHistory(overrides = {}) {
    return {
        schema: 'orbi.execution-reconciliation/v1',
        reconciliation_sequence: 2,
        execution_sequence: 4,
        request_id: 'pending-request-1',
        request_fingerprint: 'f'.repeat(64),
        resolution: 'applied',
        actor: 'operator',
        evidence: {
            source: 'blender-object-info',
            secret_detail: 'must-not-render',
        },
        evidence_sha256: 'a'.repeat(64),
        final: true,
        reservation_released: false,
        retry_semantics: 'original-request-id-remains-reserved;new-request-id-required',
        ...overrides,
    };
}

test('QB-18 recovery status requires enabled read-only pilot semantics', async () => {
    const { normalizeRecoveryStatus } = await loadModule();

    assert.deepEqual(
        normalizeRecoveryStatus({
            ok: true,
            status: {
                enabled: true,
                defaultOff: true,
                rendererCanConfigure: false,
                automaticR2Retry: false,
                reconciliationMutation: false,
            },
        }),
        { enabled: true },
    );

    for (const status of [
        { enabled: false, defaultOff: true, rendererCanConfigure: false, automaticR2Retry: false, reconciliationMutation: false },
        { enabled: true, defaultOff: false, rendererCanConfigure: false, automaticR2Retry: false, reconciliationMutation: false },
        { enabled: true, defaultOff: true, rendererCanConfigure: true, automaticR2Retry: false, reconciliationMutation: false },
        { enabled: true, defaultOff: true, rendererCanConfigure: false, automaticR2Retry: true, reconciliationMutation: false },
        { enabled: true, defaultOff: true, rendererCanConfigure: false, automaticR2Retry: false, reconciliationMutation: true },
    ]) {
        assert.equal(normalizeRecoveryStatus({ ok: true, status }), null);
    }
});

test('QB-18 pending normalization exposes only minimal uncertain-execution fields', async () => {
    const { normalizePendingRecoveries } = await loadModule();

    const result = normalizePendingRecoveries([validPending()]);

    assert.deepEqual(result, [{
        sequence: 4,
        requestId: 'pending-request-1',
        operation: 'execute_recipe',
        outcome: 'pending',
        providerCalled: null,
    }]);

    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('request_fingerprint'), false);
    assert.equal(serialized.includes('retry_semantics'), false);
    assert.equal(serialized.includes('provider'), false);
});

test('QB-18 pending normalization fails closed for non-pending or known provider-call state', async () => {
    const { normalizePendingRecoveries } = await loadModule();

    assert.equal(normalizePendingRecoveries({}), null);
    assert.equal(normalizePendingRecoveries([validPending({ outcome: 'executed' })]), null);
    assert.equal(normalizePendingRecoveries([validPending({ provider_called: true })]), null);
    assert.equal(normalizePendingRecoveries([validPending({ replay_reserved: false })]), null);
});

test('QB-18 history normalization exposes no raw evidence or hashes', async () => {
    const { normalizeReconciliationHistory } = await loadModule();

    const result = normalizeReconciliationHistory([validHistory()]);

    assert.deepEqual(result, [{
        sequence: 2,
        requestId: 'pending-request-1',
        resolution: 'applied',
        actor: 'operator',
        final: true,
    }]);

    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('secret_detail'), false);
    assert.equal(serialized.includes('evidence'), false);
    assert.equal(serialized.includes('sha256'), false);
    assert.equal(serialized.includes('request_fingerprint'), false);
});

test('QB-18 history accepts only QB-13 reconciliation resolutions and permanent reservation', async () => {
    const { normalizeReconciliationHistory } = await loadModule();

    for (const resolution of ['applied', 'not_applied', 'inconclusive']) {
        assert.equal(
            normalizeReconciliationHistory([validHistory({ resolution })])[0].resolution,
            resolution,
        );
    }

    assert.equal(
        normalizeReconciliationHistory([validHistory({ resolution: 'retry' })]),
        null,
    );
    assert.equal(
        normalizeReconciliationHistory([validHistory({ reservation_released: true })]),
        null,
    );
});

test('QB-18 recovery loading is explicitly click-triggered and never automatic', () => {
    const source = read('src/components/Scene3DRecoveryInspectionPanel.js');

    const onclickIndex = source.indexOf('action.onclick = async () =>');
    const pendingIndex = source.indexOf('pendingProvider()');
    const historyIndex = source.indexOf('historyProvider()');

    assert.ok(onclickIndex > 0);
    assert.ok(pendingIndex > onclickIndex);
    assert.ok(historyIndex > onclickIndex);
    assert.ok(source.includes("action.dataset.orbiScene3dRecoveryLoad = 'explicit-user-action'"));

    const initializeIndex = source.indexOf('async function initialize()');
    assert.ok(initializeIndex > 0);
    assert.ok(source.indexOf('await statusProvider()', initializeIndex) > initializeIndex);
});

test('QB-18 component has no execution or recovery-mutation authority', () => {
    const source = read('src/components/Scene3DRecoveryInspectionPanel.js');

    for (const forbidden of [
        '.executeRecipe(',
        '.dryRunRecipe(',
        '.sceneInfo(',
        '.objectInfo(',
        'reconcilePending',
        'retryExecution',
        'releaseReservation',
        'setProvider',
        'setLedgerPath',
        'executeBlenderCode',
        'executePython',
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }
});

test('QB-18 renders dynamic recovery data only through textContent', () => {
    const source = read('src/components/Scene3DRecoveryInspectionPanel.js');

    assert.ok(source.includes('node.textContent = text'));
    assert.equal(source.includes('innerHTML = `'), false);
    assert.equal(source.includes('insertAdjacentHTML'), false);
});

test('QB-18 Settings mounts the recovery inspector without invoking its privileged methods directly', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes("import { Scene3DRecoveryInspectionPanel }"));
    assert.ok(settings.includes('const scene3dRecoveryInspectionPanel = isLocalAIAvailable()'));
    assert.ok(settings.includes('diagnosticsContainer.appendChild(scene3dRecoveryInspectionPanel)'));

    for (const forbidden of [
        'orbiScene3D.pendingRecoveries',
        'orbiScene3D.reconciliationHistory',
        'orbiScene3D.executeRecipe',
        'orbiScene3D.dryRunRecipe',
        'orbiScene3D.reconcilePending',
    ]) {
        assert.equal(settings.includes(forbidden), false, forbidden);
    }
});

test('QB-18 recovery copy exists in English and Chinese and states read-only limits', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'scene3dRecovery.title',
        'scene3dRecovery.subtitle',
        'scene3dRecovery.load',
        'scene3dRecovery.pendingTitle',
        'scene3dRecovery.historyTitle',
        'scene3dRecovery.unavailable',
        'scene3dRecovery.boundary',
    ];

    for (const key of keys) {
        const marker = "'" + key + "'";
        assert.equal(
            (i18n.match(new RegExp(marker, 'g')) || []).length,
            2,
            key,
        );
    }

    assert.ok(i18n.includes('only after an explicit click'));
    assert.ok(i18n.includes('cannot retry execution'));
    assert.ok(i18n.includes('cannot retry or reconcile an execution'));
});
