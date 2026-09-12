const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');

async function modules() {
    const report = await import('../src/lib/computeRouter/evidenceIntegrityReport.mjs');
    const fingerprint = await import('../src/lib/computeRouter/evidenceFingerprint.mjs');
    const evidenceExport = await import('../src/lib/computeRouter/evidenceExport.mjs');
    const binding = await import('../src/lib/computeRouter/parityBuildBinding.mjs');
    const release = await import('../src/lib/computeRouter/releaseEvidenceManifest.mjs');
    const review = await import('../src/lib/computeRouter/cutoverReviewBundle.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    return { ...report, ...fingerprint, ...evidenceExport, ...binding, ...release, ...review, ...targets, ...adapters };
}

const SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BUILD_IDENTITY = Object.freeze({ schemaVersion: 1, available: true, sourceCommit: SOURCE, appVersion: '2.0.0', reason: null });

function validCertification(m) {
    const caps = new Map([
        ['sdcpp-device', m.SDCPP_CAPABILITIES],
        ['wan2gp-lan', m.WAN2GP_CAPABILITIES],
        ['muapi-cloud', m.MUAPI_CAPABILITIES],
    ]);
    return {
        schemaVersion: 1, certified: true, reason: 'PARITY_CERTIFIED',
        maxEvidenceAgeMs: 7 * 24 * 60 * 60 * 1000, maxFutureSkewMs: 60 * 1000,
        routes: m.STUDIO_PARITY_TARGETS.map((target) => {
            const capability = caps.get(target.expectedProviderId).find((item) => item.operations.includes(target.operation));
            assert.ok(capability);
            return {
                routeKey: target.routeKey, expectedProviderId: target.expectedProviderId, operation: target.operation,
                minSamples: target.minSamples, minDistinctModels: target.minDistinctModels,
                samples: target.minSamples, matches: target.minSamples, blocked: 0, mismatches: 0,
                distinctModels: 1, modelIds: [capability.modelId], certified: true, reasons: [],
            };
        }),
    };
}

function buildBundle(m, ciStatus = 'passed') {
    const binding = m.bindParityCertificationToBuild({ sourceCommit: SOURCE, bindingId: 'integrity-binding', boundAt: 900_000, certification: validCertification(m) });
    const release = m.buildReleaseEvidenceManifest({
        sourceCommit: SOURCE, generatedAt: 1_000_000,
        ci: { sourceCommit: SOURCE, status: ciStatus, runId: 'ci-1', completedAt: 990_000 },
        platforms: {
            linux: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'linux-1', completedAt: 991_000 },
            macos: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'macos-1', completedAt: 992_000 },
            windows: { sourceCommit: SOURCE, status: 'passed', evidenceId: 'windows-1', completedAt: 993_000 },
        },
        securityReview: { sourceCommit: SOURCE, approved: true, reviewId: 'sec-1', reviewedAt: 994_000 },
        rollbackPlan: { sourceCommit: SOURCE, approved: true, planId: 'rollback-1', reviewedAt: 995_000 },
    });
    const providers = m.createCurrentProviderDescriptors({
        sdcpp: { health: 'ready' }, wan2gp: { health: 'ready' }, muapi: { health: 'ready', credentials: 'available' },
    });
    const reviewBundle = m.buildStudioCutoverReviewBundle({ sourceCommit: SOURCE, parityBinding: binding, releaseManifest: release, providers, generatedAt: 1_100_000 });
    return m.buildCertificationReleaseEvidenceExport({ buildIdentity: BUILD_IDENTITY, parityBinding: binding, releaseManifest: release, reviewBundle, providers, exportedAt: 1_100_000 });
}

test('matching fingerprint produces non-authorizing INTEGRITY_VERIFIED report', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const fingerprint = await m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto });
    const report = await m.inspectEvidenceIntegrity({ exportBundle: bundle, fingerprint, cryptoProvider: webcrypto, checkedAt: 1_200_000 });

    assert.equal(report.status, 'INTEGRITY_VERIFIED');
    assert.equal(report.integrityVerified, true);
    assert.equal(report.authenticityVerified, false);
    assert.equal(report.sourceCommit, SOURCE);
    assert.equal(report.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(report.readyForReview, true);
    assert.equal(report.expectedDigestHex, fingerprint.digestHex);
    assert.equal(report.actualDigestHex, fingerprint.digestHex);
    assert.deepEqual(report.reasons, []);
    assert.equal(report.cutoverAuthorized, false);
    assert.equal(report.executionAuthority, 'legacy-dispatcher-only');
});

