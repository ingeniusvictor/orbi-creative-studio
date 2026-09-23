const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('QB-21 cumulative Scene3D stack remains default OFF at both authority layers', () => {
    const config = read('electron/lib/scene3dPilotConfig.js');

    assert.ok(config.includes("const FEATURE_ENV = 'ORBI_SCENE3D_PILOT_ENABLED'"));
    assert.ok(config.includes("const EXECUTION_ENV = 'ORBI_SCENE3D_EXECUTION_ENABLED'"));
    assert.ok(config.includes('const executionEnabled = enabled && parseEnabled(env[EXECUTION_ENV])'));
    assert.ok(config.includes('executionDefaultOff: true'));
});

test('QB-21 cumulative Scene3D stack preserves no automatic R2 retry', () => {
    const config = read('electron/lib/scene3dPilotConfig.js');
    const client = read('electron/lib/scene3dSidecarClient.js');
    const review = read('electron/lib/scene3dExecutionReview.js');

    assert.ok(config.includes('automaticR2Retry: false'));
    assert.ok(client.includes('automaticRetry: false'));
    assert.equal(client.includes('retry('), false);
    assert.equal(review.includes('retry('), false);
});

test('QB-21 cumulative stack exposes no renderer reconciliation mutation', () => {
    const preload = read('electron/preload.js');
    const diagnostics = read('src/components/Scene3DPilotDiagnosticsPanel.js');
    const execution = read('src/components/Scene3DExecutionReviewPanel.js');

    for (const source of [preload, diagnostics, execution]) {
        for (const forbidden of [
            'reconcilePending',
            'releaseReservation',
            'setLedgerPath',
            'setProvider',
            'executeBlenderCode',
            'executePython',
        ]) {
            assert.equal(source.includes(forbidden), false, forbidden);
        }
    }
});

test('QB-21 Scene3D stack does not expand Compute Router or MHS authority', () => {
    const bridge = read('electron/lib/scene3dPilotBridge.js');

    assert.ok(bridge.includes('computeRouterAuthorityChanged: false'));
    assert.ok(bridge.includes('mhsActuationEnabled: false'));
    assert.ok(bridge.includes('productionCutoverAuthorized: false'));
});

test('QB-21 renderer components contain no Qwen/provider implementation names', () => {
    const renderer = [
        read('src/components/Scene3DPilotDiagnosticsPanel.js'),
        read('src/components/Scene3DExecutionReviewPanel.js'),
        read('src/components/SettingsModal.js'),
    ].join('\n');

    for (const forbidden of [
        'qwen_mm_plugins',
        'qwen-mm-plugins',
        'orbi_qwen_bridge',
        'execute_blender_code',
        'qb15_scene3d_sidecar.py',
    ]) {
        assert.equal(renderer.includes(forbidden), false, forbidden);
    }
});

test('QB-21 review token and execution request identity have separate ownership', () => {
    const bridge = read('electron/lib/scene3dPilotBridge.js');
    const ui = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(bridge.includes('reviewTokenImpl = randomUUID'));
    assert.ok(bridge.includes('{ requestId: randomUUIDImpl() }'));
    assert.ok(ui.includes('reviewToken: token'));
    assert.equal(ui.includes('requestId:'), false);
});


test('QB-21 live smoke owns its side effects and never retries execution', () => {
    const smoke = read('scripts/qb21-scene3d-governed-e2e-smoke.js');

    assert.ok(smoke.includes("const NAME = 'ORBI_QB21_Cube'"));
    assert.ok(smoke.includes('let created = false'));
    assert.ok(smoke.includes('created = true'));
    assert.ok(smoke.includes('if (created)'));
    assert.ok(smoke.includes('already exists; refusing to touch it'));

    assert.equal(smoke.includes('retryExecution'), false);
    assert.equal(smoke.includes('setInterval('), false);
    assert.equal(smoke.includes('while ('), false);

    const executeCalls = smoke.match(/ipc\.invoke\(CHANNELS\.executeRecipe/g) || [];
    assert.ok(executeCalls.length >= 3);
    assert.ok(smoke.includes('SCENE3D_REVIEW_MISMATCH'));
    assert.ok(smoke.includes('SCENE3D_REVIEW_REQUIRED'));
});
