const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function modules() {
    const eligibility = await import('../src/lib/computeRouter/cutoverEligibility.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    return { ...eligibility, ...targets, ...adapters };
}

function allReleaseGates() {
    return {
        ciGreen: true,
        platformMatrixGreen: true,
        securityReviewApproved: true,
        rollbackPlanApproved: true,
    };
}

function capabilityMap(m) {
    return new Map([
        ['sdcpp-device', m.SDCPP_CAPABILITIES],
        ['wan2gp-lan', m.WAN2GP_CAPABILITIES],
        ['muapi-cloud', m.MUAPI_CAPABILITIES],
    ]);
}

function modelForTarget(target, map) {
    const capability = map.get(target.expectedProviderId)
        .find((item) => item.operations.includes(target.operation));
    assert.ok(capability, `fixture capability missing for ${target.routeKey}`);
    return capability.modelId;
}

function makeCertification(m, overrides = {}) {
    const map = capabilityMap(m);
    const routes = m.STUDIO_PARITY_TARGETS.map((target) => ({
        routeKey: target.routeKey,
        expectedProviderId: target.expectedProviderId,
        operation: target.operation,
        minSamples: target.minSamples,
        minDistinctModels: target.minDistinctModels,
        samples: target.minSamples,
        matches: target.minSamples,
        blocked: 0,
        mismatches: 0,
        distinctModels: 1,
        modelIds: [modelForTarget(target, map)],
        certified: true,
        reasons: [],
    }));

    return {
        schemaVersion: 1,
        certified: true,
        reason: 'PARITY_CERTIFIED',
        maxEvidenceAgeMs: 7 * 24 * 60 * 60 * 1000,
        maxFutureSkewMs: 60 * 1000,
        routes,
        ...overrides,
    };
}

function makeProviders(m, overrides = {}) {
    return m.createCurrentProviderDescriptors({
        sdcpp: { health: overrides.sdcppHealth || 'ready' },
        wan2gp: { health: overrides.wan2gpHealth || 'ready' },
        muapi: {
            health: overrides.muapiHealth || 'ready',
            credentials: overrides.muapiCredentials || 'available',
        },
    });
}

test('cutover eligibility defaults fail closed and never authorizes execution', async () => {
    const m = await modules();
    const result = m.assessStudioCutoverEligibility({
        certification: makeCertification(m),
        providers: makeProviders(m),
    });

    assert.equal(result.eligibleForCutoverReview, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
    assert.deepEqual(result.missingReleaseGates, [
        'ciGreen',
        'platformMatrixGreen',
        'securityReviewApproved',
        'rollbackPlanApproved',
    ]);
    assert.ok(result.routes.every((route) => route.cutoverAuthorized === false));
});

test('all strict evidence and release gates yield review eligibility but still no cutover authority', async () => {
    const m = await modules();
    const result = m.assessStudioCutoverEligibility({
        certification: makeCertification(m),
        providers: makeProviders(m),
        releaseGates: allReleaseGates(),
    });

    assert.equal(result.profileMatches, true);
    assert.equal(result.certificationSchemaValid, true);
    assert.equal(result.certificationFreshnessStrict, true);
    assert.equal(result.certificationGloballyCertified, true);
    assert.equal(result.eligibleForCutoverReview, true);
    assert.equal(result.reason, 'ELIGIBLE_FOR_CUTOVER_REVIEW');
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(result.routes.length, 9);
    assert.ok(result.routes.every((route) => route.eligibleForCutoverReview));
});

test('degraded provider health is insufficient for cutover review even though normal router contracts can use degraded', async () => {
    const m = await modules();
    const result = m.assessStudioCutoverEligibility({
        certification: makeCertification(m),
        providers: makeProviders(m, { sdcppHealth: 'degraded' }),
        releaseGates: allReleaseGates(),
    });

    assert.equal(result.eligibleForCutoverReview, false);
    const route = result.routes.find((item) => item.routeKey === 'sdcpp-device:t2i');
    assert.equal(route.eligibleForCutoverReview, false);
    assert.ok(route.reasons.includes('provider-health:degraded'));
});

test('MuAPI routes require available credentials at review time', async () => {
    const m = await modules();
    const result = m.assessStudioCutoverEligibility({
        certification: makeCertification(m),
        providers: makeProviders(m, { muapiCredentials: 'unknown' }),
        releaseGates: allReleaseGates(),
    });

    const cloudRoutes = result.routes.filter((route) => route.expectedProviderId === 'muapi-cloud');
    assert.ok(cloudRoutes.length > 0);
    assert.ok(cloudRoutes.every((route) => route.reasons.includes('provider-credentials:unknown')));
    assert.equal(result.eligibleForCutoverReview, false);
});

test('certified model identities must still exist in current provider capabilities', async () => {
    const m = await modules();
    const certification = makeCertification(m);
    const target = certification.routes.find((route) => route.routeKey === 'sdcpp-device:t2i');
    target.modelIds = ['removed-model-id'];

    const result = m.assessStudioCutoverEligibility({
        certification,
        providers: makeProviders(m),
        releaseGates: allReleaseGates(),
    });

    const route = result.routes.find((item) => item.routeKey === 'sdcpp-device:t2i');
    assert.ok(route.reasons.includes('provider-models-missing:removed-model-id'));
    assert.equal(result.eligibleForCutoverReview, false);
});

test('weakened evidence freshness policy blocks review eligibility', async () => {
    const m = await modules();
    const certification = makeCertification(m, {
        maxEvidenceAgeMs: 8 * 24 * 60 * 60 * 1000,
    });

    const result = m.assessStudioCutoverEligibility({
        certification,
        providers: makeProviders(m),
        releaseGates: allReleaseGates(),
    });

    assert.equal(result.certificationFreshnessStrict, false);
    assert.equal(result.eligibleForCutoverReview, false);
    assert.ok(result.routes.every((route) => route.reasons.includes('certification-freshness-weakened')));
});

test('weakened per-route sample threshold is rejected even when the route claims certified', async () => {
    const m = await modules();
    const certification = makeCertification(m);
    const route = certification.routes[0];
    route.minSamples = 1;

    const result = m.assessStudioCutoverEligibility({
        certification,
        providers: makeProviders(m),
        releaseGates: allReleaseGates(),
    });

    const assessed = result.routes.find((item) => item.routeKey === route.routeKey);
    assert.ok(assessed.reasons.includes('parity-sample-threshold-weakened'));
    assert.equal(assessed.eligibleForCutoverReview, false);
});

test('blocked or mismatch parity evidence blocks review even if the outer certification object claims green', async () => {
    const m = await modules();
    const certification = makeCertification(m);
    const route = certification.routes.find((item) => item.routeKey === 'muapi-cloud:t2v');
    route.matches = route.samples - 1;
    route.mismatches = 1;

    const result = m.assessStudioCutoverEligibility({
        certification,
        providers: makeProviders(m),
        releaseGates: allReleaseGates(),
    });

    const assessed = result.routes.find((item) => item.routeKey === 'muapi-cloud:t2v');
    assert.ok(assessed.reasons.includes('parity-non-match-evidence'));
    assert.ok(assessed.reasons.includes('parity-mismatch-evidence'));
    assert.equal(result.eligibleForCutoverReview, false);
});

test('wrong profile id or incomplete certification route set fails closed', async () => {
    const m = await modules();
    const certification = makeCertification(m);
    certification.routes.pop();

    const result = m.assessStudioCutoverEligibility({
        certification,
        providers: makeProviders(m),
        releaseGates: allReleaseGates(),
        profileId: 'unexpected-profile',
    });

    assert.equal(result.profileMatches, false);
    assert.equal(result.eligibleForCutoverReview, false);
    assert.ok(result.routes.some((route) => route.reasons.includes('certification-profile-mismatch')));
    assert.ok(result.routes.some((route) => route.reasons.includes('parity-route-missing')));
});

test('duplicate certification routes and duplicate provider descriptors are rejected', async () => {
    const m = await modules();
    const certification = makeCertification(m);
    certification.routes.push({ ...certification.routes[0] });
    const providers = makeProviders(m);
    const duplicatedProviders = [...providers, providers[0]];

    const result = m.assessStudioCutoverEligibility({
        certification,
        providers: duplicatedProviders,
        releaseGates: allReleaseGates(),
    });

    assert.equal(result.eligibleForCutoverReview, false);
    assert.equal(result.duplicateCertificationRoutes.length, 1);
    assert.equal(result.duplicateProviders.length, 1);
    assert.ok(result.routes.every((route) => route.reasons.includes('certification-route-duplicates')));
    assert.ok(result.routes.every((route) => route.reasons.includes('provider-readiness-duplicates')));
});

test('contract remains isolated from Studio execution and contains no generation side effects', () => {
    const source = fs.readFileSync('src/lib/computeRouter/cutoverEligibility.mjs', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localAI.generate',
        'muapi.generate',
        'routeGenerationRequest(',
        'window.',
        'globalThis.',
    ]) {
        assert.equal(source.includes(token), false, `unexpected cutover side effect token: ${token}`);
    }

    assert.equal(image.includes('cutoverEligibility'), false);
    assert.equal(video.includes('cutoverEligibility'), false);
    assert.ok(source.includes("CUTOVER_EXECUTION_AUTHORITY = 'legacy-dispatcher-only'"));
    assert.ok(source.includes('cutoverAuthorized: false'));
});