test('fingerprint from different valid export reports mismatch instead of throwing', async () => {
    const m = await modules();
    const green = buildBundle(m, 'passed');
    const blocked = buildBundle(m, 'failed');
    const fingerprint = await m.createEvidenceFingerprint(green, { cryptoProvider: webcrypto });
    const report = await m.inspectEvidenceIntegrity({ exportBundle: blocked, fingerprint, cryptoProvider: webcrypto, checkedAt: 1_200_000 });

    assert.equal(report.status, 'FINGERPRINT_MISMATCH');
    assert.equal(report.integrityVerified, false);
    assert.ok(report.reasons.includes('DIGEST_MISMATCH'));
    assert.ok(report.reasons.includes('FINGERPRINT_METADATA_MISMATCH'));
    assert.equal(report.reviewStatus, 'BLOCKED');
});

test('invalid fingerprint returns stable diagnostic code without reflecting injected content', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const report = await m.inspectEvidenceIntegrity({
        exportBundle: bundle,
        fingerprint: { digestHex: 'PRIVATE_SENTINEL' },
        cryptoProvider: webcrypto,
        checkedAt: 1_200_000,
    });

    assert.equal(report.status, 'FINGERPRINT_INVALID');
    assert.equal(report.integrityVerified, false);
    assert.deepEqual(report.reasons, ['FINGERPRINT_SCHEMA_INVALID']);
    assert.equal(JSON.stringify(report).includes('PRIVATE_SENTINEL'), false);
});

test('invalid export returns stable diagnostic code without reflecting malicious fields', async () => {
    const m = await modules();
    const valid = buildBundle(m);
    const fingerprint = await m.createEvidenceFingerprint(valid, { cryptoProvider: webcrypto });
    const report = await m.inspectEvidenceIntegrity({
        exportBundle: { ...valid, prompt: 'MALICIOUS_PRIVATE_SENTINEL' },
        fingerprint,
        cryptoProvider: webcrypto,
        checkedAt: 1_200_000,
    });

    assert.equal(report.status, 'EXPORT_INVALID');
    assert.deepEqual(report.reasons, ['EXPORT_SCHEMA_OR_CONSISTENCY_INVALID']);
    assert.equal(JSON.stringify(report).includes('MALICIOUS_PRIVATE_SENTINEL'), false);
});

test('missing Web Crypto becomes explicit CRYPTO_UNAVAILABLE report', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const fingerprint = await m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto });
    const report = await m.inspectEvidenceIntegrity({ exportBundle: bundle, fingerprint, cryptoProvider: null, checkedAt: 1_200_000 });

    assert.equal(report.status, 'CRYPTO_UNAVAILABLE');
    assert.equal(report.integrityVerified, false);
    assert.deepEqual(report.reasons, ['CRYPTO_UNAVAILABLE']);
});

test('human formatter keeps authenticity and cutover boundaries explicit', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const fingerprint = await m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto });
    const report = await m.inspectEvidenceIntegrity({ exportBundle: bundle, fingerprint, cryptoProvider: webcrypto, checkedAt: 1_200_000 });
    const text = m.formatEvidenceIntegrityText(report);

    assert.ok(text.includes('ORBI Compute Router — Evidence Integrity Report'));
    assert.ok(text.includes('Integrity verified: YES'));
    assert.ok(text.includes('Authenticity verified: NO'));
    assert.ok(text.includes('Cutover authorized: NO'));
    assert.ok(text.includes('legacy-dispatcher-only'));
    assert.ok(text.includes('does not prove signer identity or provenance'));
});

test('formatter rejects any report that tries to claim cutover authority', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const fingerprint = await m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto });
    const report = await m.inspectEvidenceIntegrity({ exportBundle: bundle, fingerprint, cryptoProvider: webcrypto, checkedAt: 1_200_000 });

    assert.throws(
        () => m.formatEvidenceIntegrityText({ ...report, cutoverAuthorized: true }),
        (error) => error.code === 'INVALID_EVIDENCE_INTEGRITY_REPORT_INPUT',
    );
});

test('P1B.25 remains pure and isolated from UI/execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/evidenceIntegrityReport.mjs', 'utf8');
    const diagnostics = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        "from 'node:fs'", "from 'node:crypto'", 'writeFile', 'download', 'Blob(', 'fetch(',
        'ipcRenderer', 'ipcMain', 'localStorage', 'sessionStorage', 'routeGenerationRequest(',
        'localAI.generate', 'muapi.generate',
    ]) {
        assert.equal(source.includes(token), false, `unexpected integrity report side effect: ${token}`);
    }

    assert.equal(diagnostics.includes('evidenceIntegrityReport'), false);
    assert.equal(image.includes('evidenceIntegrityReport'), false);
    assert.equal(video.includes('evidenceIntegrityReport'), false);
    assert.ok(source.includes('authenticityVerified: false'));
    assert.ok(source.includes('cutoverAuthorized: false'));
});
