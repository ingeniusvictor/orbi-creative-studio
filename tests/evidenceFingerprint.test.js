const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash, webcrypto } = require('node:crypto');

async function modules() {
    const fingerprint = await import('../src/lib/computeRouter/evidenceFingerprint.mjs');
    const evidenceExport = await import('../src/lib/computeRouter/evidenceExport.mjs');
    const binding = await import('../src/lib/computeRouter/parityBuildBinding.mjs');
    const release = await import('../src/lib/computeRouter/releaseEvidenceManifest.mjs');
    const review = await import('../src/lib/computeRouter/cutoverReviewBundle.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    return { ...fingerprint, ...evidenceExport, ...binding, ...release, ...review, ...targets, ...adapters };
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

function buildBundle(m, ciStatus = 'passed') {
    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'fingerprint-binding',
        boundAt: 900_000,
        certification: validCertification(m),
    });
    const release = m.buildReleaseEvidenceManifest({
        sourceCommit: SOURCE,
        generatedAt: 1_000_000,
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
        sdcpp: { health: 'ready' },
        wan2gp: { health: 'ready' },
        muapi: { health: 'ready', credentials: 'available' },
    });
    const reviewBundle = m.buildStudioCutoverReviewBundle({
        sourceCommit: SOURCE,
        parityBinding: binding,
        releaseManifest: release,
        providers,
        generatedAt: 1_100_000,
    });
    return m.buildCertificationReleaseEvidenceExport({
        buildIdentity: BUILD_IDENTITY,
        parityBinding: binding,
        releaseManifest: release,
        reviewBundle,
        providers,
        exportedAt: 1_100_000,
    });
}

function reorderObject(value) {
    if (Array.isArray(value)) return value.map(reorderObject);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const key of Object.keys(value).reverse()) out[key] = reorderObject(value[key]);
    return out;
}

test('SHA-256 fingerprint matches independent Node crypto over canonical evidence', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const canonical = m.canonicalizeEvidenceExport(bundle);
    const expected = createHash('sha256').update(canonical, 'utf8').digest('hex');

    const fingerprint = await m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto });

    assert.equal(fingerprint.schemaVersion, 1);
    assert.equal(fingerprint.algorithm, 'SHA-256');
    assert.equal(fingerprint.digestHex, expected);
    assert.match(fingerprint.digestHex, /^[0-9a-f]{64}$/);
    assert.equal(fingerprint.canonicalBytes, Buffer.byteLength(canonical, 'utf8'));
    assert.equal(fingerprint.sourceCommit, SOURCE);
    assert.equal(fingerprint.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(fingerprint.readyForReview, true);
    assert.equal(fingerprint.cutoverAuthorized, false);
    assert.equal(fingerprint.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(fingerprint.authenticityVerified, false);
});

test('canonical fingerprint is independent of object key insertion order', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const reordered = reorderObject(bundle);

    const originalCanonical = m.canonicalizeEvidenceExport(bundle);
    const reorderedCanonical = m.canonicalizeEvidenceExport(reordered);
    assert.equal(reorderedCanonical, originalCanonical);

    const [a, b] = await Promise.all([
        m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto }),
        m.createEvidenceFingerprint(reordered, { cryptoProvider: webcrypto }),
    ]);
    assert.equal(a.digestHex, b.digestHex);
    assert.equal(a.canonicalBytes, b.canonicalBytes);
});

test('fingerprint from serialized JSON equals fingerprint from validated object', async () => {
    const m = await modules();
    const bundle = buildBundle(m, 'failed');
    const json = m.serializeCertificationReleaseEvidenceExport(bundle);

    const [fromObject, fromJson] = await Promise.all([
        m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto }),
        m.createEvidenceFingerprintFromJson(json, { cryptoProvider: webcrypto }),
    ]);

    assert.equal(fromObject.digestHex, fromJson.digestHex);
    assert.equal(fromJson.reviewStatus, 'BLOCKED');
    assert.equal(fromJson.readyForReview, false);
});

test('verification detects a different valid evidence package', async () => {
    const m = await modules();
    const green = buildBundle(m, 'passed');
    const blocked = buildBundle(m, 'failed');
    const fingerprint = await m.createEvidenceFingerprint(green, { cryptoProvider: webcrypto });

    const same = await m.verifyEvidenceFingerprint(green, fingerprint, { cryptoProvider: webcrypto });
    assert.equal(same.valid, true);
    assert.equal(same.digestMatches, true);
    assert.equal(same.metadataMatches, true);
    assert.equal(same.authenticityVerified, false);

    const changed = await m.verifyEvidenceFingerprint(blocked, fingerprint, { cryptoProvider: webcrypto });
    assert.equal(changed.valid, false);
    assert.equal(changed.digestMatches, false);
    assert.equal(changed.metadataMatches, false);
    assert.equal(changed.reviewStatus, 'BLOCKED');
});

test('invalid/tampered evidence is rejected before hashing', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const tampered = {
        ...bundle,
        parity: {
            ...bundle.parity,
            certification: {
                ...bundle.parity.certification,
                routes: bundle.parity.certification.routes.map((route, index) => index === 0
                    ? { ...route, samples: 0, matches: 0 }
                    : route),
            },
        },
    };

    await assert.rejects(
        () => m.createEvidenceFingerprint(tampered, { cryptoProvider: webcrypto }),
        (error) => error.code === 'INVALID_EXPORTED_EVIDENCE',
    );
});

test('fingerprint validation rejects authorization/authenticity claims and malformed digest', async () => {
    const m = await modules();
    const bundle = buildBundle(m);
    const fingerprint = await m.createEvidenceFingerprint(bundle, { cryptoProvider: webcrypto });

    for (const forged of [
        { ...fingerprint, cutoverAuthorized: true },
        { ...fingerprint, authenticityVerified: true },
        { ...fingerprint, executionAuthority: 'compute-router' },
        { ...fingerprint, digestHex: 'abc' },
    ]) {
        assert.throws(
            () => m.validateFingerprintShape(forged),
            (error) => error.code === 'INVALID_EVIDENCE_FINGERPRINT',
        );
    }
});

test('fingerprint fails closed when Web Crypto SHA-256 is unavailable', async () => {
    const m = await modules();
    const bundle = buildBundle(m);

    await assert.rejects(
        () => m.createEvidenceFingerprint(bundle, { cryptoProvider: null }),
        (error) => error.code === 'EVIDENCE_FINGERPRINT_CRYPTO_UNAVAILABLE',
    );
});

test('P1B.24 remains pure and isolated from UI/execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/evidenceFingerprint.mjs', 'utf8');
    const diagnostics = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        "from 'node:crypto'",
        "require('node:crypto')",
        "from 'node:fs'",
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
        assert.equal(source.includes(token), false, `unexpected fingerprint side effect: ${token}`);
    }

    assert.equal(diagnostics.includes('evidenceFingerprint'), false);
    assert.equal(image.includes('evidenceFingerprint'), false);
    assert.equal(video.includes('evidenceFingerprint'), false);
    assert.ok(source.includes("EVIDENCE_FINGERPRINT_ALGORITHM = 'SHA-256'"));
    assert.ok(source.includes('authenticityVerified: false'));
    assert.ok(source.includes('cutoverAuthorized: false'));
});
