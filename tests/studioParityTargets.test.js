const test = require('node:test');
const assert = require('node:assert/strict');

async function targets() {
    return import('../src/lib/computeRouter/studioParityTargets.mjs');
}

async function adapters() {
    return import('../src/lib/computeRouter/providerAdapters.mjs');
}

async function session() {
    return import('../src/lib/computeRouter/paritySession.mjs');
}

const EXPECTED_ROUTE_KEYS = [
    'sdcpp-device:t2i',
    'wan2gp-lan:t2i',
    'wan2gp-lan:t2v',
    'wan2gp-lan:i2v',
    'muapi-cloud:t2i',
    'muapi-cloud:i2i',
    'muapi-cloud:t2v',
    'muapi-cloud:i2v',
    'muapi-cloud:v2v',
].sort();

test('Studio parity target profile v1 is explicit immutable and versioned', async () => {
    const {
        STUDIO_PARITY_PROFILE_ID,
        STUDIO_PARITY_PROFILE_SCHEMA_VERSION,
        STUDIO_PARITY_TARGET_PROFILE,
        STUDIO_PARITY_TARGETS,
        getStudioParityTargetProfile,
    } = await targets();

    assert.equal(STUDIO_PARITY_PROFILE_ID, 'studio-image-video-v1');
    assert.equal(STUDIO_PARITY_PROFILE_SCHEMA_VERSION, 1);
    assert.equal(STUDIO_PARITY_TARGET_PROFILE.schemaVersion, 1);
    assert.equal(STUDIO_PARITY_TARGET_PROFILE.scope, 'electron-image-video-studios');
    assert.equal(getStudioParityTargetProfile(), STUDIO_PARITY_TARGET_PROFILE);
    assert.equal(STUDIO_PARITY_TARGET_PROFILE.targets, STUDIO_PARITY_TARGETS);

    assert.equal(Object.isFrozen(STUDIO_PARITY_TARGET_PROFILE), true);
    assert.equal(Object.isFrozen(STUDIO_PARITY_TARGETS), true);
    assert.ok(STUDIO_PARITY_TARGETS.every(Object.isFrozen));

    assert.deepEqual(
        STUDIO_PARITY_TARGETS.map((target) => target.routeKey).sort(),
        EXPECTED_ROUTE_KEYS,
    );
});

test('every profile target has a matching declared provider capability', async () => {
    const { STUDIO_PARITY_TARGETS } = await targets();
    const {
        MUAPI_CAPABILITIES,
        SDCPP_CAPABILITIES,
        WAN2GP_CAPABILITIES,
    } = await adapters();

    const capabilitiesByProvider = new Map([
        ['sdcpp-device', SDCPP_CAPABILITIES],
        ['wan2gp-lan', WAN2GP_CAPABILITIES],
        ['muapi-cloud', MUAPI_CAPABILITIES],
    ]);

    for (const target of STUDIO_PARITY_TARGETS) {
        const capabilities = capabilitiesByProvider.get(target.expectedProviderId);
        assert.ok(capabilities, `missing capabilities for ${target.expectedProviderId}`);
        assert.ok(
            capabilities.some((capability) => capability.operations.includes(target.operation)),
            `no ${target.operation} capability for ${target.expectedProviderId}`,
        );
    }
});

test('profile scope excludes operations that are not instrumented by ImageStudio/VideoStudio shadow hooks', async () => {
    const { STUDIO_PARITY_TARGETS } = await targets();
    const routeKeys = new Set(STUDIO_PARITY_TARGETS.map((target) => target.routeKey));

    assert.equal(routeKeys.has('muapi-cloud:lipsync'), false);
    assert.equal(routeKeys.has('muapi-cloud:audio'), false);
    assert.equal(routeKeys.has('sdcpp-device:i2i'), false);
    assert.equal(routeKeys.has('wan2gp-lan:v2v'), false);
});

test('all v1 targets require the explicit P1B.9 minimum evidence floor', async () => {
    const { STUDIO_PARITY_TARGETS } = await targets();

    for (const target of STUDIO_PARITY_TARGETS) {
        assert.equal(target.minSamples, 10);
        assert.equal(target.minDistinctModels, 1);
    }
});

test('session convenience evaluation uses all nine Studio profile targets', async () => {
    const {
        clearStudioParitySessionEvidence,
        evaluateCurrentStudioParitySession,
        buildCurrentStudioParityDiagnosticReport,
    } = await session();

    clearStudioParitySessionEvidence();

    const result = evaluateCurrentStudioParitySession();
    assert.equal(result.certified, false);
    assert.equal(result.reason, 'PARITY_NOT_CERTIFIED');
    assert.equal(result.routes.length, 9);
    assert.deepEqual(
        result.routes.map((route) => route.routeKey).sort(),
        EXPECTED_ROUTE_KEYS,
    );

    const report = buildCurrentStudioParityDiagnosticReport({ generatedAt: 1000 });
    assert.equal(report.certification.certified, false);
    assert.equal(report.certification.targetCount, 9);
    assert.equal(report.targets.length, 9);
    assert.equal(report.totals.samples, 0);
});

test('profile route identities are unique', async () => {
    const { STUDIO_PARITY_TARGETS } = await targets();
    const keys = STUDIO_PARITY_TARGETS.map((target) => target.routeKey);
    assert.equal(new Set(keys).size, keys.length);
});
