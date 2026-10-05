const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function readyResult(overrides = {}) {
    return {
        status: 'HARDWARE_PILOT_IMPORT_REVIEW_READY',
        fileName: 'orbi-hardware-pilot.json',
        sha256: 'a'.repeat(64),
        bytes: 4096,
        target: {
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 1024,
            height: 1024,
        },
        sampleCount: 3,
        capturedFrom: '2026-10-05T01:00:00.000Z',
        capturedTo: '2026-10-05T01:02:00.000Z',
        evidenceClass: 'real-runtime-hardware-pilot',
        cryptographicAuthenticityVerified: false,
        importedFileHashVerified: true,
        revalidatedAgainstCurrentContract: true,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...overrides,
    };
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

test('P1C66 normalizes only current-contract non-authorizing intake metadata', async () => {
    const moduleUrl = pathToFileURL(
        require.resolve('../src/components/HardwarePilotImportPanel.js'),
    ).href;
    const { normalizeHardwarePilotImportResult } = await import(moduleUrl);

    const normalized = normalizeHardwarePilotImportResult(readyResult());
    assert.ok(normalized);
    assert.equal(normalized.sampleCount, 3);
    assert.equal(normalized.revalidatedAgainstCurrentContract, true);
    assert.equal(normalized.requiresHumanReview, true);
    assert.equal(normalized.productionProfilePromoted, false);
    assert.equal(normalized.routingEligible, false);
    assert.equal(normalized.cutoverAuthorized, false);
    assert.equal(normalized.executionAuthority, 'legacy-dispatcher-only');

    assert.equal(normalizeHardwarePilotImportResult(readyResult({ routingEligible: true })), null);
    assert.equal(normalizeHardwarePilotImportResult(readyResult({ productionProfilePromoted: true })), null);
    assert.equal(normalizeHardwarePilotImportResult(readyResult({ sampleCount: 2 })), null);
    assert.equal(normalizeHardwarePilotImportResult(readyResult({ sha256: 'bad' })), null);
    assert.equal(normalizeHardwarePilotImportResult(readyResult({ fileName: '../pilot.json' })), null);
    assert.equal(normalizeHardwarePilotImportResult(readyResult({ revalidatedAgainstCurrentContract: false })), null);
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
