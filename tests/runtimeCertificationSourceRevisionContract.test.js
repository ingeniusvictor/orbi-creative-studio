const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }
    return Object.freeze(value);
}

function sourceAtRevision(sourceRevision) {
    return deepFreeze({
        schemaVersion: 1,
        sourceType: 'source-controlled-static-bundle',
        sourceRevision,
        certifications: [],
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

test('P1C29 declares an exact closed runtime source revision set of 1 and 2', async () => {
    const loader = await import(
        '../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs'
    );

    assert.deepEqual(
        [...loader.RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS],
        [1, 2],
    );
    assert.equal(Object.isFrozen(loader.RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS), true);
});

test('P1C29 accepts source revisions 1 and 2 while rejecting revision 3', async () => {
    const loader = await import(
        '../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs'
    );

    const revision1 = loader.validateRuntimeCertificationSource(sourceAtRevision(1));
    assert.equal(revision1.ok, true);
    assert.deepEqual(revision1.certifications, []);

    const revision2 = loader.validateRuntimeCertificationSource(sourceAtRevision(2));
    assert.equal(revision2.ok, true);
    assert.deepEqual(revision2.certifications, []);

    const revision3 = loader.validateRuntimeCertificationSource(sourceAtRevision(3));
    assert.equal(revision3.ok, false);
    assert.equal(revision3.reason, 'RUNTIME_CERTIFICATION_SOURCE_IDENTITY_INVALID');
});

test('P1C29 revision support does not weaken source authority constraints', async () => {
    const loader = await import(
        '../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs'
    );

    for (const mutation of [
        { authenticityVerified: true },
        { routingEligible: true },
        { cutoverAuthorized: true },
        { executionAuthority: 'compute-router' },
    ]) {
        const source = deepFreeze({
            ...sourceAtRevision(2),
            ...mutation,
        });
        const validation = loader.validateRuntimeCertificationSource(source);
        assert.equal(validation.ok, false);
        assert.equal(validation.reason, 'RUNTIME_CERTIFICATION_SOURCE_AUTHORITY_INVALID');
    }
});

test('P1C29 keeps the actual governed source at revision 1 with zero certifications', async () => {
    const sourceModule = await import(
        '../src/lib/computeRouter/runtimeResourceProfileCertifications.mjs'
    );
    const loader = await import(
        '../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs'
    );

    const source = sourceModule.RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE;
    assert.equal(source.sourceRevision, 1);
    assert.deepEqual(source.certifications, []);
    assert.equal(source.authenticityVerified, false);
    assert.equal(source.routingEligible, false);
    assert.equal(source.cutoverAuthorized, false);
    assert.equal(source.executionAuthority, 'legacy-dispatcher-only');

    const loaded = loader.loadRuntimeCertifiedResourceProfileRegistry();
    assert.equal(loaded.status, 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_READY');
    assert.equal(loaded.certificationCount, 0);
    assert.equal(loaded.sourceContractValid, true);
    assert.equal(loaded.authenticityVerified, false);
    assert.equal(loaded.routingEligible, false);
    assert.equal(loaded.cutoverAuthorized, false);
    assert.equal(loaded.executionAuthority, 'legacy-dispatcher-only');
});

test('P1C29 makes the P1C28 default revision-2 dry-run loader-compatible without adding mutation capability', () => {
    const dryRun = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs',
        'utf8',
    );
    const loader = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs',
        'utf8',
    );

    assert.ok(loader.includes(
        'RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS = Object.freeze([1, 2])',
    ));
    assert.ok(dryRun.includes(
        'supportedSourceRevisionsProvider = () => RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS',
    ));
    assert.ok(dryRun.includes('sourceApplyEligible: runtimeLoaderCompatible'));
    assert.ok(dryRun.includes('sourceMutationApplied: false'));
    assert.ok(dryRun.includes('runtimeRegistryLoaded: false'));
    assert.ok(dryRun.includes('routingEligible: false'));
    assert.ok(dryRun.includes('cutoverAuthorized: false'));
});

test('P1C29 has no source mutation, UI, generation, or routing/cutover activation', () => {
    const loader = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs',
        'utf8',
    );
    const runtimeSource = fs.readFileSync(
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
        'utf8',
    );
    const settings = fs.readFileSync('src/components/SettingsModal.js', 'utf8');
    const panel = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');
    const main = fs.readFileSync('src/main.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    assert.ok(runtimeSource.includes('const certifications = [];'));
    assert.ok(runtimeSource.includes('sourceRevision: 1'));

    for (const forbidden of [
        'writeFile',
        'createWriteStream',
        'fetch(',
        'octokit',
        'updateFile',
        'createCommit',
        'updateRef',
        'routingEligible: true',
        'cutoverAuthorized: true',
        "executionAuthority: 'compute-router'",
    ]) {
        assert.equal(loader.includes(forbidden), false, `unexpected P1C29 capability: ${forbidden}`);
    }

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(surface.includes('RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS'), false);
    }
});
