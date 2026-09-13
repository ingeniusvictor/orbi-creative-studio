const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('Router diagnostics panel is read-only and consumes only session diagnostic APIs', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    for (const token of [
        'buildCurrentStudioParityDiagnosticReport',
        'formatCurrentStudioParityDiagnosticReport',
        'getStudioParitySessionState',
        "panel.dataset.orbiRouterDiagnostics = 'read-only'",
    ]) {
        assert.ok(panel.includes(token), `missing diagnostics dependency/invariant: ${token}`);
    }

    const forbidden = [
        'localAI',
        'muapi.',
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'setMuapiCredential',
        'clearStudioParitySessionEvidence',
        'window.orbiComputeRouter',
        'enableFallback',
        'routeGenerationRequest',
    ];
    assert.deepEqual(forbidden.filter((token) => panel.includes(token)), []);

    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 1);
    assert.ok(panel.includes('refresh.onclick = render'));
});

test('Settings exposes diagnostics exactly once and only inside the Electron-only tab set', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.equal((settings.match(/RouterDiagnosticsPanel/g) || []).length, 2);
    assert.equal((settings.match(/id: 'diagnostics'/g) || []).length, 1);
    assert.equal((settings.match(/diagnosticsPanel/g) || []).length, 3);
    assert.ok(settings.includes("...(isLocalAIAvailable() ? ["));
    assert.ok(settings.includes("{ id: 'diagnostics', label: t('settings.routerDiagnostics') }"));
    assert.ok(settings.includes("const diagnosticsPanel = isLocalAIAvailable() ? RouterDiagnosticsPanel() : null;"));
    assert.ok(settings.includes("if (id === 'diagnostics' && diagnosticsPanel) body.appendChild(diagnosticsPanel);"));
});

test('diagnostics UI copy exists in both English and Chinese dictionaries', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'settings.routerDiagnostics',
        'routerDiagnostics.title',
        'routerDiagnostics.subtitle',
        'routerDiagnostics.refresh',
        'routerDiagnostics.sessionSamples',
        'routerDiagnostics.observedRoutes',
        'routerDiagnostics.targets',
        'routerDiagnostics.certification',
        'routerDiagnostics.targetRoutes',
        'routerDiagnostics.textReport',
        'routerDiagnostics.readOnlyNote',
        'routerDiagnostics.unavailable',
        'routerDiagnostics.statusCertified',
        'routerDiagnostics.statusMismatch',
        'routerDiagnostics.statusBlocked',
        'routerDiagnostics.statusSamples',
        'routerDiagnostics.statusModels',
        'routerDiagnostics.statusNotCertified',
    ];

    for (const key of keys) {
        const marker = `'${key}':`;
        assert.equal(i18n.split(marker).length - 1, 2, `expected EN/ZH translations for ${key}`);
    }
});

test('panel source renders report values via textContent rather than dynamic diagnostic HTML', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('node.textContent = text'));
    assert.ok(panel.includes("panel.innerHTML = ''"));
    assert.equal(panel.includes('panel.innerHTML = `'), false);
    assert.equal(panel.includes('targetList.innerHTML'), false);
});

test('P1B.13 does not add routing controls to Studio generation components', () => {
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    assert.equal(image.includes('RouterDiagnosticsPanel'), false);
    assert.equal(video.includes('RouterDiagnosticsPanel'), false);
    assert.equal(image.includes('studioParityTargets'), false);
    assert.equal(video.includes('studioParityTargets'), false);
});
