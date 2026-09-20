const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function validSnapshot() {
    return {
        schemaVersion: 1,
        snapshotType: 'p1c10-shadow-compatibility-diagnostics',
        capturedAt: '2026-09-16T08:00:00.000Z',
        mode: 'shadow-diagnostic-only',
        context: {
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 1024,
            height: 1024,
        },
        registry: {
            match: true,
            certifiedProfile: true,
            profileStatus: 'RESOURCE_PROFILE_CERTIFIED',
        },
        compatibility: {
            status: 'COMPATIBILITY_CANDIDATE',
            candidate: true,
            reasons: [],
        },
        hardware: {
            backendState: 'supported',
        },
        resources: {
            systemRam: {
                state: 'sufficient',
                requiredMiB: 10200,
                observedMiB: 32768,
            },
            vram: {
                state: 'sufficient',
                requiredMiB: 7440,
                observedMiB: 12288,
            },
        },
        boundaries: {
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        },
    };
}

test('P1C11 snapshot validator accepts the exact P1C10 sanitized shape', async () => {
    const diagnostics = await import('../src/lib/computeRouter/shadowCompatibilityDiagnostics.mjs');
    const result = diagnostics.validateShadowCompatibilitySnapshot(validSnapshot());
    assert.deepEqual(result, { ok: true, reason: null });
});

test('P1C11 snapshot validator rejects extra provenance or reviewer fields', async () => {
    const diagnostics = await import('../src/lib/computeRouter/shadowCompatibilityDiagnostics.mjs');
    const snapshot = validSnapshot();
    snapshot.reviewer = { id: 'reviewer-001' };
    assert.equal(
        diagnostics.validateShadowCompatibilitySnapshot(snapshot).reason,
        'SNAPSHOT_SHAPE_INVALID',
    );
});

test('P1C11 snapshot validator rejects arbitrary reasons and forged authority', async () => {
    const diagnostics = await import('../src/lib/computeRouter/shadowCompatibilityDiagnostics.mjs');

    const reasonSnapshot = validSnapshot();
    reasonSnapshot.compatibility.reasons = ['arbitrary-user-controlled-text'];
    assert.equal(
        diagnostics.validateShadowCompatibilitySnapshot(reasonSnapshot).reason,
        'SNAPSHOT_COMPATIBILITY_INVALID',
    );

    const authoritySnapshot = validSnapshot();
    authoritySnapshot.boundaries.routingEligible = true;
    assert.equal(
        diagnostics.validateShadowCompatibilitySnapshot(authoritySnapshot).reason,
        'SNAPSHOT_AUTHORITY_INVALID',
    );
});

test('Router diagnostics keeps validated shadow rendering while P1C16 adds one diagnostic-only refresh action', () => {
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(panel.includes('validateShadowCompatibilitySnapshot'));
    assert.ok(panel.includes('renderShadowCompatibilitySection'));
    assert.ok(panel.includes('shadowCompatibilitySnapshot = null'));
    assert.ok(panel.includes("section.dataset.orbiShadowCompatibility = 'read-only'"));
    assert.ok(panel.includes('refresh.onclick = render'));
    assert.ok(panel.includes("refreshButton.dataset.orbiShadowRefresh = 'diagnostic-only'"));
    assert.ok(panel.includes('refreshButton.onclick = onRefresh'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 5);

    for (const token of [
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'routeGenerationRequest',
        'localAI.generate',
        'muapi.generate',
        'certificationRecord',
        '.reviewNote',
        'auxiliaryArtifacts',
        'runtimeBinarySha256',
        'modelArtifactSha256',
    ]) {
        assert.equal(panel.includes(token), false, `unexpected P1C11 panel capability: ${token}`);
    }
});

test('P1C11 adds bilingual shadow diagnostics copy', () => {
    const i18n = read('src/lib/i18n.js');
    const keys = [
        'routerDiagnostics.shadowTitle',
        'routerDiagnostics.shadowSubtitle',
        'routerDiagnostics.shadowUnavailable',
        'routerDiagnostics.shadowContext',
        'routerDiagnostics.shadowCompatibility',
        'routerDiagnostics.shadowProfile',
        'routerDiagnostics.shadowCertified',
        'routerDiagnostics.shadowNotCertified',
        'routerDiagnostics.shadowSystemRam',
        'routerDiagnostics.shadowVram',
        'routerDiagnostics.shadowReasons',
        'routerDiagnostics.shadowNoReasons',
        'routerDiagnostics.shadowCandidate',
        'routerDiagnostics.shadowBlocked',
        'routerDiagnostics.shadowUnknown',
        'routerDiagnostics.shadowBoundaryNote',
    ];

    for (const key of keys) {
        assert.equal(i18n.split(`'${key}':`).length - 1, 2, `missing EN/ZH key: ${key}`);
    }
});

test('P1C11 does not source shadow evidence from generation components or main startup', () => {
    const settings = read('src/components/SettingsModal.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');
    const main = read('src/main.js');

    assert.ok(settings.includes('RouterDiagnosticsPanel({'));
    assert.ok(settings.includes('shadowCompatibilitySnapshotProvider: readShadowCompatibilitySnapshot'));
    assert.equal(settings.includes('publishShadowCompatibilitySnapshot'), false);
    assert.equal(image.includes('shadowCompatibilityDiagnostics'), false);
    assert.equal(video.includes('shadowCompatibilityDiagnostics'), false);
    assert.equal(main.includes('shadowCompatibilityDiagnostics'), false);
    assert.equal(main.includes('shadowCompatibilitySnapshot'), false);
});
