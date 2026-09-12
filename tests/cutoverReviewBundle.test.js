const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function modules() {
    const bundle = await import('../src/lib/computeRouter/cutoverReviewBundle.mjs');
    const binding = await import('../src/lib/computeRouter/parityBuildBinding.mjs');
    const release = await import('../src/lib/computeRouter/releaseEvidenceManifest.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    return { ...bundle, ...binding, ...release, ...adapters, ...targets };
}

const SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function validCertification(m) {
    const caps = new Map([
        ['sdcpp-device', m.SDCPP_CAPABILITIES],
        ['wan2gp-lan', m.WAN2GP_CAPABILITIES],
        ['muapi-cloud', m.MUAPI_CAPABILITIES],
    ]);

    return {
        schemaVersion: 1,
        certified: true,
        reason: 'PARITY_CERTIFIED',
        maxEvidenceAgeMs: 7 * 24 * 60 * 60 * 1000,
        maxFutureSkewMs: 60 * 1000,
        routes: m.STUDIO_PARITY_TARGETS.map((target) => {
            const capability = caps.get(target.expectedProviderId)
                .find((item) => item.operations.includes(target.operation));
            assert.ok(capability, `fixture capability missing for ${target.routeKey}`);
            return {
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
                modelIds: [capability.modelId],
                certified: true,
                reasons: [],
            };
        }),
    };
}

function parityBinding(m) {
    return m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'binding-review-bundle',
        boundAt: 900_000,
        certification: validCertification(m),
    });
}

function releaseManifest(m, overrides = {}) {
    const generatedAt = 1_000_000;
    const base = {
        sourceCommit: SOURCE,
        generatedAt,
        ci: { sourceCommit: SOURCE, status: 'passed', runId: 'ci-1', completedAt: 990_000 },
        platforms: {
            linux: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'linux-1', completedAt: 991_000 },
            macos: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'macos-1', completedAt: 992_000 },
            windows: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'windows-1', completedAt: 993_000 },
        },
        securityReview: { sourceCommit: SOURCE, approved: true, reviewId: 'sec-1', reviewedAt: 994_000 },
        rollbackPlan: { sourceCommit: SOURCE, approved: true, planId: 'rollback-1', reviewedAt: 995_000 },
        ...overrides,
    };
    return m.buildReleaseEvidenceManifest(base);
}

function providers(m, overrides = {}) {
    return m.createCurrentProviderDescriptors({
        sdcpp: { health: overrides.sdcppHealth || 'ready' },
        wan2gp: { health: overrides.wan2gpHealth || 'ready' },
        muapi: {
            health: overrides.muapiHealth || 'ready',
            credentials: overrides.muapiCredentials || 'available',
        },
    });
}

test('green source-bound evidence composes a READY_FOR_REVIEW bundle without authorizing cutover', async () => {
    const m = await modules();
    const binding = parityBinding(m);
    const release = releaseManifest(m);
    const readiness = providers(m);

    const bundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
        generatedAt: 1_100_000,
    });

    assert.equal(bundle.sourceCommit, SOURCE);
    assert.equal(bundle.releaseEvidenceComplete, true);
    assert.equal(bundle.readyForReview, true);
    assert.equal(bundle.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(bundle.cutoverAuthorized, false);
    assert.equal(bundle.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(bundle.eligibilityAssessment.eligibleForCutoverReview, true);
    assert.equal(bundle.reviewReport.readyForReview, true);

    const validation = m.validateStudioCutoverReviewBundle(bundle, {
        expectedSourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
    });
    assert.equal(validation.valid, true);
    assert.equal(validation.readyForReview, true);
    assert.equal(validation.cutoverAuthorized, false);
});

test('failed CI evidence composes a BLOCKED bundle with ciGreen false', async () => {
    const m = await modules();
    const input = {
        ci: { sourceCommit: SOURCE, status: 'failed', runId: 'ci-failed', completedAt: 990_000 },
    };
    const release = releaseManifest(m, input);

    const bundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: parityBinding(m),
        releaseManifest: release,
        providers: providers(m),
        generatedAt: 1_100_000,
    });

    assert.equal(bundle.releaseGates.ciGreen, false);
    assert.equal(bundle.releaseEvidenceComplete, false);
    assert.equal(bundle.readyForReview, false);
    assert.equal(bundle.reviewStatus, 'BLOCKED');
    assert.ok(bundle.reviewReport.globalBlockers.includes('release-gate:ciGreen'));
});

