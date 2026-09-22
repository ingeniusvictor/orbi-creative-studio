const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C64 Settings injects one governed hardware-pilot export action into Router Diagnostics', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes("from '../lib/computeRouter/userHardwarePilotExport.mjs'"));
    assert.ok(settings.includes('exportUserHardwarePilotEvidence'));
    assert.ok(settings.includes('hardwarePilotExport: exportUserHardwarePilotEvidence'));
    assert.equal((settings.match(/hardwarePilotExport:/g) || []).length, 1);
});

test('P1C64 Router Diagnostics exposes one explicit export button only after a 3/3 session is ready', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiHardwarePilotExport = 'explicit-user-action'"));
    assert.ok(panel.includes("button.dataset.orbiHardwarePilotExportAction = 'user-initiated-export'"));
    assert.ok(panel.includes("button.disabled = !ready || actionStatus === 'running'"));
    assert.ok(panel.includes("const ready = Boolean(target) && sessionState?.readyForReview === true"));
    assert.ok(panel.includes('const result = await hardwarePilotExport(selectedBenchmarkTarget)'));
    assert.ok(panel.includes("result.status === 'USER_HARDWARE_PILOT_EXPORT_WRITTEN'"));
    assert.ok(panel.includes("result.status === 'USER_HARDWARE_PILOT_EXPORT_CANCELED'"));
});

test('P1C64 UI renders only basename, byte count and verified SHA-256 from the export result', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('summary.fileName'));
    assert.ok(panel.includes('summary.bytes'));
    assert.ok(panel.includes('summary.sha256'));
    assert.ok(panel.includes("sha.dataset.orbiHardwarePilotSha256 = 'verified-export-hash'"));

    for (const forbidden of [
        'summary.filePath',
        'summary.path',
        'result.filePath',
        'result.path',
        'binaryPath',
        'modelPath',
        'selectedDeviceName',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected UI exposure: ${forbidden}`);
    }
});

test('P1C64 panel keeps the Electron bridge indirect through dependency injection', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');
    const action = read('src/lib/computeRouter/userHardwarePilotExport.mjs');

    assert.equal(panel.includes('window.orbiBenchmark'), false);
    assert.equal(panel.includes('ipcRenderer'), false);
    assert.ok(action.includes('window.orbiBenchmark || null'));
    assert.ok(action.includes('bridge.exportPilotBundle(pilot.bundle)'));
    assert.equal(action.includes("from 'node:fs'"), false);
    assert.equal(action.includes('filePath'), true, 'result validation should explicitly reject filePath');
});

test('P1C64 export state resets when the diagnostic target changes', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("hardwarePilotExportActionStatus = 'idle'"));
    assert.ok(panel.includes('hardwarePilotExportSummary = null'));
    assert.ok(panel.includes('selectedShadowTargetKey = shadowDiagnosticTargets'));
});

test('P1C64 export UI copy exists in English and Chinese', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.hardwarePilotExportTitle',
        'routerDiagnostics.hardwarePilotExportSubtitle',
        'routerDiagnostics.hardwarePilotExportReady',
        'routerDiagnostics.hardwarePilotExportNeedsSamples',
        'routerDiagnostics.hardwarePilotExportButton',
        'routerDiagnostics.hardwarePilotExportRunning',
        'routerDiagnostics.hardwarePilotExportWritten',
        'routerDiagnostics.hardwarePilotExportCanceled',
        'routerDiagnostics.hardwarePilotExportRejected',
        'routerDiagnostics.hardwarePilotExportFile',
        'routerDiagnostics.hardwarePilotExportBytes',
        'routerDiagnostics.hardwarePilotExportSha256',
        'routerDiagnostics.hardwarePilotExportBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C64 export action remains non-routing and does not mutate certification state', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');
    const action = read('src/lib/computeRouter/userHardwarePilotExport.mjs');

    for (const source of [panel, action]) {
        assert.equal(source.includes('routingEligible === true'), false);
        assert.equal(source.includes('cutoverAuthorized === true'), false);
    }
    assert.ok(action.includes('exportOnly: true'));
    assert.ok(action.includes('productionProfilePromoted: false'));
    assert.ok(action.includes('routingEligible: false'));
    assert.ok(action.includes('cutoverAuthorized: false'));
    assert.equal(action.includes('runtimeCertificationPromotion'), false);
});
