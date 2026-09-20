const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function readiness({
    backend = 'cuda12',
    models = [
        { id: 'z-image-turbo', provider: 'sdcpp', state: 'downloaded' },
        { id: 'stable-diffusion-xl-base', provider: 'sdcpp', state: 'downloaded' },
    ],
} = {}) {
    return {
        schemaVersion: 1,
        sdcpp: {
            binaryStatus: {
                exists: true,
                runtime: {
                    backend,
                    manifestPinned: true,
                    installationIntegrityVerified: true,
                },
            },
            models,
            hardwareSnapshot: {
                platform: 'win32',
                arch: 'x64',
                totalMemoryMiB: 32768,
                nvidiaAvailable: true,
                nvidiaMaxVramMiB: 12288,
            },
        },
    };
}

function safeDiagnostic(status = 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_PUBLISHED') {
    return {
        status,
        reason: null,
        stage: 'complete',
        capturedAt: '2026-09-18T12:00:00.000Z',
        compatibilityStatus: 'COMPATIBILITY_UNKNOWN',
        handoffStatus: status === 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_UNCHANGED'
            ? 'SHADOW_SNAPSHOT_HANDOFF_UNCHANGED'
            : 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED',
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

test('P1C17 lists only downloaded known diagnostic targets in deterministic order', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const previousWindow = global.window;
    global.window = {
        orbiComputeRouter: {
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        },
    };

    try {
        const result = await refreshModule.listUserShadowDiagnosticTargets();
        assert.equal(result.status, 'USER_SHADOW_DIAGNOSTIC_TARGETS_READY');
        assert.equal(result.reason, null);
        assert.deepEqual(result.targets, [
            {
                modelId: 'stable-diffusion-xl-base',
                backend: 'cuda12',
                width: 1024,
                height: 1024,
            },
            {
                modelId: 'z-image-turbo',
                backend: 'cuda12',
                width: 1024,
                height: 1024,
            },
        ]);
        assert.equal(result.routingEligible, false);
        assert.equal(result.cutoverAuthorized, false);
        assert.equal(Object.isFrozen(result.targets), true);
    } finally {
        global.window = previousWindow;
    }
});

test('P1C17 explicit selected target resolves exact context when multiple models are installed', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    let received = null;
    const controller = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        }),
        runDiagnostic: async (input) => {
            received = input;
            return safeDiagnostic();
        },
    });

    const selected = {
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    };
    const result = await controller.refresh(selected);

    assert.equal(result.status, 'USER_SHADOW_DIAGNOSTIC_REFRESH_UPDATED');
    assert.deepEqual(result.context, selected);
    assert.equal(received.modelId, selected.modelId);
    assert.equal(received.backend, selected.backend);
    assert.equal(received.width, selected.width);
    assert.equal(received.height, selected.height);
    assert.equal(received.registry.mode, 'immutable-shadow-registry');
});

test('P1C17 rejects invalid or unavailable selected targets without invoking P1C15', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    let calls = 0;
    const controller = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        }),
        runDiagnostic: async () => {
            calls += 1;
            return safeDiagnostic();
        },
    });

    const invalid = await controller.refresh({
        modelId: '',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.equal(invalid.reason, 'REFRESH_SELECTED_CONTEXT_INVALID');

    const unavailable = await controller.refresh({
        modelId: 'dreamshaper-8',
        backend: 'cuda12',
        width: 512,
        height: 512,
    });
    assert.equal(unavailable.reason, 'REFRESH_SELECTED_CONTEXT_UNAVAILABLE');
    assert.equal(calls, 0);
});

test('P1C17 keeps P1C16 fail-closed ambiguity when no explicit selection is supplied', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const controller = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        }),
        runDiagnostic: async () => safeDiagnostic(),
    });

    const result = await controller.refresh();
    assert.equal(result.status, 'USER_SHADOW_DIAGNOSTIC_REFRESH_REJECTED');
    assert.equal(result.reason, 'REFRESH_DIAGNOSTIC_CONTEXT_AMBIGUOUS');
});

test('P1C17 target listing rejects unavailable bridge and unsafe readiness without reflecting errors', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const previousWindow = global.window;

    try {
        global.window = {};
        const noBridge = await refreshModule.listUserShadowDiagnosticTargets();
        assert.equal(noBridge.status, 'USER_SHADOW_DIAGNOSTIC_TARGETS_REJECTED');
        assert.equal(noBridge.reason, 'TARGETS_BRIDGE_UNAVAILABLE');

        global.window = {
            orbiComputeRouter: {
                isElectron: true,
                getReadinessSnapshot: async () => { throw new Error('target-list secret'); },
            },
        };
        const failed = await refreshModule.listUserShadowDiagnosticTargets();
        assert.equal(failed.reason, 'TARGETS_READINESS_FAILED');
        assert.equal(JSON.stringify(failed).includes('target-list secret'), false);
    } finally {
        global.window = previousWindow;
    }
});

test('P1C17 UI adds a diagnostic-only selector without adding another onclick action', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');
    const settings = read('src/components/SettingsModal.js');
    const i18n = read('src/lib/i18n.js');

    assert.ok(panel.includes("select.dataset.orbiShadowTargetSelector = 'diagnostic-only'"));
    assert.ok(panel.includes('select.onchange = () => onTargetChange(select.value)'));
    assert.ok(panel.includes('shadowDiagnosticTargetsProvider = null'));
    assert.ok(panel.includes('normalizeShadowDiagnosticTargets'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 6);
    assert.equal((panel.match(/\.onchange\s*=/g) || []).length, 1);

    assert.ok(settings.includes('listUserShadowDiagnosticTargets'));
    assert.ok(settings.includes('shadowDiagnosticTargetsProvider: listUserShadowDiagnosticTargets'));

    for (const key of [
        'routerDiagnostics.shadowTarget',
        'routerDiagnostics.shadowTargetSelect',
        'routerDiagnostics.shadowSelectionRequired',
    ]) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C17 target selection stays outside startup and generation execution', () => {
    const controller = read('src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const panel = read('src/components/RouterDiagnosticsPanel.js');
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const token of [
        'routeGenerationRequest',
        'localAI.generate',
        'muapi.generate',
    ]) {
        assert.equal(controller.includes(token), false);
        assert.equal(panel.includes(token), false);
    }

    for (const source of [main, image, video]) {
        assert.equal(source.includes('listUserShadowDiagnosticTargets'), false);
        assert.equal(source.includes('shadowDiagnosticTargetsProvider'), false);
    }

    assert.ok(controller.includes('routingEligible: false'));
    assert.ok(controller.includes('cutoverAuthorized: false'));
    assert.ok(controller.includes("executionAuthority: 'legacy-dispatcher-only'"));
});
