const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C18 runtime certification source is deeply frozen, empty, and non-authorizing', async () => {
    const sourceModule = await import('../src/lib/computeRouter/runtimeResourceProfileCertifications.mjs');
    const source = sourceModule.RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE;

    assert.equal(source.schemaVersion, 1);
    assert.equal(source.sourceType, 'source-controlled-static-bundle');
    assert.equal(source.sourceRevision, 1);
    assert.deepEqual(source.certifications, []);
    assert.equal(source.authenticityVerified, false);
    assert.equal(source.routingEligible, false);
    assert.equal(source.cutoverAuthorized, false);
    assert.equal(source.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(Object.isFrozen(source), true);
    assert.equal(Object.isFrozen(source.certifications), true);
});

test('P1C18 loader returns a governed empty P1C9 registry without inventing certification', async () => {
    const loader = await import('../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs');
    const result = loader.loadRuntimeCertifiedResourceProfileRegistry();

    assert.equal(result.status, 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_READY');
    assert.equal(result.reason, null);
    assert.equal(result.sourceType, 'source-controlled-static-bundle');
    assert.equal(result.certificationCount, 0);
    assert.equal(result.sourceContractValid, true);
    assert.equal(result.authenticityVerified, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(result.registry.mode, 'immutable-shadow-registry');
    assert.equal(result.registry.size, 0);
});

test('P1C18 source validator rejects mutable and authority-claiming bundles', async () => {
    const loader = await import('../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs');

    const mutable = {
        schemaVersion: 1,
        sourceType: 'source-controlled-static-bundle',
        sourceRevision: 1,
        certifications: [],
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
    assert.equal(
        loader.validateRuntimeCertificationSource(mutable).reason,
        'RUNTIME_CERTIFICATION_SOURCE_MUTABLE',
    );

    const authority = Object.freeze({
        ...mutable,
        certifications: Object.freeze([]),
        routingEligible: true,
    });
    assert.equal(
        loader.validateRuntimeCertificationSource(authority).reason,
        'RUNTIME_CERTIFICATION_SOURCE_AUTHORITY_INVALID',
    );
});

test('P1C18 loader has no runtime ingestion channel and always delegates certification validation to P1C9', () => {
    const source = read('src/lib/computeRouter/runtimeResourceProfileCertifications.mjs');
    const loader = read('src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs');

    assert.ok(source.includes('const certifications = [];'));
    assert.equal(source.includes('RESOURCE_PROFILE_CERTIFICATION_RECORDED'), false);

    assert.ok(loader.includes('createCertifiedResourceProfileRegistry'));
    assert.ok(loader.includes('RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE'));
    assert.ok(loader.includes('sourceContractValid: true'));
    assert.ok(loader.includes('authenticityVerified: false'));
    assert.ok(loader.includes('export function loadRuntimeCertifiedResourceProfileRegistry()'));

    for (const token of [
        'fetch(',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'ipcRenderer',
        'ipcMain',
        'node:fs',
        "from 'fs'",
        'readFile',
        'writeFile',
        'JSON.parse',
        'URLSearchParams',
    ]) {
        assert.equal(source.includes(token), false, `unexpected P1C18 source ingress: ${token}`);
        assert.equal(loader.includes(token), false, `unexpected P1C18 loader ingress: ${token}`);
    }
});

test('P1C18 becomes the default registry provider for user diagnostics without entering generation', () => {
    const controller = read('src/lib/computeRouter/userShadowDiagnosticRefresh.mjs');
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    assert.ok(controller.includes('loadRuntimeCertifiedResourceProfileRegistry'));
    assert.ok(controller.includes('createRegistry = loadRuntimeCertifiedResourceProfileRegistry'));
    assert.equal(controller.includes('createCertifiedResourceProfileRegistry'), false);

    for (const source of [main, image, video]) {
        assert.equal(source.includes('runtimeCertifiedResourceProfileRegistry'), false);
        assert.equal(source.includes('runtimeResourceProfileCertifications'), false);
    }
});

test('P1C18 source comments explicitly prohibit synthetic/demo/fixture runtime certifications', () => {
    const source = read('src/lib/computeRouter/runtimeResourceProfileCertifications.mjs');

    assert.ok(source.includes('Do not insert synthetic/demo/fixture certifications here.'));
    assert.ok(source.includes('real P1C8 certification records'));
    assert.ok(source.includes('controlled benchmark evidence'));
    assert.ok(source.includes('explicit human approval'));
});
