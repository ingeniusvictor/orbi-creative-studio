const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function modules() {
    const evidenceExport = await import('../src/lib/computeRouter/evidenceExport.mjs');
    const validator = await import('../src/lib/computeRouter/evidenceExportValidator.mjs');
    const binding = await import('../src/lib/computeRouter/parityBuildBinding.mjs');
    const release = await import('../src/lib/computeRouter/releaseEvidenceManifest.mjs');
    const review = await import('../src/lib/computeRouter/cutoverReviewBundle.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    return {
        ...evidenceExport,
        ...validator,
        ...binding,
        ...release,
        ...review,
        ...targets,
        ...adapters,
    };
}

const SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
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
            assert.ok(capability);
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
        bindingId: 'validator-binding',
        boundAt: 900_000,
        certification: validCertification(m),
    });
}

function releaseManifest(m, ciStatus = 'passed') {
    const generatedAt = 1_000_000;
    return m.buildReleaseEvidenceManifest({
        sourceCommit: SOURCE,
        generatedAt,
        ci: { sourceCommit: SOURCE, status: ciStatus, runId: 'ci-1', completedAt: 990_000 },
        platforms: {
            linux: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'linux-1', completedAt: 991_000 },
            macos: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'macos-1', completedAt: 992_000 },
            windows: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'windows-1', completedAt: 993_000 },
        },
        securityReview: { sourceCommit: SOURCE, approved: true, reviewId: 'sec-1', reviewedAt: 994_000 },
        rollbackPlan: { sourceCommit: SOURCE, approved: true, planId: 'rollback-1', reviewedAt: 995_000 },
    });
}

function providers(m) {
    return m.createCurrentProviderDescriptors({
        sdcpp: { health: 'ready' },
        wan2gp: { health: 'ready' },
        muapi: { health: 'ready', credentials: 'available' },
    });
}

function exportedBundle(m, ciStatus = 'passed') {
    const binding = parityBinding(m);
    const release = releaseManifest(m, ciStatus);
    const readiness = providers(m);
    const reviewBundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers: readiness,
        generatedAt: 1_100_000,
    });

    return m.buildCertificationReleaseEvidenceExport({
        buildIdentity: BUILD_IDENTITY,
        parityBinding: binding,
        releaseManifest: release,
        reviewBundle,
        providers: readiness,
        exportedAt: 1_100_000,
    });
}

test('valid review-ready JSON parses and validates while explicitly not claiming authenticity', async () => {
    const m = await modules();
    const bundle = exportedBundle(m);
    const json = m.serializeCertificationReleaseEvidenceExport(bundle);
    const parsed = m.parseCertificationReleaseEvidenceExport(json);

    assert.equal(parsed.validation.valid, true);
    assert.equal(parsed.validation.sourceCommit, SOURCE);
    assert.equal(parsed.validation.parityCertified, true);
    assert.equal(parsed.validation.releaseReady, true);
    assert.equal(parsed.validation.readyForReview, true);
    assert.equal(parsed.validation.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(parsed.validation.cutoverAuthorized, false);
    assert.equal(parsed.validation.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(parsed.validation.authenticityVerified, false);
    assert.equal(Object.isFrozen(parsed.bundle), true);
});

test('blocked CI export remains structurally valid and reports blockers offline', async () => {
    const m = await modules();
    const bundle = exportedBundle(m, 'failed');
    const validation = m.validateCertificationReleaseEvidenceExport(bundle);

    assert.equal(validation.valid, true);
    assert.equal(validation.releaseReady, false);
    assert.equal(validation.readyForReview, false);
    assert.equal(validation.reviewStatus, 'BLOCKED');
    assert.ok(validation.blockerCount > 0);
    assert.equal(validation.authenticityVerified, false);
});

test('offline validator rejects unknown injected fields instead of silently accepting them', async () => {
    const m = await modules();
    const bundle = exportedBundle(m);

    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport({
            ...bundle,
            prompt: 'INJECTED_PRIVATE_FIELD',
        }),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );

    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport({
            ...bundle,
            release: { ...bundle.release, apiKey: 'INJECTED_KEY' },
        }),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
});

test('offline validator detects forged release gate inconsistent with proof evidence', async () => {
    const m = await modules();
    const bundle = exportedBundle(m, 'failed');
    const forged = {
        ...bundle,
        release: {
            ...bundle.release,
            gates: { ...bundle.release.gates, ciGreen: true },
        },
    };

    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport(forged),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
});

test('offline validator detects parity route tampering', async () => {
    const m = await modules();
    const bundle = exportedBundle(m);
    const routes = bundle.parity.certification.routes.map((route, index) => index === 0
        ? { ...route, samples: 0, matches: 0, certified: true }
        : route);
    const forged = {
        ...bundle,
        parity: {
            ...bundle.parity,
            certification: { ...bundle.parity.certification, routes },
        },
    };

    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport(forged),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
});

test('offline validator detects review summary and blocker inconsistencies', async () => {
    const m = await modules();
    const bundle = exportedBundle(m, 'failed');

    const badSummary = {
        ...bundle,
        review: {
            ...bundle.review,
            summary: { ...bundle.review.summary, blockedRouteCount: 0 },
        },
    };
    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport(badSummary),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );

    const badBlockers = {
        ...bundle,
        review: {
            ...bundle.review,
            globalBlockers: bundle.review.globalBlockers
                .filter((item) => item !== 'release-gate:ciGreen'),
        },
    };
    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport(badBlockers),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
});

test('offline validator rejects any authorization claim or non-legacy authority', async () => {
    const m = await modules();
    const bundle = exportedBundle(m);

    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport({
            ...bundle,
            cutoverAuthorized: true,
        }),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
    assert.throws(
        () => m.validateCertificationReleaseEvidenceExport({
            ...bundle,
            executionAuthority: 'compute-router',
        }),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
});

test('parser rejects malformed JSON and never treats parsing as provenance verification', async () => {
    const m = await modules();
    assert.throws(
        () => m.parseCertificationReleaseEvidenceExport('{not-json'),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );

    const bundle = exportedBundle(m);
    const json = m.serializeCertificationReleaseEvidenceExport(bundle);
    const result = m.parseCertificationReleaseEvidenceExport(json);
    assert.equal(result.validation.authenticityVerified, false);
});

test('P1B.23 validator is pure and isolated from UI/execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/evidenceExportValidator.mjs', 'utf8');
    const diagnostics = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        "from 'node:fs'",
        "require('fs')",
        "require('node:fs')",
        'writeFile',
        'download',
        'Blob(',
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'routeGenerationRequest(',
        'localAI.generate',
        'muapi.generate',
    ]) {
        assert.equal(source.includes(token), false, `unexpected validator side effect: ${token}`);
    }

    assert.equal(diagnostics.includes('evidenceExportValidator'), false);
    assert.equal(image.includes('evidenceExportValidator'), false);
    assert.equal(video.includes('evidenceExportValidator'), false);
    assert.ok(source.includes('authenticityVerified: false'));
    assert.ok(source.includes("EVIDENCE_EXPORT_VALIDATOR_AUTHORITY = 'legacy-dispatcher-only'"));
});
