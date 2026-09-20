const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C23 Router Diagnostics adds one explicit certification-only action after P1C22 review', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiBenchmarkCertification = 'certification-only'"));
    assert.ok(panel.includes("button.dataset.orbiBenchmarkCertificationRecord = 'certification-only'"));
    assert.ok(panel.includes("approvalInput.dataset.orbiCertificationApproval = 'explicit-human-approval'"));
    assert.ok(panel.includes("idInput.dataset.orbiCertificationReviewerId = 'declared-metadata'"));
    assert.ok(panel.includes("nameInput.dataset.orbiCertificationReviewerName = 'declared-metadata'"));
    assert.ok(panel.includes("noteInput.dataset.orbiCertificationReviewNote = 'declared-metadata'"));
    assert.ok(panel.includes('button.onclick = onCertify'));
    assert.ok(panel.includes('benchmarkCertificationRecord = null'));
    assert.ok(panel.includes('benchmarkCertificationSummaryProvider = null'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 5);
    assert.equal((panel.match(/\.onchange\s*=/g) || []).length, 1);
    assert.equal((panel.match(/\.oninput\s*=/g) || []).length, 1);
});

test('P1C23 requires explicit approve checkbox plus declared reviewer and review note', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('approved === true'));
    assert.ok(panel.includes("decision: 'approve'"));
    assert.ok(panel.includes('id: benchmarkCertificationReviewerId'));
    assert.ok(panel.includes('displayName: benchmarkCertificationReviewerName'));
    assert.ok(panel.includes('reviewNote: benchmarkCertificationReviewNote'));
    assert.ok(panel.includes('reviewerId.trim().length <= 200'));
    assert.ok(panel.includes('reviewerDisplayName.trim().length <= 200'));
    assert.ok(panel.includes('reviewNote.trim().length <= 2000'));
});

test('P1C23 UI treats identity/authenticity/runtime activation as explicitly false', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('result.runtimeRegistryLoaded === false'));
    assert.ok(panel.includes('result.reviewerIdentityVerified === false'));
    assert.ok(panel.includes('result.authenticityVerified === false'));
    assert.ok(panel.includes('result.routingEligible === false'));
    assert.ok(panel.includes('result.cutoverAuthorized === false'));
    assert.ok(panel.includes("result.executionAuthority === 'legacy-dispatcher-only'"));
    assert.ok(panel.includes("t('routerDiagnostics.benchmarkCertificationNotVerified')"));
    assert.ok(panel.includes("t('routerDiagnostics.benchmarkCertificationNotLoaded')"));

    for (const forbidden of [
        'runtimeRegistryLoaded === true',
        'reviewerIdentityVerified === true',
        'authenticityVerified === true',
        'routingEligible === true',
        'cutoverAuthorized === true',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected P1C23 authority: ${forbidden}`);
    }
});

test('P1C23 certification summary does not render reviewer id, review note, raw record or evidence hashes', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('summary.reviewerDisplayName'));
    assert.ok(panel.includes('summary.minSystemRamMiB'));
    assert.ok(panel.includes('summary.minVramMiB'));

    assert.equal(/summary\.reviewerId(?!entityVerified)/.test(panel), false);

    for (const forbidden of [
        'summary.reviewNote',
        'readUserBenchmarkCertification',
        'certificationRecord',
        'summary.certifiedProfile',
        'result.certifiedProfile',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'summary.sourceCommit',
        'summary.harnessVersion',
        'result.reason',
    ]) {
        assert.equal(panel.includes(forbidden), false, `unexpected certification exposure: ${forbidden}`);
    }
});

test('P1C23 Settings wires record action and sanitized summary, not internal certification result', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes('recordUserBenchmarkCertification'));
    assert.ok(settings.includes('getUserBenchmarkCertificationSummary'));
    assert.ok(settings.includes('benchmarkCertificationRecord: recordUserBenchmarkCertification'));
    assert.ok(settings.includes(
        'benchmarkCertificationSummaryProvider: getUserBenchmarkCertificationSummary',
    ));

    assert.equal(settings.includes('readUserBenchmarkCertification'), false);
    assert.equal(settings.includes('certificationRecord'), false);
    assert.equal(settings.includes('runtimeResourceProfileCertifications'), false);
    assert.equal(settings.includes('RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE'), false);
});

test('P1C23 remains outside generation and startup execution surfaces', () => {
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const source of [main, image, video]) {
        assert.equal(source.includes('userBenchmarkCertification'), false);
        assert.equal(source.includes('recordUserBenchmarkCertification'), false);
        assert.equal(source.includes('benchmarkCertificationRecord'), false);
    }
});

test('P1C23 bilingual certification copy exists', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.benchmarkCertificationTitle',
        'routerDiagnostics.benchmarkCertificationSubtitle',
        'routerDiagnostics.benchmarkCertificationReviewer',
        'routerDiagnostics.benchmarkCertificationSystemRam',
        'routerDiagnostics.benchmarkCertificationVram',
        'routerDiagnostics.benchmarkCertificationIdentity',
        'routerDiagnostics.benchmarkCertificationAuthenticity',
        'routerDiagnostics.benchmarkCertificationRuntimeRegistry',
        'routerDiagnostics.benchmarkCertificationNotVerified',
        'routerDiagnostics.benchmarkCertificationNotLoaded',
        'routerDiagnostics.benchmarkCertificationReady',
        'routerDiagnostics.benchmarkCertificationNeedsReview',
        'routerDiagnostics.benchmarkCertificationReviewerId',
        'routerDiagnostics.benchmarkCertificationReviewerName',
        'routerDiagnostics.benchmarkCertificationReviewNote',
        'routerDiagnostics.benchmarkCertificationApproval',
        'routerDiagnostics.benchmarkCertificationRecord',
        'routerDiagnostics.benchmarkCertificationRecording',
        'routerDiagnostics.benchmarkCertificationRecorded',
        'routerDiagnostics.benchmarkCertificationRejected',
        'routerDiagnostics.benchmarkCertificationBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});
