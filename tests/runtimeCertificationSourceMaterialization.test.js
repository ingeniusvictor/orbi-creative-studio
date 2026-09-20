const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const OTHER_TARGET = Object.freeze({
    modelId: 'z-image-base',
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

async function makePromotionPackage() {
    const promotionModule = await import('../src/lib/computeRouter/runtimeCertificationPromotion.mjs');
    const promotion = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => certification(),
        store: new Map(),
    });
    assert.equal(
        promotion.prepare(TARGET).status,
        'RUNTIME_CERTIFICATION_PROMOTION_READY',
    );
    return promotion.readPackage(TARGET);
}

test('P1C25 materializes a valid revision-2 source preview from P1C24 without mutating runtime source', async () => {
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const registryModule = await import(
        '../src/lib/computeRouter/certifiedResourceProfileRegistry.mjs'
    );
    const promotionPackage = await makePromotionPackage();

    const materialization = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => promotionPackage,
        store: new Map(),
    });

    const result = materialization.prepare(TARGET);
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_READY');
    assert.equal(result.materializationOnly, true);
    assert.equal(result.sourceReviewRequired, true);
    assert.equal(result.sourceCommitRequired, true);
    assert.equal(result.sourceMutationApplied, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const proposal = materialization.readMaterialization(TARGET);
    assert.equal(
        proposal.materializationType,
        'p1c25-runtime-certification-source-materialization',
    );
    assert.equal(proposal.status, 'source-commit-required');
    assert.equal(proposal.baseSourceRevision, 1);
    assert.equal(proposal.proposedSourceRevision, 2);
    assert.equal(proposal.certificationCountBefore, 0);
    assert.equal(proposal.certificationCountAfter, 1);
    assert.equal(proposal.sourceSnapshot.sourceRevision, 2);
    assert.equal(proposal.sourceSnapshot.certifications.length, 1);
    assert.equal(proposal.candidateRegistryValidated, true);
    assert.equal(Object.isFrozen(proposal), true);
    assert.equal(Object.isFrozen(proposal.sourceSnapshot), true);
    assert.equal(Object.isFrozen(proposal.sourceSnapshot.certifications), true);

    const sourceValidation = materializationModule.validateMaterializedRuntimeCertificationSource(
        proposal.sourceSnapshot,
        { expectedRevision: 2 },
    );
    assert.equal(sourceValidation.ok, true);
    assert.equal(sourceValidation.certificationCount, 1);

    const registry = registryModule.createCertifiedResourceProfileRegistry({
        certifications: proposal.sourceSnapshot.certifications,
    });
    assert.equal(registry.status, 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_READY');
    assert.equal(registry.registry.size, 1);
    assert.equal(registry.registry.get(TARGET).profile.modelId, TARGET.modelId);
    assert.equal(registry.routingEligible, false);
    assert.equal(registry.cutoverAuthorized, false);
});

test('P1C25 summary is sanitized while the raw materialization remains internal', async () => {
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const promotionPackage = await makePromotionPackage();
    const materialization = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => promotionPackage,
        store: new Map(),
    });

    materialization.prepare(TARGET);
    const result = materialization.getSummary(TARGET);
    const serialized = JSON.stringify(result);

    assert.equal(result.summary.modelId, TARGET.modelId);
    assert.equal(result.summary.baseSourceRevision, 1);
    assert.equal(result.summary.proposedSourceRevision, 2);
    assert.equal(result.summary.certificationCountBefore, 0);
    assert.equal(result.summary.certificationCountAfter, 1);
    assert.equal(result.summary.candidateRegistryValidated, true);
    assert.equal(result.summary.sourceMutationApplied, false);
    assert.equal(result.summary.runtimeRegistryLoaded, false);

    for (const forbidden of [
        'reviewer-001',
        'reviewNote',
        'Controlled local benchmark',
        'sourceCommit',
        'auxiliaryArtifacts',
        'certificationRecord',
        'certifiedProfile',
        'sourceSnapshot',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `sanitized summary leaked: ${forbidden}`);
    }
});

