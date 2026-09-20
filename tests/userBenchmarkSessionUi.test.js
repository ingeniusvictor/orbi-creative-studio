const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C21 Router Diagnostics adds one explicit benchmark-only action and reuses the target selector', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes("section.dataset.orbiBenchmarkSession = 'review-evidence-only'"));
    assert.ok(panel.includes("button.dataset.orbiBenchmarkCapture = 'benchmark-only'"));
    assert.ok(panel.includes('button.onclick = onCapture'));
    assert.ok(panel.includes('benchmarkSampleCapture = null'));
    assert.ok(panel.includes('benchmarkSessionStateProvider = null'));
    assert.ok(panel.includes('resolveBenchmarkSessionState'));
    assert.ok(panel.includes('renderBenchmarkSessionSection'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 6);
    assert.equal((panel.match(/\.onchange\s*=/g) || []).length, 1);
    assert.equal((panel.match(/orbiShadowTargetSelector/g) || []).length, 1);
});

test('P1C21 benchmark button captures only one sample per click and never loops', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('const result = await benchmarkSampleCapture(selectedTarget)'));
    assert.equal(panel.includes('for (let runIndex'), false);
    assert.equal(panel.includes('while ('), false);
    assert.equal(panel.includes('Promise.all(['), false);
    assert.ok(panel.includes("benchmarkActionStatus === 'running'"));
    assert.ok(panel.includes("result.status === 'USER_BENCHMARK_SESSION_READY_FOR_REVIEW'"));
    assert.ok(panel.includes("result.status === 'USER_BENCHMARK_SESSION_COLLECTING'"));
});

test('P1C21 UI never renders benchmark evidence hashes, paths, review records or raw rejection reasons', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.equal(
        /summary\\.reviewerId(?!entityVerified)/.test(panel),
        false,
        'benchmark UI must not render a reviewer id',
    );

    for (const token of [
        'readUserBenchmarkSessionEvidence',
        'runEvidence',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'runtimeIdentity',
        'runtimeVersion',
        'certificationRecord',
        '.reviewNote',
        'result.reason',
    ]) {
        assert.equal(panel.includes(token), false, `unexpected benchmark evidence exposure: ${token}`);
    }
});

test('P1C21 Settings wires capture and sanitized state, but not evidence or P1C8 certification', () => {
    const settings = read('src/components/SettingsModal.js');

    assert.ok(settings.includes('captureUserBenchmarkSample'));
    assert.ok(settings.includes('getUserBenchmarkSessionState'));
    assert.ok(settings.includes('benchmarkSampleCapture: captureUserBenchmarkSample'));
    assert.ok(settings.includes('benchmarkSessionStateProvider: getUserBenchmarkSessionState'));
    assert.equal(settings.includes('readUserBenchmarkSessionEvidence'), false);
    assert.equal(settings.includes('buildBenchmarkSessionEvidence'), false);
    assert.equal(settings.includes('recordResourceProfileCertification'), false);
    assert.equal(settings.includes('certifyResourceProfile'), false);
});

test('P1C21 benchmark workflow remains outside generation and renderer startup surfaces', () => {
    const main = read('src/main.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const source of [main, image, video]) {
        assert.equal(source.includes('userBenchmarkSession'), false);
        assert.equal(source.includes('captureUserBenchmarkSample'), false);
        assert.equal(source.includes('benchmarkSampleCapture'), false);
        assert.equal(source.includes('benchmarkSessionStateProvider'), false);
    }
});

test('P1C21 benchmark copy exists in English and Chinese', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.benchmarkTitle',
        'routerDiagnostics.benchmarkSubtitle',
        'routerDiagnostics.benchmarkTarget',
        'routerDiagnostics.benchmarkNoTarget',
        'routerDiagnostics.benchmarkSamples',
        'routerDiagnostics.benchmarkStatus',
        'routerDiagnostics.benchmarkStatusEmpty',
        'routerDiagnostics.benchmarkStatusCollecting',
        'routerDiagnostics.benchmarkStatusReady',
        'routerDiagnostics.benchmarkStatusUnavailable',
        'routerDiagnostics.benchmarkRunSample',
        'routerDiagnostics.benchmarkRunning',
        'routerDiagnostics.benchmarkCaptured',
        'routerDiagnostics.benchmarkReady',
        'routerDiagnostics.benchmarkRejected',
        'routerDiagnostics.benchmarkSelectionRequired',
        'routerDiagnostics.benchmarkResourceWarning',
        'routerDiagnostics.benchmarkReadyNote',
        'routerDiagnostics.benchmarkBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C21 UI keeps authority and certification boundaries explicit', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('result.benchmarkOnly === true'));
    assert.ok(panel.includes('result.productionProfilePromoted === false'));
    assert.ok(panel.includes('result.routingEligible === false'));
    assert.ok(panel.includes('result.cutoverAuthorized === false'));
    assert.ok(panel.includes("result.executionAuthority === 'legacy-dispatcher-only'"));
    assert.equal(panel.includes('productionProfilePromoted === true'), false);
    assert.equal(panel.includes('routingEligible === true'), false);
    assert.equal(panel.includes('cutoverAuthorized === true'), false);
});
