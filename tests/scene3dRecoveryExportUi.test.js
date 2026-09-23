const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function loadModule() {
    return import('../src/components/Scene3DRecoveryInspectionPanel.js');
}

function authority(overrides = {}) {
    return {
        readOnlyEvidence: true,
        executionAuthorized: false,
        retryAuthorized: false,
        reconciliationAuthorized: false,
        requestIdReleaseAuthorized: false,
        productionCutoverAuthorized: false,
        ...overrides,
    };
}

test('QB-19 UI accepts only non-authorizing written export metadata', async () => {
    const { normalizeRecoveryExportResult } = await loadModule();

    const result = normalizeRecoveryExportResult({
        status: 'SCENE3D_RECOVERY_EXPORT_WRITTEN',
        reason: null,
        fileName: 'orbi-scene3d-recovery-20260923052000.json',
        sha256: 'a'.repeat(64),
        bytes: 1234,
        ...authority(),
    });

    assert.deepEqual(result, {
        status: 'written',
        fileName: 'orbi-scene3d-recovery-20260923052000.json',
        sha256: 'a'.repeat(64),
        bytes: 1234,
    });
});

test('QB-19 UI rejects path-bearing filenames, bad hashes, bytes and authority escalation', async () => {
    const { normalizeRecoveryExportResult } = await loadModule();
    const base = {
        status: 'SCENE3D_RECOVERY_EXPORT_WRITTEN',
        fileName: 'recovery.json',
        sha256: 'a'.repeat(64),
        bytes: 100,
        ...authority(),
    };

    for (const forged of [
        { ...base, fileName: '/tmp/recovery.json' },
        { ...base, fileName: 'C:\\private\\recovery.json' },
        { ...base, sha256: 'bad' },
        { ...base, bytes: 0 },
        { ...base, retryAuthorized: true },
        { ...base, reconciliationAuthorized: true },
        { ...base, executionAuthorized: true },
        { ...base, requestIdReleaseAuthorized: true },
        { ...base, productionCutoverAuthorized: true },
        { ...base, readOnlyEvidence: false },
    ]) {
        assert.equal(normalizeRecoveryExportResult(forged), null);
    }
});

test('QB-19 UI accepts only governed canceled/rejected states with zero authority', async () => {
    const { normalizeRecoveryExportResult } = await loadModule();

    assert.deepEqual(
        normalizeRecoveryExportResult({
            status: 'SCENE3D_RECOVERY_EXPORT_CANCELED',
            ...authority(),
        }),
        { status: 'canceled' },
    );

    assert.deepEqual(
        normalizeRecoveryExportResult({
            status: 'SCENE3D_RECOVERY_EXPORT_REJECTED',
            reason: 'INTERNAL_REASON_NOT_RENDERED',
            ...authority(),
        }),
        { status: 'rejected' },
    );
});

test('QB-19 export action is disabled until recovery inspection validates', () => {
    const source = fs.readFileSync(
        'src/components/Scene3DRecoveryInspectionPanel.js',
        'utf8',
    );

    assert.ok(source.includes('exportButton.disabled = true'));
    assert.ok(source.includes('exportReady = false'));
    assert.ok(source.includes('exportReady = true'));
    assert.ok(source.includes('exportButton.disabled = false'));

    const loadStart = source.indexOf('action.onclick = async () =>');
    const revoke = source.indexOf('exportReady = false', loadStart);
    const enable = source.indexOf('exportReady = true', loadStart);
    assert.ok(revoke > loadStart);
    assert.ok(enable > revoke);
});

test('QB-19 reload revokes stale export readiness before fetching recovery again', () => {
    const source = fs.readFileSync(
        'src/components/Scene3DRecoveryInspectionPanel.js',
        'utf8',
    );
    const loadStart = source.indexOf('action.onclick = async () =>');
    const promiseAll = source.indexOf('Promise.all([', loadStart);
    const revoke = source.indexOf('exportReady = false', loadStart);
    const clearExportResult = source.indexOf("exportResult.innerHTML = ''", loadStart);

    assert.ok(revoke > loadStart && revoke < promiseAll);
    assert.ok(clearExportResult > loadStart && clearExportResult < promiseAll);
});

test('QB-19 export provider is invoked only from explicit export button click', () => {
    const source = fs.readFileSync(
        'src/components/Scene3DRecoveryInspectionPanel.js',
        'utf8',
    );

    const click = source.indexOf('exportButton.onclick = async () =>');
    const provider = source.indexOf('await exportProvider()');

    assert.ok(click > 0);
    assert.ok(provider > click);
    assert.ok(source.includes("exportButton.dataset.orbiScene3dRecoveryExport = 'explicit-user-save'"));
});

test('QB-19 UI never asks for or renders a destination path', () => {
    const source = fs.readFileSync(
        'src/components/Scene3DRecoveryInspectionPanel.js',
        'utf8',
    );

    for (const forbidden of [
        'filePath',
        'destination',
        'showSaveDialog',
        'ledgerPath',
        'pythonPath',
        'request_fingerprint',
        'evidence_sha256',
        'provider_family',
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }

    assert.ok(source.includes('normalized.fileName'));
    assert.ok(source.includes('normalized.sha256'));
    assert.ok(source.includes('normalized.bytes'));
});

test('QB-19 renderer export request has no arguments', () => {
    const preload = fs.readFileSync('electron/preload.js', 'utf8');

    assert.ok(preload.includes('exportRecoveryEvidence: () =>'));
    assert.equal(preload.includes('exportRecoveryEvidence: (bundle)'), false);
    assert.equal(preload.includes('exportRecoveryEvidence: (path)'), false);
});

test('QB-19 export copy exists in English and Chinese', () => {
    const i18n = fs.readFileSync('src/lib/i18n.js', 'utf8');
    const keys = [
        'scene3dRecovery.export',
        'scene3dRecovery.exporting',
        'scene3dRecovery.exportCanceled',
        'scene3dRecovery.exportRejected',
        'scene3dRecovery.exportFile',
        'scene3dRecovery.exportBytes',
    ];

    for (const key of keys) {
        assert.equal(
            i18n.split("'" + key + "':").length - 1,
            2,
            key,
        );
    }
});
