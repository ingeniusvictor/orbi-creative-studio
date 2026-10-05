const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C66 Settings binds the no-argument Electron import action into diagnostics', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes("import { HardwarePilotImportPanel } from './HardwarePilotImportPanel.js';"));
    assert.ok(settings.includes("typeof window.orbiBenchmark?.importPilotBundle === 'function'"));
    assert.ok(settings.includes('diagnosticsPanel.appendChild(HardwarePilotImportPanel({'));
    assert.ok(settings.includes('hardwarePilotImport: () => window.orbiBenchmark.importPilotBundle()'));
    assert.equal(settings.includes('importPilotBundle(file'), false);
    assert.equal(settings.includes('showOpenDialog'), false);
    assert.equal(settings.includes('readFile'), false);
});

test('P1C66 exposes explicit user import and handles cancellation without retaining metadata', () => {
    const panel = read('src/components/HardwarePilotImportPanel.js');

    assert.ok(panel.includes("section.dataset.orbiHardwarePilotImport = 'user-initiated-review-intake'"));
    assert.ok(panel.includes("button.dataset.orbiHardwarePilotImport = 'explicit-user-open'"));
    assert.ok(panel.includes('const result = await hardwarePilotImport();'));
    assert.ok(panel.includes("result?.status === 'HARDWARE_PILOT_IMPORT_CANCELED'"));
    assert.ok(panel.includes("result.status !== 'HARDWARE_PILOT_IMPORT_REVIEW_READY'"));
});

test('P1C66 validates current-contract non-authorizing intake metadata before display', () => {
    const panel = read('src/components/HardwarePilotImportPanel.js');

    for (const expected of [
        "result.sampleCount !== 3",
        "result.evidenceClass !== 'real-runtime-hardware-pilot'",
        'result.cryptographicAuthenticityVerified !== false',
        'result.importedFileHashVerified !== true',
        'result.revalidatedAgainstCurrentContract !== true',
        'result.requiresHumanReview !== true',
        'result.productionProfilePromoted !== false',
        'result.routingEligible !== false',
        'result.cutoverAuthorized !== false',
        "result.executionAuthority !== 'legacy-dispatcher-only'",
        "/^[a-f0-9]{64}$/.test(result.sha256)",
        "/[\\\\/]/.test(result.fileName)",
    ]) {
        assert.ok(panel.includes(expected), `missing governed import validation: ${expected}`);
    }
});

test('P1C66 UI never references raw evidence, local locations, device identity, or internal artifact hashes', () => {
    const panel = read('src/components/HardwarePilotImportPanel.js');

    for (const forbidden of [
        'filePath',
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'runEvidence',
        'performanceEvidence',
        'provenance',
        'result.reason',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected import UI exposure: ${forbidden}`);
    }

    assert.ok(panel.includes('importResult.fileName'));
    assert.ok(panel.includes('importResult.sha256'));
    assert.ok(panel.includes('importResult.target'));
    assert.ok(panel.includes('importResult.sampleCount'));
});

test('P1C66 import UI includes English and Chinese governed-review copy', () => {
    const panel = read('src/components/HardwarePilotImportPanel.js');

    assert.ok(panel.includes('Hardware pilot evidence import'));
    assert.ok(panel.includes('Import hardware pilot JSON'));
    assert.ok(panel.includes('硬件试点证据导入'));
    assert.ok(panel.includes('导入硬件试点 JSON'));
    assert.ok(panel.includes('Human review is still required'));
    assert.ok(panel.includes('仍需人工审核'));
});
