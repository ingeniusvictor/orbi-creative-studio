const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C19 exposes sanitized runtime certification status without registry or evidence payloads', async () => {
    const registryModule = await import('../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs');
    const status = registryModule.getRuntimeCertifiedResourceProfileRegistryStatus();

    assert.deepEqual(status, {
        status: 'RUNTIME_CERTIFICATION_STATUS_READY',
        sourceType: 'source-controlled-static-bundle',
        certificationCount: 0,
        sourceContractValid: true,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
    assert.equal(Object.isFrozen(status), true);
    assert.equal('registry' in status, false);
    assert.equal('certifications' in status, false);
    assert.equal('certificationRecord' in status, false);
    assert.equal('reviewer' in status, false);
    assert.equal('reason' in status, false);
});

test('P1C19 status provider is no-argument and preserves non-authorizing boundaries', () => {
    const loader = read('src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs');

    assert.ok(loader.includes('export function getRuntimeCertifiedResourceProfileRegistryStatus()'));
    assert.ok(loader.includes("READY: 'RUNTIME_CERTIFICATION_STATUS_READY'"));
    assert.ok(loader.includes("UNAVAILABLE: 'RUNTIME_CERTIFICATION_STATUS_UNAVAILABLE'"));
    assert.ok(loader.includes('authenticityVerified: false'));
    assert.ok(loader.includes('routingEligible: false'));
    assert.ok(loader.includes('cutoverAuthorized: false'));
    assert.ok(loader.includes("executionAuthority: 'legacy-dispatcher-only'"));
});

test('P1C19 Router Diagnostics renders bounded certification metadata without adding actions', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiRuntimeCertificationStatus = 'read-only'"));
    assert.ok(panel.includes('normalizeRuntimeCertificationStatus'));
    assert.ok(panel.includes('resolveRuntimeCertificationStatus'));
    assert.ok(panel.includes('renderRuntimeCertificationStatus'));
    assert.ok(panel.includes('runtimeCertificationStatusProvider = null'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 5);
    assert.equal((panel.match(/\.onchange\s*=/g) || []).length, 1);

    for (const token of [
        'certificationRecord',
        '.reviewNote',
        'approvedRequirements',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'certificationRecord.reviewer',
    ]) {
        assert.equal(panel.includes(token), false, `unexpected P1C19 certification payload exposure: ${token}`);
    }
});

test('P1C19 Settings wires only the sanitized certification status provider', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes('getRuntimeCertifiedResourceProfileRegistryStatus'));
    assert.ok(settings.includes(
        'runtimeCertificationStatusProvider: getRuntimeCertifiedResourceProfileRegistryStatus',
    ));
    assert.equal(settings.includes('RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE'), false);
    assert.equal(settings.includes('loadRuntimeCertifiedResourceProfileRegistry'), false);
});

test('P1C19 certification status copy exists in both English and Chinese', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.runtimeCertificationTitle',
        'routerDiagnostics.runtimeCertificationSubtitle',
        'routerDiagnostics.runtimeCertificationUnavailable',
        'routerDiagnostics.runtimeCertificationSource',
        'routerDiagnostics.runtimeCertificationSourceControlled',
        'routerDiagnostics.runtimeCertificationCount',
        'routerDiagnostics.runtimeCertificationContract',
        'routerDiagnostics.runtimeCertificationValid',
        'routerDiagnostics.runtimeCertificationInvalid',
        'routerDiagnostics.runtimeCertificationAuthenticity',
        'routerDiagnostics.runtimeCertificationNotVerified',
        'routerDiagnostics.runtimeCertificationEmptyNote',
        'routerDiagnostics.runtimeCertificationLoadedNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C19 status UI remains outside startup and generation execution', () => {
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const source of [main, image, video]) {
        assert.equal(source.includes('getRuntimeCertifiedResourceProfileRegistryStatus'), false);
        assert.equal(source.includes('runtimeCertificationStatusProvider'), false);
    }
});
