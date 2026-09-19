const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C22 Router Diagnostics adds one review-only package action after the 3-sample benchmark flow', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiBenchmarkReview = 'review-only'"));
    assert.ok(panel.includes("button.dataset.orbiBenchmarkReviewPrepare = 'review-only'"));
    assert.ok(panel.includes("input.dataset.orbiBenchmarkSafetyMargin = 'explicit-review-input'"));
    assert.ok(panel.includes('button.onclick = onPrepare'));
    assert.ok(panel.includes('input.oninput = () =>'));
    assert.ok(panel.includes('benchmarkReviewPrepare = null'));
    assert.ok(panel.includes('benchmarkReviewSummaryProvider = null'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 5);
    assert.equal((panel.match(/\.onchange\s*=/g) || []).length, 1);
});

test('P1C22 requires an explicit 0-100 safety margin and a ready 3/3 session', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("benchmarkSafetyMarginPct = ''"));
    assert.ok(panel.includes("typeof value !== 'string' || !value.trim()"));
    assert.ok(panel.includes('number >= 0 && number <= 100'));
    assert.ok(panel.includes("benchmarkSessionState?.readyForReview !== true"));
    assert.ok(panel.includes('safetyMarginPct: Number(benchmarkSafetyMarginPct)'));
    assert.equal(panel.includes('safetyMarginPct: 20'), false);
});

test('P1C22 UI renders only sanitized recommendation summary and no evidence provenance', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    for (const allowed of [
        'summary.observedPeakSystemRamMiB',
        'summary.requirements.minSystemRamMiB',
        'summary.observedPeakVramMiB',
        'summary.requirements.minVramMiB',
        'summary.safetyMarginPct',
    ]) {
        assert.ok(panel.includes(allowed), `missing sanitized review field: ${allowed}`);
    }

    for (const forbidden of [
        'readUserBenchmarkReviewSession',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'runtimeIdentity',
        'runtimeVersion',
        'summary.sourceCommit',
        'summary.harnessVersion',
        'certificationRecord',
        '.reviewNote',
        'reviewerIdentityVerified',
        'result.reason',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected P1C22 UI exposure: ${forbidden}`);
    }
});

test('P1C22 Settings wires prepare and sanitized summary only, not the internal review session', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes('prepareUserBenchmarkReview'));
    assert.ok(settings.includes('getUserBenchmarkReviewSummary'));
    assert.ok(settings.includes('benchmarkReviewPrepare: prepareUserBenchmarkReview'));
    assert.ok(settings.includes('benchmarkReviewSummaryProvider: getUserBenchmarkReviewSummary'));
    assert.equal(settings.includes('readUserBenchmarkReviewSession'), false);
    assert.equal(settings.includes('certifyResourceProfile'), false);
    assert.equal(settings.includes('RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE'), false);
});

test('P1C22 remains outside generation and startup execution surfaces', () => {
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const source of [main, image, video]) {
        assert.equal(source.includes('userBenchmarkReview'), false);
        assert.equal(source.includes('prepareUserBenchmarkReview'), false);
        assert.equal(source.includes('benchmarkReviewPrepare'), false);
    }
});

test('P1C22 bilingual review copy exists', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.benchmarkReviewTitle',
        'routerDiagnostics.benchmarkReviewSubtitle',
        'routerDiagnostics.benchmarkReviewMargin',
        'routerDiagnostics.benchmarkReviewSystemRam',
        'routerDiagnostics.benchmarkReviewVram',
        'routerDiagnostics.benchmarkReviewStatus',
        'routerDiagnostics.benchmarkReviewReady',
        'routerDiagnostics.benchmarkReviewNotApplicable',
        'routerDiagnostics.benchmarkReviewAwaitingMargin',
        'routerDiagnostics.benchmarkReviewNeedsSamples',
        'routerDiagnostics.benchmarkReviewMarginInput',
        'routerDiagnostics.benchmarkReviewMarginPlaceholder',
        'routerDiagnostics.benchmarkReviewPrepare',
        'routerDiagnostics.benchmarkReviewPreparing',
        'routerDiagnostics.benchmarkReviewPrepared',
        'routerDiagnostics.benchmarkReviewRejected',
        'routerDiagnostics.benchmarkReviewBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C22 keeps human certification and routing boundaries explicit', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('result.reviewOnly === true'));
    assert.ok(panel.includes('result.requiresHumanCertification === true'));
    assert.ok(panel.includes('result.productionProfilePromoted === false'));
    assert.ok(panel.includes('result.routingEligible === false'));
    assert.ok(panel.includes('result.cutoverAuthorized === false'));
    assert.ok(panel.includes("result.executionAuthority === 'legacy-dispatcher-only'"));
    assert.equal(panel.includes('certifyResourceProfile('), false);
    assert.equal(panel.includes('productionProfilePromoted === true'), false);
    assert.equal(panel.includes('routingEligible === true'), false);
    assert.equal(panel.includes('cutoverAuthorized === true'), false);
});
