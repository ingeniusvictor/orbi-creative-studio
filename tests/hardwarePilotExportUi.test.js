const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C64 exposes an explicit hardware pilot export action only after 3/3 samples', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiHardwarePilotExport = 'user-initiated-evidence-export'"));
    assert.ok(panel.includes("button.dataset.orbiHardwarePilotExport = 'explicit-user-save'"));
    assert.ok(panel.includes("benchmarkSessionState?.readyForReview !== true"));
    assert.ok(panel.includes("pilot.status === 'HARDWARE_PILOT_EVIDENCE_READY'"));
    assert.ok(panel.includes("result?.status === 'HARDWARE_PILOT_EXPORT_CANCELED'"));
    assert.ok(panel.includes("result.status !== 'HARDWARE_PILOT_EXPORT_WRITTEN'"));
});

test('P1C64 Settings wires only the governed bundle builder and narrow Electron export bridge', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes('buildUserHardwarePilotEvidenceBundle'));
    assert.ok(settings.includes('hardwarePilotBundleBuild: buildUserHardwarePilotEvidenceBundle'));
    assert.ok(settings.includes("hardwarePilotExport: (bundle) => window.orbiBenchmark?.exportPilotBundle(bundle)"));
    assert.equal(settings.includes('showSaveDialog'), false);
    assert.equal(settings.includes('filePath'), false);
    assert.equal(settings.includes('fs.'), false);
});

test('P1C64 UI never renders destination paths, raw pilot evidence, or hardware identity', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    for (const forbidden of [
        'filePath',
        'destination',
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'device.description',
        'result.reason',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected pilot UI exposure: ${forbidden}`);
    }

    assert.ok(panel.includes('exportResult.fileName'));
    assert.ok(panel.includes('exportResult.sha256'));
    assert.ok(panel.includes('exportResult.bytes'));
});

test('P1C64 validates the non-authorizing export result before displaying it', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('result.routingEligible !== false'));
    assert.ok(panel.includes('result.cutoverAuthorized !== false'));
    assert.ok(panel.includes("result.executionAuthority !== 'legacy-dispatcher-only'"));
    assert.ok(panel.includes("/^[a-f0-9]{64}$/.test(result.sha256)"));
    assert.ok(panel.includes("/[\\\\/]/.test(result.fileName)"));
});

test('P1C64 export copy exists in English and Chinese', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.hardwarePilotExportTitle',
        'routerDiagnostics.hardwarePilotExportSubtitle',
        'routerDiagnostics.hardwarePilotExportReady',
        'routerDiagnostics.hardwarePilotExportNeedsSamples',
        'routerDiagnostics.hardwarePilotExportAction',
        'routerDiagnostics.hardwarePilotExportRunning',
        'routerDiagnostics.hardwarePilotExportWritten',
        'routerDiagnostics.hardwarePilotExportCanceled',
        'routerDiagnostics.hardwarePilotExportRejected',
        'routerDiagnostics.hardwarePilotExportFile',
        'routerDiagnostics.hardwarePilotExportSha256',
        'routerDiagnostics.hardwarePilotExportBytes',
        'routerDiagnostics.hardwarePilotExportBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});