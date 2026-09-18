const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function readiness({
    backend = 'cuda12',
    models = [{ id: 'z-image-turbo', provider: 'sdcpp', state: 'downloaded' }],
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
        capturedAt: '2026-09-16T12:00:00.000Z',
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

test('P1C16 resolves one downloaded target and runs P1C15 with an empty governed registry', async () => {
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

    const result = await controller.refresh();
    assert.equal(result.status, 'USER_SHADOW_DIAGNOSTIC_REFRESH_UPDATED');
    assert.deepEqual(result.context, {
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.equal(result.compatibilityStatus, 'COMPATIBILITY_UNKNOWN');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    assert.equal(received.modelId, 'z-image-turbo');
    assert.equal(received.backend, 'cuda12');
    assert.equal(received.width, 1024);
    assert.equal(received.height, 1024);
    assert.equal(received.registry.mode, 'immutable-shadow-registry');
    assert.equal(received.registry.size, 0);
    assert.equal(received.registry.routingEligible, false);
});

test('P1C16 refuses to silently choose between multiple downloaded diagnostic targets', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    let diagnosticCalled = false;
    const controller = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness({
                models: [
                    { id: 'z-image-turbo', provider: 'sdcpp', state: 'downloaded' },
                    { id: 'stable-diffusion-xl-base', provider: 'sdcpp', state: 'downloaded' },
                ],
            }),
        }),
        runDiagnostic: async () => {
            diagnosticCalled = true;
            return safeDiagnostic();
        },
    });

    const result = await controller.refresh();
    assert.equal(result.status, 'USER_SHADOW_DIAGNOSTIC_REFRESH_REJECTED');
    assert.equal(result.reason, 'REFRESH_DIAGNOSTIC_CONTEXT_AMBIGUOUS');
    assert.equal(diagnosticCalled, false);
});

test('P1C16 rejects unsupported backend and absent known downloaded model without guessing', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');

    const vulkan = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness({ backend: 'vulkan' }),
        }),
        runDiagnostic: async () => safeDiagnostic(),
    });
    assert.equal((await vulkan.refresh()).reason, 'REFRESH_RUNTIME_BACKEND_UNAVAILABLE');

    const noModel = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness({
                models: [{ id: 'not-a-certified-target', provider: 'sdcpp', state: 'downloaded' }],
            }),
        }),
        runDiagnostic: async () => safeDiagnostic(),
    });
    assert.equal((await noModel.refresh()).reason, 'REFRESH_NO_DIAGNOSTIC_MODEL');
});

test('P1C16 fails closed on bridge, registry and downstream authority failures', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');

    const bridgeUnavailable = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => null,
        runDiagnostic: async () => safeDiagnostic(),
    });
    assert.equal((await bridgeUnavailable.refresh()).reason, 'REFRESH_BRIDGE_UNAVAILABLE');

    const readinessFailure = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => { throw new Error('readiness secret'); },
        }),
        runDiagnostic: async () => safeDiagnostic(),
    });
    const failedReadiness = await readinessFailure.refresh();
    assert.equal(failedReadiness.reason, 'REFRESH_READINESS_FAILED');
    assert.equal(JSON.stringify(failedReadiness).includes('readiness secret'), false);

    const invalidRegistry = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        }),
        createRegistry: () => ({ status: 'bad' }),
        runDiagnostic: async () => safeDiagnostic(),
    });
    assert.equal((await invalidRegistry.refresh()).reason, 'REFRESH_REGISTRY_INVALID');

    const forgedDiagnostic = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        }),
        runDiagnostic: async () => ({ ...safeDiagnostic(), routingEligible: true }),
    });
    assert.equal((await forgedDiagnostic.refresh()).reason, 'REFRESH_DIAGNOSTIC_AUTHORITY_INVALID');
});

test('P1C16 maps unchanged without adding routing or cutover authority', async () => {
    const refreshModule = await import('../src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const controller = refreshModule.createUserShadowDiagnosticRefresh({
        getBridge: () => ({
            isElectron: true,
            getReadinessSnapshot: async () => readiness(),
        }),
        runDiagnostic: async () => safeDiagnostic('SHADOW_DIAGNOSTIC_ORCHESTRATOR_UNCHANGED'),
    });

    const result = await controller.refresh();
    assert.equal(result.status, 'USER_SHADOW_DIAGNOSTIC_REFRESH_UNCHANGED');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
});

test('P1C16 UI exposes exactly one additional diagnostic-only action', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');
    const settings = read('src/components/SettingsModal.js');
    const i18n = read('src/lib/i18n.js');

    assert.ok(panel.includes("refreshButton.dataset.orbiShadowRefresh = 'diagnostic-only'"));
    assert.ok(panel.includes('refreshButton.onclick = onRefresh'));
    assert.ok(panel.includes('shadowDiagnosticRefresh = null'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 2);

    assert.ok(settings.includes('runUserShadowDiagnosticRefresh'));
    assert.ok(settings.includes('shadowDiagnosticRefresh: runUserShadowDiagnosticRefresh'));

    for (const key of [
        'routerDiagnostics.shadowRefresh',
        'routerDiagnostics.shadowRefreshRunning',
        'routerDiagnostics.shadowRefreshUpdated',
        'routerDiagnostics.shadowRefreshUnchanged',
        'routerDiagnostics.shadowRefreshRejected',
    ]) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C16 remains outside startup and generation execution', () => {
    const controller = read('src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const token of [
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'setInterval',
        'setTimeout',
        'routeGenerationRequest',
        'generate(',
    ]) {
        assert.equal(controller.includes(token), false, `unexpected P1C16 capability: ${token}`);
    }

    for (const source of [main, image, video]) {
        assert.equal(source.includes('userShadowDiagnosticRefresh'), false);
        assert.equal(source.includes('runUserShadowDiagnosticRefresh'), false);
    }

    assert.ok(controller.includes('loadRuntimeCertifiedResourceProfileRegistry'));
    assert.equal(controller.includes('createCertifiedResourceProfileRegistry'), false);
    assert.ok(controller.includes('routingEligible: false'));
    assert.ok(controller.includes('cutoverAuthorized: false'));
    assert.ok(controller.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.equal(controller.includes('routingEligible: true'), false);
    assert.equal(controller.includes('cutoverAuthorized: true'), false);
});