test('current degraded provider blocks review even with complete release evidence', async () => {
    const m = await modules();
    const bundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: parityBinding(m),
        releaseManifest: releaseManifest(m),
        providers: providers(m, { wan2gpHealth: 'degraded' }),
        generatedAt: 1_100_000,
    });

    assert.equal(bundle.releaseEvidenceComplete, true);
    assert.equal(bundle.readyForReview, false);
    const route = bundle.reviewReport.routes.find((item) => item.routeKey === 'wan2gp-lan:t2v');
    assert.ok(route.reasons.includes('provider-health:degraded'));
});

test('release manifest and parity binding must resolve to the same exact bundle commit', async () => {
    const m = await modules();
    const release = { ...releaseManifest(m), sourceCommit: OTHER };

    assert.throws(
        () => m.buildStudioCutoverReviewBundle({
            sourceCommit: SOURCE,
            parityBinding: parityBinding(m),
            releaseManifest: release,
            providers: providers(m),
            generatedAt: 1_100_000,
        }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_BUNDLE',
    );
});

test('validator detects forged stored release gates by rebuilding from source evidence', async () => {
    const m = await modules();
    const binding = parityBinding(m);
    const release = releaseManifest(m);
    const readiness = providers(m);
    const bundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
        generatedAt: 1_100_000,
    });

    const forged = {
        ...bundle,
        releaseGates: { ...bundle.releaseGates, ciGreen: false },
    };

    assert.throws(
        () => m.validateStudioCutoverReviewBundle(forged, {
            expectedSourceCommit: SOURCE,
            parityBinding: binding,
            releaseManifest: release,
            providers: readiness,
        }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_BUNDLE',
    );
});

test('validator detects forged embedded eligibility or review evidence', async () => {
    const m = await modules();
    const binding = parityBinding(m);
    const release = releaseManifest(m);
    const readiness = providers(m);
    const bundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
        generatedAt: 1_100_000,
    });

    const forgedAssessment = {
        ...bundle,
        eligibilityAssessment: {
            ...bundle.eligibilityAssessment,
            eligibleForCutoverReview: false,
        },
    };
    assert.throws(
        () => m.validateStudioCutoverReviewBundle(forgedAssessment, {
            expectedSourceCommit: SOURCE,
            parityBinding: binding,
            releaseManifest: release,
            providers: readiness,
        }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_BUNDLE',
    );

    const forgedReport = {
        ...bundle,
        reviewReport: { ...bundle.reviewReport, readyForReview: false },
    };
    assert.throws(
        () => m.validateStudioCutoverReviewBundle(forgedReport, {
            expectedSourceCommit: SOURCE,
            parityBinding: binding,
            releaseManifest: release,
            providers: readiness,
        }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_BUNDLE',
    );
});

test('validator rejects any bundle that claims cutover authority', async () => {
    const m = await modules();
    const binding = parityBinding(m);
    const release = releaseManifest(m);
    const readiness = providers(m);
    const bundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
        generatedAt: 1_100_000,
    });

    assert.throws(
        () => m.validateStudioCutoverReviewBundle({ ...bundle, cutoverAuthorized: true }, {
            expectedSourceCommit: SOURCE,
            parityBinding: binding,
            releaseManifest: release,
            providers: readiness,
        }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_BUNDLE',
    );
});

test('review bundle remains pure and isolated from Studio execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/cutoverReviewBundle.mjs', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localAI.generate',
        'muapi.generate',
        'routeGenerationRequest(',
        'localStorage',
        'sessionStorage',
        'window.',
        'globalThis.',
    ]) {
        assert.equal(source.includes(token), false, `unexpected bundle side effect token: ${token}`);
    }

    assert.equal(image.includes('cutoverReviewBundle'), false);
    assert.equal(video.includes('cutoverReviewBundle'), false);
    assert.ok(source.includes("CUTOVER_REVIEW_BUNDLE_EXECUTION_AUTHORITY = 'legacy-dispatcher-only'"));
    assert.ok(source.includes('cutoverAuthorized: false'));
});