test('P1C25 rejects absent, malformed, and mismatched promotion packages without storing materialization', async () => {
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const promotionPackage = await makePromotionPackage();

    const missing = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => null,
        store: new Map(),
    });
    assert.equal(missing.prepare(TARGET).reason, 'MATERIALIZATION_PROMOTION_MISSING');
    assert.equal(missing.readMaterialization(TARGET), null);

    const throwing = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => {
            throw new Error('C:/secret/path API_KEY=secret');
        },
        store: new Map(),
    });
    const thrown = throwing.prepare(TARGET);
    assert.equal(thrown.reason, 'MATERIALIZATION_PROMOTION_READ_FAILED');
    assert.equal(JSON.stringify(thrown).includes('secret'), false);

    const malformed = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => ({
            ...promotionPackage,
            routingEligible: true,
        }),
        store: new Map(),
    });
    assert.equal(malformed.prepare(TARGET).reason, 'MATERIALIZATION_PROMOTION_INVALID');
    assert.equal(malformed.readMaterialization(TARGET), null);

    const mismatch = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => promotionPackage,
        store: new Map(),
    });
    assert.equal(
        mismatch.prepare(OTHER_TARGET).reason,
        'MATERIALIZATION_PROMOTION_CONTEXT_MISMATCH',
    );
    assert.equal(mismatch.readMaterialization(OTHER_TARGET), null);
});

test('P1C25 fails closed when the proposed source would duplicate a certified context', async () => {
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const promotionPackage = await makePromotionPackage();

    const baseSource = materializationModule.deepFreeze({
        schemaVersion: 1,
        sourceType: 'source-controlled-static-bundle',
        sourceRevision: 1,
        certifications: [certification()],
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });

    const materialization = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => promotionPackage,
        sourceProvider: () => baseSource,
        store: new Map(),
    });

    const result = materialization.prepare(TARGET);
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_REJECTED');
    assert.equal(result.reason, 'REGISTRY_DUPLICATE_PROFILE_CONTEXT');
    assert.equal(materialization.readMaterialization(TARGET), null);
});

test('P1C25 returns detached immutable materialization copies', async () => {
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const promotionPackage = await makePromotionPackage();
    const materialization = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => promotionPackage,
        store: new Map(),
    });

    materialization.prepare(TARGET);
    const first = materialization.readMaterialization(TARGET);
    const second = materialization.readMaterialization(TARGET);

    assert.notEqual(first, second);
    assert.notEqual(first.sourceSnapshot, second.sourceSnapshot);
    assert.notEqual(
        first.sourceSnapshot.certifications[0],
        second.sourceSnapshot.certifications[0],
    );
    assert.equal(Object.isFrozen(first.sourceSnapshot.certifications[0]), true);
    assert.equal(
        Object.isFrozen(
            first.sourceSnapshot.certifications[0].certificationRecord.session,
        ),
        true,
    );
});

test('P1C25 leaves the source-controlled runtime file and execution surfaces untouched', () => {
    const source = fs.readFileSync(
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
        'utf8',
    );
    const materialization = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs',
        'utf8',
    );
    const settings = fs.readFileSync('src/components/SettingsModal.js', 'utf8');
    const panel = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');
    const main = fs.readFileSync('src/main.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

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
        'sourceMutationApplied: true',
        'runtimeRegistryLoaded: true',
        'authenticityVerified: true',
        'routingEligible: true',
        'cutoverAuthorized: true',
    ]) {
        assert.equal(
            materialization.includes(forbidden),
            false,
            `unexpected P1C25 capability: ${forbidden}`,
        );
    }

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(
            surface.includes('runtimeCertificationSourceMaterialization'),
            false,
        );
        assert.equal(
            surface.includes('prepareRuntimeCertificationSourceMaterialization'),
            false,
        );
    }
});
