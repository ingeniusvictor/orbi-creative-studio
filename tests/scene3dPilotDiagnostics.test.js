const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

async function loadPanelModule() {
    return import('../src/components/Scene3DPilotDiagnosticsPanel.js');
}

function validStatus(overrides = {}) {
    return {
        ok: true,
        status: {
            enabled: true,
            mode: 'wsl',
            defaultOff: true,
            rendererCanConfigure: false,
            automaticR2Retry: false,
            reconciliationMutation: false,
            processStarted: false,
            recipes: [
                'orbi.blender.create_cube.v1',
                'orbi.blender.delete_object.v1',
            ],
            ...overrides,
        },
    };
}

test('QB-17 normalizes only enabled default-off read-only Scene3D status', async () => {
    const { normalizeScene3DStatus } = await loadPanelModule();

    const status = normalizeScene3DStatus(validStatus());

    assert.equal(status.enabled, true);
    assert.equal(status.mode, 'wsl');
    assert.equal(status.processStarted, false);
    assert.deepEqual(status.recipes, [
        'orbi.blender.create_cube.v1',
        'orbi.blender.delete_object.v1',
    ]);
    assert.equal(status.rendererCanConfigure, false);
    assert.equal(status.automaticR2Retry, false);
    assert.equal(status.reconciliationMutation, false);
});

test('QB-17 remains hidden for disabled or unavailable pilot state', async () => {
    const { normalizeScene3DStatus } = await loadPanelModule();

    assert.equal(normalizeScene3DStatus(null), null);
    assert.equal(normalizeScene3DStatus({ ok: false }), null);
    assert.equal(normalizeScene3DStatus(validStatus({ enabled: false })), null);
});

test('QB-17 rejects status that gains renderer authority or retry semantics', async () => {
    const { normalizeScene3DStatus } = await loadPanelModule();

    assert.equal(
        normalizeScene3DStatus(validStatus({ rendererCanConfigure: true })),
        null,
    );
    assert.equal(
        normalizeScene3DStatus(validStatus({ automaticR2Retry: true })),
        null,
    );
    assert.equal(
        normalizeScene3DStatus(validStatus({ reconciliationMutation: true })),
        null,
    );
    assert.equal(
        normalizeScene3DStatus(validStatus({ defaultOff: false })),
        null,
    );
});

test('QB-17 accepts only native or WSL launch-mode labels', async () => {
    const { normalizeScene3DStatus } = await loadPanelModule();

    assert.equal(normalizeScene3DStatus(validStatus({ mode: 'native' })).mode, 'native');
    assert.equal(normalizeScene3DStatus(validStatus({ mode: 'wsl' })).mode, 'wsl');
    assert.equal(normalizeScene3DStatus(validStatus({ mode: 'remote-http' })), null);
});

test('QB-17 diagnostics component calls only getStatus and contains no action button', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.ok(source.includes('window.orbiScene3D.getStatus()'));
    for (const forbidden of [
        '.sceneInfo(',
        '.objectInfo(',
        '.dryRunRecipe(',
        '.executeRecipe(',
        '.pendingRecoveries(',
        '.reconciliationHistory(',
        'reconcilePending',
        'retryExecution',
        "createElement('button')",
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }
});

test('QB-17 Settings mounts Scene3D diagnostics only beside existing diagnostics', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes("import { Scene3DPilotDiagnosticsPanel }"));
    assert.ok(settings.includes('const scene3dDiagnosticsPanel = isLocalAIAvailable()'));
    assert.ok(settings.includes('diagnosticsContainer.appendChild(diagnosticsPanel)'));
    assert.ok(settings.includes('diagnosticsContainer.appendChild(scene3dDiagnosticsPanel)'));
    assert.ok(settings.includes("if (id === 'diagnostics' && diagnosticsContainer)"));

    assert.equal(settings.includes('orbiScene3D.executeRecipe'), false);
    assert.equal(settings.includes('orbiScene3D.dryRunRecipe'), false);
    assert.equal(settings.includes('orbiScene3D.pendingRecoveries'), false);
});

test('QB-17 bilingual copy explicitly preserves the read-only boundary', () => {
    const i18n = read('src/lib/i18n.js');

    for (const key of [
        'scene3dDiagnostics.title',
        'scene3dDiagnostics.subtitle',
        'scene3dDiagnostics.mode',
        'scene3dDiagnostics.process',
        'scene3dDiagnostics.recipes',
        'scene3dDiagnostics.boundary',
    ]) {
        assert.equal((i18n.match(new RegExp(`'${key}'`, 'g')) || []).length, 2, key);
    }

    assert.ok(i18n.includes('does not start Python, Blender, or the sidecar'));
    assert.ok(i18n.includes('cannot execute recipes'));
});


test('QB-17 rejects unreviewed Scene3D recipe expansion', async () => {
    const { normalizeScene3DStatus } = await loadPanelModule();

    assert.equal(
        normalizeScene3DStatus(validStatus({
            recipes: [
                'orbi.blender.create_cube.v1',
                'orbi.blender.delete_object.v1',
                'orbi.blender.execute_python.v1',
            ],
        })),
        null,
    );
});
