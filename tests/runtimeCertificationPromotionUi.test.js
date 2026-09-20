const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C24 Router Diagnostics adds one explicit promotion-only action after P1C23 certification', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiRuntimeCertificationPromotion = 'promotion-only'"));
    assert.ok(panel.includes("button.dataset.orbiRuntimeCertificationPromotionPrepare = 'promotion-only'"));
    assert.ok(panel.includes('button.onclick = onPrepare'));
    assert.ok(panel.includes('runtimeCertificationPromotionPrepare = null'));
    assert.ok(panel.includes('runtimeCertificationPromotionSummaryProvider = null'));
    assert.ok(panel.includes('resolveRuntimeCertificationPromotionState'));
    assert.ok(panel.includes('renderRuntimeCertificationPromotionSection'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 6);
    assert.equal((panel.match(/\.onchange\s*=/g) || []).length, 1);
    assert.equal((panel.match(/\.oninput\s*=/g) || []).length, 1);
});

test('P1C24 UI requires an existing certification summary before preparing promotion', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("!benchmarkCertificationState?.summary"));
    assert.ok(panel.includes('runtimeCertificationPromotionPrepare(selectedBenchmarkTarget)'));
    assert.ok(panel.includes("result.status === 'RUNTIME_CERTIFICATION_PROMOTION_READY'"));
    assert.ok(panel.includes('result.sourceReviewRequired === true'));
    assert.ok(panel.includes('result.sourceMutationApplied === false'));
    assert.ok(panel.includes('result.runtimeRegistryLoaded === false'));
    assert.ok(panel.includes('result.authenticityVerified === false'));
    assert.ok(panel.includes('result.routingEligible === false'));
    assert.ok(panel.includes('result.cutoverAuthorized === false'));
    assert.ok(panel.includes("result.executionAuthority === 'legacy-dispatcher-only'"));
});

test('P1C24 UI renders sanitized promotion summary only', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    for (const allowed of [
        'summary.modelId',
        'summary.backend',
        'summary.resolution.width',
        'summary.resolution.height',
        'summary.baseSourceRevision',
        'summary.proposedSourceRevision',
        'summary.minSystemRamMiB',
        'summary.minVramMiB',
    ]) {
        assert.ok(panel.includes(allowed), `missing P1C24 summary field: ${allowed}`);
    }

    assert.equal(
        /summary\.reviewerId(?!entityVerified)/.test(panel),
        false,
        'P1C24 promotion UI must not render reviewer id',
    );

    for (const forbidden of [
        'readRuntimeCertificationPromotionPackage',
        'summary.certificationEntry',
        'summary.certificationRecord',
        'summary.certifiedProfile',
        'summary.reviewNote',
        'summary.sourceCommit',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'result.reason',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected P1C24 UI exposure: ${forbidden}`);
    }
});

test('P1C24 Settings wires prepare and sanitized summary but not raw promotion package', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes('prepareRuntimeCertificationPromotion'));
    assert.ok(settings.includes('getRuntimeCertificationPromotionSummary'));
    assert.ok(settings.includes(
        'runtimeCertificationPromotionPrepare: prepareRuntimeCertificationPromotion',
    ));
    assert.ok(settings.includes(
        'runtimeCertificationPromotionSummaryProvider: getRuntimeCertificationPromotionSummary',
    ));

    assert.equal(settings.includes('readRuntimeCertificationPromotionPackage'), false);
    assert.equal(settings.includes('runtimeResourceProfileCertifications'), false);
    assert.equal(settings.includes('RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE'), false);
});

test('P1C24 remains outside startup and generation surfaces', () => {
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const source of [main, image, video]) {
        assert.equal(source.includes('runtimeCertificationPromotion'), false);
        assert.equal(source.includes('prepareRuntimeCertificationPromotion'), false);
        assert.equal(source.includes('runtimeCertificationPromotionPrepare'), false);
    }
});

test('P1C24 bilingual promotion copy exists', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.runtimePromotionTitle',
        'routerDiagnostics.runtimePromotionSubtitle',
        'routerDiagnostics.runtimePromotionTarget',
        'routerDiagnostics.runtimePromotionRevision',
        'routerDiagnostics.runtimePromotionSystemRam',
        'routerDiagnostics.runtimePromotionVram',
        'routerDiagnostics.runtimePromotionSourceReview',
        'routerDiagnostics.runtimePromotionRuntimeRegistry',
        'routerDiagnostics.runtimePromotionRequired',
        'routerDiagnostics.runtimePromotionReady',
        'routerDiagnostics.runtimePromotionNeedsCertification',
        'routerDiagnostics.runtimePromotionPrepare',
        'routerDiagnostics.runtimePromotionPreparing',
        'routerDiagnostics.runtimePromotionPrepared',
        'routerDiagnostics.runtimePromotionRejected',
        'routerDiagnostics.runtimePromotionBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});
