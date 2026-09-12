const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function modules() {
    const evidenceExport = await import('../src/lib/computeRouter/evidenceExport.mjs');
    const binding = await import('../src/lib/computeRouter/parityBuildBinding.mjs');
    const release = await import('../src/lib/computeRouter/releaseEvidenceManifest.mjs');
    const review = await import('../src/lib/computeRouter/cutoverReviewBundle.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    return { ...evidenceExport, ...binding, ...release, ...review, ...targets, ...adapters };
}

const SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const BUILD_IDENTITY = Object.freeze({
    schemaVersion: 1,
    available: true,
    sourceCommit: SOURCE,
    appVersion: '2.0.0',
    reason: null,
});

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

function parityBinding(m, sourceCommit = SOURCE) {
    return m.bindParityCertificationToBuild({
        sourceCommit,
        bindingId: 'evidence-export-binding',
        boundAt: 900_000,
        certification: validCertification(m),
    });
}

function releaseManifest(m, overrides = {}) {
    const generatedAt = 1_000_000;
    const input = {
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
    return m.buildReleaseEvidenceManifest(input);
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

function sourceChain(m, release = releaseManifest(m), readiness = providers(m)) {
    const binding = parityBinding(m);
    const reviewBundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
        generatedAt: 1_100_000,
    });
    return { binding, release, readiness, reviewBundle };
}

test('green commit-bound evidence exports deterministic review-ready JSON data without authority', async () => {
    const m = await modules();
    const chain = sourceChain(m);

    const bundle = m.buildCertificationReleaseEvidenceExport({
        buildIdentity: BUILD_IDENTITY,
        parityBinding: chain.binding,
        releaseManifest: chain.release,
        reviewBundle: chain.reviewBundle,
        providers: chain.readiness,
        exportedAt: 1_100_000,
    });

    assert.equal(bundle.schemaVersion, 1);
    assert.equal(bundle.sourceCommit, SOURCE);
    assert.equal(bundle.appVersion, '2.0.0');
    assert.equal(bundle.evidenceValid, true);
    assert.equal(bundle.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(bundle.readyForReview, true);
    assert.equal(bundle.cutoverAuthorized, false);
    assert.equal(bundle.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(bundle.parity.bindingValid, true);
    assert.equal(bundle.parity.certification.routeCount, 9);
    assert.equal(bundle.release.gates.ciGreen, true);
    assert.equal(bundle.release.gates.platformMatrixGreen, true);
    assert.deepEqual(bundle.review.globalBlockers, []);

    const json = m.serializeCertificationReleaseEvidenceExport(bundle);
    const parsed = JSON.parse(json);
    assert.equal(parsed.sourceCommit, SOURCE);
    assert.equal(parsed.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(parsed.cutoverAuthorized, false);
    assert.ok(json.endsWith('\n'));
});

test('blocked CI remains a valid diagnostic export but cannot become review-ready', async () => {
    const m = await modules();
    const failedRelease = releaseManifest(m, {
        ci: { sourceCommit: SOURCE, status: 'failed', runId: 'ci-failed', completedAt: 990_000 },
    });
    const chain = sourceChain(m, failedRelease);

    const bundle = m.buildCertificationReleaseEvidenceExport({
        buildIdentity: BUILD_IDENTITY,
        parityBinding: chain.binding,
        releaseManifest: chain.release,
        reviewBundle: chain.reviewBundle,
        providers: chain.readiness,
    });

    assert.equal(bundle.evidenceValid, true);
    assert.equal(bundle.reviewStatus, 'BLOCKED');
    assert.equal(bundle.readyForReview, false);
    assert.equal(bundle.release.gates.ciGreen, false);
    assert.ok(bundle.release.issues.includes('ci:status-failed'));
    assert.ok(bundle.review.globalBlockers.includes('release-gate:ciGreen'));
    assert.equal(bundle.cutoverAuthorized, false);
});

test('evidence export rejects cross-commit release, binding, or review evidence', async () => {
    const m = await modules();
    const chain = sourceChain(m);

    assert.throws(
        () => m.buildCertificationReleaseEvidenceExport({
            buildIdentity: { ...BUILD_IDENTITY, sourceCommit: OTHER },
            parityBinding: chain.binding,
            releaseManifest: chain.release,
            reviewBundle: chain.reviewBundle,
            providers: chain.readiness,
        }),
        (error) => error.code === 'INVALID_EVIDENCE_EXPORT_INPUT',
    );

    assert.throws(
        () => m.buildCertificationReleaseEvidenceExport({
            buildIdentity: BUILD_IDENTITY,
            parityBinding: { ...chain.binding, sourceCommit: OTHER },
            releaseManifest: chain.release,
            reviewBundle: chain.reviewBundle,
            providers: chain.readiness,
        }),
        (error) => error.code === 'INVALID_EVIDENCE_EXPORT_INPUT',
    );

    assert.throws(
        () => m.buildCertificationReleaseEvidenceExport({
            buildIdentity: BUILD_IDENTITY,
            parityBinding: chain.binding,
            releaseManifest: chain.release,
            reviewBundle: { ...chain.reviewBundle, sourceCommit: OTHER },
            providers: chain.readiness,
        }),
        (error) => error.code === 'INVALID_EVIDENCE_EXPORT_INPUT',
    );
});

test('serializer whitelists schema and drops injected prompts, keys, URLs, and arbitrary fields', async () => {
    const m = await modules();
    const chain = sourceChain(m);
    const bundle = m.buildCertificationReleaseEvidenceExport({
        buildIdentity: BUILD_IDENTITY,
        parityBinding: chain.binding,
        releaseManifest: chain.release,
        reviewBundle: chain.reviewBundle,
        providers: chain.readiness,
    });

    const forged = {
        ...bundle,
        prompt: 'PRIVATE_PROMPT_SENTINEL',
        apiKey: 'SECRET_KEY_SENTINEL',
        mediaUrl: 'https://private.invalid/media',
        parity: {
            ...bundle.parity,
            prompt: 'NESTED_PRIVATE_SENTINEL',
            certification: {
                ...bundle.parity.certification,
                routes: bundle.parity.certification.routes.map((route, index) => index === 0
                    ? { ...route, prompt: 'ROUTE_PRIVATE_SENTINEL', apiKey: 'ROUTE_KEY_SENTINEL' }
                    : route),
            },
        },
    };

    const json = m.serializeCertificationReleaseEvidenceExport(forged);
    for (const sentinel of [
        'PRIVATE_PROMPT_SENTINEL',
        'SECRET_KEY_SENTINEL',
        'private.invalid',
        'NESTED_PRIVATE_SENTINEL',
        'ROUTE_PRIVATE_SENTINEL',
        'ROUTE_KEY_SENTINEL',
    ]) {
        assert.equal(json.includes(sentinel), false, `serializer leaked ${sentinel}`);
    }

    const parsed = JSON.parse(json);
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'prompt'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'apiKey'), false);
});

test('serializer refuses outer authorization or invalid identity claims', async () => {
    const m = await modules();
    const chain = sourceChain(m);
    const bundle = m.buildCertificationReleaseEvidenceExport({
        buildIdentity: BUILD_IDENTITY,
        parityBinding: chain.binding,
        releaseManifest: chain.release,
        reviewBundle: chain.reviewBundle,
        providers: chain.readiness,
    });

    assert.throws(
        () => m.serializeCertificationReleaseEvidenceExport({ ...bundle, cutoverAuthorized: true }),
        (error) => error.code === 'INVALID_EVIDENCE_EXPORT_INPUT',
    );
    assert.throws(
        () => m.serializeCertificationReleaseEvidenceExport({ ...bundle, sourceCommit: 'short' }),
        (error) => error.code === 'INVALID_EVIDENCE_EXPORT_INPUT',
    );
});

test('P1B.22 export module is pure in-memory and isolated from UI/execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/evidenceExport.mjs', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');
    const diagnostics = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');

    for (const token of [
        'fs.',
        'writeFile',
        'download',
        'Blob(',
        'URL.createObjectURL',
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'routeGenerationRequest(',
        'localAI.generate',
        'muapi.generate',
    ]) {
        assert.equal(source.includes(token), false, `unexpected export side effect token: ${token}`);
    }

    assert.equal(image.includes('evidenceExport'), false);
    assert.equal(video.includes('evidenceExport'), false);
    assert.equal(diagnostics.includes('evidenceExport'), false);
    assert.ok(source.includes("EVIDENCE_EXPORT_EXECUTION_AUTHORITY = 'legacy-dispatcher-only'"));
    assert.ok(source.includes('cutoverAuthorized: false'));
});
