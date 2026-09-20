const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('Router diagnostics displays exact build identity and ephemeral session binding preview', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('getRendererBuildIdentity'));
    assert.ok(panel.includes('bindCurrentStudioParitySessionToBuild'));
    assert.ok(panel.includes("bindingId: `diagnostic-preview:${buildIdentity.sourceCommit}:${report.generatedAt}`"));
    assert.ok(panel.includes('boundAt: report.generatedAt'));
    assert.ok(panel.includes('buildIdentity.sourceCommit'));
    assert.ok(panel.includes('buildIdentity.appVersion'));
    assert.ok(panel.includes("buildBinding?.executionAuthority || 'legacy-dispatcher-only'"));
});

test('build-bound diagnostics remain read-only with generic refresh plus one P1C16 diagnostic-only action', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 6);
    assert.ok(panel.includes('refresh.onclick = render'));
    assert.ok(panel.includes('refreshButton.onclick = onRefresh'));
    assert.ok(panel.includes("refreshButton.dataset.orbiShadowRefresh = 'diagnostic-only'"));
    assert.ok(panel.includes('refresh.onclick = render'));

    for (const token of [
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'clearStudioParitySessionEvidence',
        'setMuapiCredential',
        'routeGenerationRequest',
        'localAI.generate',
        'muapi.generate',
    ]) {
        assert.equal(panel.includes(token), false, `unexpected diagnostics side effect: ${token}`);
    }
});

test('build binding preview remains non-authorizing and non-persistent by contract', () => {
    const session = read('src/lib/computeRouter/paritySession.mjs');
    const binding = read('src/lib/computeRouter/parityBuildBinding.mjs');
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(session.includes('bindCurrentStudioParitySessionToBuild'));
    assert.ok(binding.includes('cutoverAuthorized: false'));
    assert.ok(binding.includes("PARITY_BUILD_EXECUTION_AUTHORITY = 'legacy-dispatcher-only'"));
    assert.equal(panel.includes('save'), false);
    assert.equal(panel.includes('persist'), false);
});

test('new build-bound diagnostics copy exists in English and Chinese', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.buildIdentity',
        'routerDiagnostics.buildVersion',
        'routerDiagnostics.buildCommit',
        'routerDiagnostics.sessionBinding',
        'routerDiagnostics.bindingBound',
        'routerDiagnostics.bindingRejected',
        'routerDiagnostics.executionAuthority',
        'routerDiagnostics.bindingPreviewNote',
        'routerDiagnostics.unavailableValue',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1B.21 does not add build-bound diagnostics to generation components', () => {
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');
    const main = read('src/main.js');

    assert.equal(image.includes('buildIdentityClient'), false);
    assert.equal(video.includes('buildIdentityClient'), false);
    assert.equal(main.includes('bindCurrentStudioParitySessionToBuild'), false);
});
