const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

function certification(overrides = {}) {
    const entry = {
        status: 'RESOURCE_PROFILE_CERTIFICATION_RECORDED',
        reason: null,
        certificationRecord: {
            schemaVersion: 1,
            evidenceType: 'p1c8-human-certification-record',
            decision: 'approve',
            session: {
                modelId: TARGET.modelId,
                backend: TARGET.backend,
                resolution: { width: TARGET.width, height: TARGET.height },
                runCount: 3,
                runIndexes: [1, 2, 3],
                reviewedAt: '2026-09-20T12:00:00.000Z',
                auxiliaryArtifacts: [
                    { role: 'llm', sha256: 'a'.repeat(64) },
                    { role: 'vae', sha256: 'b'.repeat(64) },
                ],
            },
            approvedRequirements: {
                minSystemRamMiB: 16384,
                minVramMiB: 8192,
            },
            reviewer: {
                id: 'reviewer-001',
                displayName: 'Victor',
                reviewerIdentityVerified: false,
            },
            certifiedAt: '2026-09-20T12:05:00.000Z',
            reviewNote: 'Controlled local benchmark reviewed and approved.',
            authenticityVerified: false,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        },
        certifiedProfile: {
            schemaVersion: 1,
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
            status: 'certified',
            requirements: {
                minSystemRamMiB: 16384,
                minVramMiB: 8192,
            },
            evidence: {
                method: 'controlled-benchmark',
                sampleCount: 3,
                harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
                sourceCommit: 'c'.repeat(40),
                certifiedAt: '2026-09-20T12:05:00.000Z',
                safetyMarginPct: 20,
            },
        },
        reviewerIdentityVerified: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
    return Object.assign(entry, overrides);
}

test('P1C24 prepares a P1C9-valid promotion package from a real P1C8 certification', async () => {
    const promotionModule = await import('../src/lib/computeRouter/runtimeCertificationPromotion.mjs');
    const registryModule = await import('../src/lib/computeRouter/certifiedResourceProfileRegistry.mjs');

    const promotion = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => certification(),
        store: new Map(),
    });

    const result = promotion.prepare(TARGET);
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_PROMOTION_READY');
    assert.equal(result.sourceReviewRequired, true);
    assert.equal(result.sourceMutationApplied, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const pkg = promotion.readPackage(TARGET);
    assert.equal(pkg.packageType, 'p1c24-runtime-certification-promotion-package');
    assert.equal(pkg.status, 'source-review-required');
    assert.equal(pkg.source.baseSourceRevision, 1);
    assert.equal(pkg.source.proposedSourceRevision, 2);
    assert.equal(Object.isFrozen(pkg), true);
    assert.equal(Object.isFrozen(pkg.certificationEntry), true);
    assert.equal(promotionModule.validatePromotionPackage(pkg).ok, true);

    const registry = registryModule.createCertifiedResourceProfileRegistry({
        certifications: [pkg.certificationEntry],
    });
    assert.equal(registry.status, 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_READY');
    assert.equal(registry.registry.size, 1);
    assert.equal(registry.registry.get(TARGET).profile.modelId, TARGET.modelId);
});

test('P1C24 summary is sanitized and contains no reviewer id, review note or benchmark hashes', async () => {
    const promotionModule = await import('../src/lib/computeRouter/runtimeCertificationPromotion.mjs');
    const promotion = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => certification(),
        store: new Map(),
    });

    promotion.prepare(TARGET);
    const summary = promotion.getSummary(TARGET);
    const serialized = JSON.stringify(summary);

    assert.equal(summary.summary.modelId, TARGET.modelId);
    assert.equal(summary.summary.minSystemRamMiB, 16384);
    assert.equal(summary.summary.minVramMiB, 8192);
    assert.equal(summary.summary.baseSourceRevision, 1);
    assert.equal(summary.summary.proposedSourceRevision, 2);
    assert.equal(summary.summary.sourceMutationApplied, false);
    assert.equal(summary.summary.runtimeRegistryLoaded, false);

    for (const forbidden of [
        'reviewer-001',
        'reviewNote',
        'Controlled local benchmark',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'auxiliaryArtifacts',
        'sourceCommit',
        'certificationRecord',
        'certifiedProfile',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `sanitized summary leaked: ${forbidden}`);
    }
});

test('P1C24 rejects missing, invalid, or mismatched certification without storing a package', async () => {
    const promotionModule = await import('../src/lib/computeRouter/runtimeCertificationPromotion.mjs');

    const missing = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => null,
        store: new Map(),
    });
    assert.equal(missing.prepare(TARGET).reason, 'PROMOTION_CERTIFICATION_MISSING');
    assert.equal(missing.readPackage(TARGET), null);

    const invalid = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => ({ ...certification(), routingEligible: true }),
        store: new Map(),
    });
    assert.equal(invalid.prepare(TARGET).reason, 'PROMOTION_CERTIFICATION_INVALID');
    assert.equal(invalid.readPackage(TARGET), null);

    const mismatchEntry = certification();
    mismatchEntry.certifiedProfile = {
        ...mismatchEntry.certifiedProfile,
        modelId: 'z-image-base',
    };
    const mismatch = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => mismatchEntry,
        store: new Map(),
    });
    assert.equal(
        mismatch.prepare(TARGET).reason,
        'PROMOTION_CERTIFICATION_INVALID',
    );
    assert.equal(mismatch.readPackage(TARGET), null);
});

test('P1C24 returns detached package copies', async () => {
    const promotionModule = await import('../src/lib/computeRouter/runtimeCertificationPromotion.mjs');
    const promotion = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => certification(),
        store: new Map(),
    });

    promotion.prepare(TARGET);
    const first = promotion.readPackage(TARGET);
    const second = promotion.readPackage(TARGET);

    assert.notEqual(first, second);
    assert.notEqual(first.certificationEntry, second.certificationEntry);
    assert.notEqual(first.certificationEntry.certificationRecord, second.certificationEntry.certificationRecord);
    assert.equal(Object.isFrozen(first.certificationEntry.certificationRecord.session), true);
    assert.equal(Object.isFrozen(first.certificationEntry.certifiedProfile.evidence), true);
});

test('P1C24 does not mutate the source-controlled runtime certification file', () => {
    const source = fs.readFileSync('src/lib/computeRouter/runtimeResourceProfileCertifications.mjs', 'utf8');
    const promotion = fs.readFileSync('src/lib/computeRouter/runtimeCertificationPromotion.mjs', 'utf8');

    assert.ok(source.includes('const certifications = [];'));
    assert.ok(source.includes('sourceRevision: 1'));

    for (const forbidden of [
        "from 'node:fs'",
        "from 'fs'",
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'runtimeResourceProfileCertifications',
        'RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE',
        'loadRuntimeCertifiedResourceProfileRegistry',
        'sourceMutationApplied: true',
        'runtimeRegistryLoaded: true',
        'authenticityVerified: true',
        'routingEligible: true',
        'cutoverAuthorized: true',
    ]) {
        assert.equal(promotion.includes(forbidden), false, `unexpected P1C24 capability: ${forbidden}`);
    }
});
