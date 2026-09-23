const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('QB-17 diagnostics panel is explicitly read-only', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.ok(source.includes("dataset.orbiScene3dDiagnostics = 'read-only'"));
    assert.ok(source.includes('scene3d.getStatus()'));
    assert.ok(source.includes('scene3d.sceneInfo()'));
    assert.ok(source.includes('scene3d.objectInfo(name)'));
    assert.ok(source.includes('scene3d.pendingRecoveries()'));
    assert.ok(source.includes('scene3d.reconciliationHistory()'));

    for (const forbidden of [
        'scene3d.executeRecipe',
        'scene3d.dryRunRecipe',
        'retryExecution',
        'releaseReservation',
        'reconcilePending',
        'executeBlenderCode',
        'executePython',
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }
});

test('QB-17 automatic panel load performs status only', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    const automaticMarker = '// Status is intentionally the only automatic request.';
    const markerIndex = source.indexOf(automaticMarker);
    assert.ok(markerIndex >= 0);

    const tail = source.slice(markerIndex);
    assert.ok(tail.includes('scene3d.getStatus()'));
    assert.equal(tail.includes('scene3d.sceneInfo()'), false);
    assert.equal(tail.includes('scene3d.objectInfo('), false);
    assert.equal(tail.includes('scene3d.pendingRecoveries()'), false);
    assert.equal(tail.includes('scene3d.reconciliationHistory('), false);
});

test('QB-17 settings tab exists only when Electron Scene3D bridge is exposed', () => {
    const source = read('src/components/SettingsModal.js');

    assert.ok(source.includes("Boolean(window.orbiScene3D?.isElectron)"));
    assert.ok(source.includes("{ id: 'scene3d', label: 'Scene3D' }"));
    assert.ok(source.includes(
        'Scene3DPilotDiagnosticsPanel({ scene3d: window.orbiScene3D })'
    ));
    assert.ok(source.includes(
        "if (id === 'scene3d' && scene3dDiagnosticsPanel)"
    ));
});

test('QB-17 diagnostics UI does not know provider, Python, SQLite, or launch paths', () => {
    const sources = [
        read('src/components/Scene3DPilotDiagnosticsPanel.js'),
        read('src/components/SettingsModal.js'),
    ].join('\n');

    for (const forbidden of [
        'qwen_mm_plugins',
        'qwen-mm-plugins',
        'qb15_scene3d_sidecar.py',
        'execution-ledger.sqlite3',
        'ORBI_SCENE3D_PYTHON',
        'ORBI_SCENE3D_SIDECAR_PATH',
        'ORBI_SCENE3D_WSL_REPO',
        'ORBI_SCENE3D_WSL_LEDGER',
    ]) {
        assert.equal(sources.includes(forbidden), false, forbidden);
    }
});

test('QB-17 diagnostics output is text-only and never uses innerHTML for provider data', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.ok(source.includes("output.textContent = pretty(result)"));
    assert.equal(source.includes('output.innerHTML'), false);
    assert.equal(source.includes('statusBox.innerHTML'), false);
    assert.ok(source.includes('statusBox.replaceChildren()'));
    assert.ok(source.includes("output.dataset.orbiScene3dOutput = 'sanitized'"));
});

test('QB-17 diagnostics output is bounded to protect renderer memory', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.ok(source.includes('const MAX_DIAGNOSTIC_CHARS = 65536'));
    assert.ok(source.includes('text.slice(0, MAX_DIAGNOSTIC_CHARS)'));
    assert.ok(source.includes('[diagnostic output truncated]'));
});

test('QB-17 diagnostics panel never changes Compute Router or MHS authority', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.equal(source.includes('orbiComputeRouter'), false);
    assert.equal(source.includes('orbiBenchmark'), false);
    assert.equal(source.includes('mhs'), false);
});


test('QB-17 provider-touching actions are fail-closed until enabled status arrives', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.ok(source.includes('function setEnabledActions(enabled)'));
    assert.ok(source.includes('objectInput.disabled = !enabled'));
    assert.ok(source.includes("actions.querySelectorAll('[data-requires-enabled=\"true\"]')"));
    assert.ok(source.includes('node.disabled = !enabled'));
    assert.ok(source.includes('setEnabledActions(false);'));
    assert.ok(source.includes(
        "const enabled = Boolean(value && value.ok === true && value.status?.enabled === true)"
    ));
    assert.ok(source.includes('setEnabledActions(enabled);'));

    const initialDisable = source.indexOf('setEnabledActions(false);');
    const automaticStatus = source.indexOf('scene3d.getStatus()');
    assert.ok(initialDisable >= 0);
    assert.ok(automaticStatus > initialDisable);
});
