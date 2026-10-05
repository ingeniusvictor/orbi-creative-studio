const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

test('P1C67 review bridge reads imported evidence only inside trusted Electron Main', () => {
    const bridge = read('electron/lib/hardwarePilotReviewBridge.js');
    const preload = read('electron/preload.js');
    const main = read('electron/main.js');

    assert.ok(bridge.includes("const REVIEW_CHANNEL = 'compute-router:hardware-pilot-review'"));
    assert.ok(bridge.includes('assertTrustedSender(event)'));
    assert.ok(bridge.includes('readImportedBundle(sha256)'));
    assert.ok(bridge.includes('buildHardwarePilotReviewProjection({ sha256, bundle })'));
    assert.ok(preload.includes("reviewPilotBundle: (sha256) => ipcRenderer.invoke('compute-router:hardware-pilot-review', sha256)"));
    assert.ok(main.includes("require('./lib/hardwarePilotReviewBridge')"));
    assert.ok(main.includes('registerHardwarePilotReview();'));
});

test('P1C68 renderer can submit only SHA, decision and review note', () => {
    const bridge = read('electron/lib/hardwarePilotReviewBridge.js');
    const preload = read('electron/preload.js');
    const panel = read('src/components/HardwarePilotImportPanel.js');

    assert.ok(bridge.includes("keys[0] === 'decision'"));
    assert.ok(bridge.includes("keys[1] === 'reviewNote'"));
    assert.ok(bridge.includes("keys[2] === 'sha256'"));
    assert.ok(preload.includes("decidePilotBundle: (request) => ipcRenderer.invoke('compute-router:hardware-pilot-review-decision', request)"));
    assert.ok(panel.includes('sha256: importResult.sha256'));
    assert.ok(panel.includes('reviewNote: noteValue.trim()'));
    assert.ok(panel.includes("approveButton.onclick = () => decide('approve')"));
    assert.ok(panel.includes("rejectButton.onclick = () => decide('reject')"));
});

test('P1C67-P1C69 UI displays safe measurements without raw evidence internals', () => {
    const panel = read('src/components/HardwarePilotImportPanel.js');

    assert.ok(panel.includes("reviewButton.dataset.orbiHardwarePilotReview = 'explicit-human-review'"));
    assert.ok(panel.includes('reviewResult.timing.averageDurationMs'));
    assert.ok(panel.includes('reviewResult.observedResources.peakSystemRamMiB'));
    assert.ok(panel.includes('reviewResult.runs.forEach((run) => {'));
    assert.ok(panel.includes("profile.status !== 'pilot-certified'"));
    assert.ok(panel.includes("profile.certificationScope !== 'hardware-pilot-evidence-review-only'"));

    for (const forbidden of [
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected review UI exposure: ${forbidden}`);
    }
});

test('P1C69 profile remains explicitly non-authorizing in core and UI', () => {
    const core = read('electron/lib/hardwarePilotReviewCore.js');
    const panel = read('src/components/HardwarePilotImportPanel.js');

    assert.ok(core.includes("profileType: 'p1c69-human-reviewed-hardware-pilot-profile'"));
    assert.ok(core.includes("certificationScope: 'hardware-pilot-evidence-review-only'"));
    assert.ok(core.includes('productionProfilePromoted: false'));
    assert.ok(core.includes('routingEligible: false'));
    assert.ok(core.includes('cutoverAuthorized: false'));
    assert.ok(core.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.ok(panel.includes('This profile is evidence-scoped only. It cannot route traffic or authorize cutover.'));
});

test('Settings preserves old diagnostics mounting while wiring review actions', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes("typeof window.orbiBenchmark?.reviewPilotBundle === 'function'"));
    assert.ok(settings.includes("typeof window.orbiBenchmark?.decidePilotBundle === 'function'"));
    assert.ok(settings.includes('hardwarePilotReview: (sha256) => window.orbiBenchmark.reviewPilotBundle(sha256)'));
    assert.ok(settings.includes('hardwarePilotDecision: (request) => window.orbiBenchmark.decidePilotBundle(request)'));
    assert.equal((settings.match(/diagnosticsPanel/g) || []).length, 3);
});
