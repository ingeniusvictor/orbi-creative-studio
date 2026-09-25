const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('QB-16 preload exposes exactly one narrow orbiScene3D capability', () => {
    const preload = read('electron/preload.js');

    assert.equal((preload.match(/exposeInMainWorld\('orbiScene3D'/g) || []).length, 1);

    for (const method of [
        'getStatus',
        'sceneInfo',
        'objectInfo',
        'dryRunRecipe',
        'executeRecipe',
        'pendingRecoveries',
        'reconciliationHistory',
    ]) {
        assert.ok(preload.includes(`${method}:`));
    }

    for (const forbidden of [
        'executeBlenderCode',
        'executePython',
        'setProvider',
        'setLedgerPath',
        'releaseReservation',
        'retryExecution',
        'reconcilePending',
    ]) {
        assert.equal(preload.includes(forbidden), false);
    }
});

test('QB-16 Electron main registers Scene3D bridge but never executes a recipe automatically', () => {
    const main = read('electron/main.js');

    assert.ok(main.includes("require('./lib/scene3dPilotBridge')"));
    assert.ok(main.includes('registerScene3DPilot({ appImpl: app })'));
    assert.ok(main.includes('scene3dPilotRegistration.shutdown()'));

    assert.equal(main.includes('.executeRecipe('), false);
    assert.equal(main.includes('execute_recipe'), false);
    assert.equal(main.includes('orbi.blender.create_cube.v1'), false);
});

test('QB-16 bridge authenticates every IPC path through one trusted wrapper', () => {
    const bridge = read('electron/lib/scene3dPilotBridge.js');

    assert.ok(bridge.includes('effectiveAssertTrustedSender(event)'));
    assert.ok(bridge.includes('function withTrust(handler)'));

    for (const channel of [
        'orbi-scene3d:status',
        'orbi-scene3d:scene-info',
        'orbi-scene3d:object-info',
        'orbi-scene3d:dry-run-recipe',
        'orbi-scene3d:execute-recipe',
        'orbi-scene3d:pending-recoveries',
        'orbi-scene3d:reconciliation-history',
    ]) {
        assert.ok(bridge.includes(channel));
    }
});

test('QB-16 renderer cannot supply execution request identity', () => {
    const preload = read('electron/preload.js');
    const bridge = read('electron/lib/scene3dPilotBridge.js');
    assert.equal(preload.includes('requestId: (requestId)'), false);
    assert.ok(bridge.includes('{ requestId: randomUUIDImpl() }'));
});

test('QB-16 product bridge changes neither Compute Router nor MHS authority', () => {
    const bridge = read('electron/lib/scene3dPilotBridge.js');

    assert.ok(bridge.includes('computeRouterAuthorityChanged: false'));
    assert.ok(bridge.includes('mhsActuationEnabled: false'));
    assert.ok(bridge.includes('productionCutoverAuthorized: false'));
});

test('QB-16 current renderer feature surfaces do not consume orbiScene3D yet', () => {
    const files = [
        'src/components/SettingsModal.js',
        'src/components/RouterDiagnosticsPanel.js',
        'src/components/ImageStudio.js',
        'src/components/VideoStudio.js',
    ];

    for (const path of files) {
        const source = read(path);
        assert.equal(source.includes('orbiScene3D'), false, path);
    }
});

test('QB-16 implementation contains no direct Qwen package import in Creative Studio', () => {
    const files = [
        'electron/lib/scene3dPilotConfig.js',
        'electron/lib/scene3dPilotPolicy.js',
        'electron/lib/scene3dSidecarClient.js',
        'electron/lib/scene3dPilotBridge.js',
        'electron/preload.js',
        'electron/main.js',
    ];

    for (const path of files) {
        const source = read(path);
        assert.equal(source.includes('qwen_mm_plugins'), false, path);
        assert.equal(source.includes('orbi_qwen_bridge'), false, path);
    }
});
