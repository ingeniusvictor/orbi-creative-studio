const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const BASE_COMMIT_SHA = 'b52fd66e6c7e831df9e55145f080fb24fcd78d93';
const SOURCE_BLOB_SHA = '9f5004a13941a5ea33d876a68d3da703ec6902d9';

function certification() {
    return {
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
}

function reviewApproval() {
    return {
        sourceReviewApproved: true,
        reviewerId: 'source-reviewer-001',
        reviewerDisplayName: 'Victor',
        reviewNote: 'Reviewed exact deterministic source proposal for guarded dry-run.',
        reviewedAt: '2026-09-20T19:20:00.000Z',
    };
}

async function makeChain() {
    const promotionModule = await import(
        '../src/lib/computeRouter/runtimeCertificationPromotion.mjs'
    );
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
    );
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );

    const promotion = promotionModule.createRuntimeCertificationPromotion({
        readCertification: () => certification(),
        store: new Map(),
    });
    assert.equal(
        promotion.prepare(TARGET).status,
        'RUNTIME_CERTIFICATION_PROMOTION_READY',
    );

    const materialization = materializationModule.createRuntimeCertificationSourceMaterialization({
        readPromotionPackage: () => promotion.readPackage(TARGET),
        store: new Map(),
    });
    assert.equal(
        materialization.prepare(TARGET).status,
        'RUNTIME_CERTIFICATION_SOURCE_MATERIALIZATION_READY',
    );

    const review = reviewModule.createRuntimeCertificationSourceReview({
        readMaterialization: () => materialization.readMaterialization(TARGET),
        store: new Map(),
    });
    assert.equal(
        review.prepare(TARGET).status,
        'RUNTIME_CERTIFICATION_SOURCE_REVIEW_READY',
    );

    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => review.readArtifact(TARGET),
        readMaterialization: () => materialization.readMaterialization(TARGET),
        store: new Map(),
    });
    assert.equal(
        handoff.prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
            review: reviewApproval(),
        }).status,
        'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_READY',
    );

    return {
        materialization: materialization.readMaterialization(TARGET),
        reviewArtifact: review.readArtifact(TARGET),
        handoff: handoff.readHandoff(TARGET),
    };
}

test('P1C28 blocks the guarded dry-run while runtime loader supports only source revision 1', async () => {
    const applyModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
    );
    const registryModule = await import(
        '../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs'
    );
    const chain = await makeChain();

    assert.deepEqual(
        [...registryModule.RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS],
        [1],
    );

    const dryRun = applyModule.createRuntimeCertificationSourceApplyDryRun({
        readHandoff: () => chain.handoff,
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    const result = dryRun.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
    });

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_BLOCKED');
    assert.equal(result.reason, 'SOURCE_APPLY_RUNTIME_LOADER_MIGRATION_REQUIRED');
    assert.equal(result.dryRunOnly, true);
    assert.equal(result.sourceReviewApproved, true);
    assert.equal(result.sourceApplyEligible, false);
    assert.equal(result.runtimeLoaderCompatible, false);
    assert.equal(result.runtimeLoaderMigrationRequired, true);
    assert.equal(result.sourceMutationApplied, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const plan = dryRun.readDryRun(TARGET);
    assert.equal(plan.status, 'runtime-loader-migration-required');
    assert.equal(plan.operation.operationType, 'replace-source-controlled-file');
    assert.equal(plan.operation.targetPath, 'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs');
    assert.equal(plan.operation.writeStrategy, 'external-source-control-update');
    assert.equal(plan.operation.expectedMutationCount, 1);
    assert.equal(plan.operation.expectedCurrent.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(plan.operation.expectedCurrent.sourceBlobSha, SOURCE_BLOB_SHA);
    assert.equal(plan.operation.expectedCurrent.sourceRevision, 1);
    assert.equal(plan.operation.expectedCurrent.certificationCount, 0);
    assert.equal(plan.operation.proposed.sourceRevision, 2);
    assert.equal(plan.operation.proposed.certificationCount, 1);
    assert.equal(plan.operation.proposed.sourceContent, chain.handoff.proposal.sourceContent);
    assert.deepEqual([...plan.guards.supportedSourceRevisions], [1]);
    assert.equal(plan.guards.runtimeLoaderCompatible, false);
    assert.equal(plan.guards.runtimeLoaderMigrationRequired, true);
    assert.equal(Object.isFrozen(plan), true);
});

test('P1C28 becomes READY only when loader capability explicitly includes proposed revision 2', async () => {
    const applyModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
    );
    const chain = await makeChain();

    const dryRun = applyModule.createRuntimeCertificationSourceApplyDryRun({
        readHandoff: () => chain.handoff,
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        supportedSourceRevisionsProvider: () => [2, 1, 2],
        store: new Map(),
    });

    const result = dryRun.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
    });

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_READY');
    assert.equal(result.reason, null);
    assert.equal(result.sourceApplyEligible, true);
    assert.equal(result.runtimeLoaderCompatible, true);
    assert.equal(result.runtimeLoaderMigrationRequired, false);
    assert.deepEqual([...result.summary.supportedSourceRevisions], [1, 2]);

    const plan = dryRun.readDryRun(TARGET);
    assert.equal(plan.status, 'guarded-source-apply-ready');
    assert.deepEqual([...plan.guards.supportedSourceRevisions], [1, 2]);
    assert.equal(plan.guards.runtimeLoaderCompatible, true);
    assert.equal(plan.sourceApplyEligible, true);

    const validation = applyModule.validateRuntimeCertificationSourceApplyDryRun(plan);
    assert.equal(validation.ok, true);
    assert.equal(validation.runtimeLoaderCompatible, true);
    assert.equal(validation.sourceApplyEligible, true);
});

test('P1C28 rejects stale commit and stale source blob before producing a dry-run plan', async () => {
    const applyModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
    );
    const chain = await makeChain();

    const create = () => applyModule.createRuntimeCertificationSourceApplyDryRun({
        readHandoff: () => chain.handoff,
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    const staleCommit = create();
    assert.equal(
        staleCommit.prepare(TARGET, {
            baseCommitSha: '1'.repeat(40),
            sourceBlobSha: SOURCE_BLOB_SHA,
        }).reason,
        'SOURCE_COMMIT_BASE_COMMIT_STALE',
    );
    assert.equal(staleCommit.readDryRun(TARGET), null);

    const staleBlob = create();
    assert.equal(
        staleBlob.prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: '2'.repeat(40),
        }).reason,
        'SOURCE_COMMIT_SOURCE_BLOB_STALE',
    );
    assert.equal(staleBlob.readDryRun(TARGET), null);
});

test('P1C28 rejects handoff/review content divergence before operation planning', async () => {
    const applyModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
    );
    const chain = await makeChain();
    const divergentHandoff = {
        ...chain.handoff,
        proposal: {
            ...chain.handoff.proposal,
            sourceContent: chain.handoff.proposal.sourceContent + '\n// tampered',
        },
    };

    const dryRun = applyModule.createRuntimeCertificationSourceApplyDryRun({
        readHandoff: () => divergentHandoff,
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    const result = dryRun.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
    });
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_REJECTED');
    assert.equal(result.reason, 'SOURCE_APPLY_HANDOFF_REVIEW_MISMATCH');
    assert.equal(dryRun.readDryRun(TARGET), null);
});

test('P1C28 rejects malformed loader capability rather than guessing compatibility', async () => {
    const applyModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
    );
    const chain = await makeChain();

    for (const provider of [
        () => [],
        () => [1, '2'],
        () => null,
        () => { throw new Error('capability unavailable'); },
    ]) {
        const dryRun = applyModule.createRuntimeCertificationSourceApplyDryRun({
            readHandoff: () => chain.handoff,
            readReviewArtifact: () => chain.reviewArtifact,
            readMaterialization: () => chain.materialization,
            supportedSourceRevisionsProvider: provider,
            store: new Map(),
        });

        const result = dryRun.prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
        });
        assert.equal(result.reason, 'SOURCE_APPLY_LOADER_CAPABILITY_INVALID');
        assert.equal(result.sourceApplyEligible, false);
        assert.equal(dryRun.readDryRun(TARGET), null);
    }
});

test('P1C28 summary is sanitized and never exposes proposed source or human review evidence', async () => {
    const applyModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
    );
    const chain = await makeChain();

    const dryRun = applyModule.createRuntimeCertificationSourceApplyDryRun({
        readHandoff: () => chain.handoff,
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    dryRun.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
    });
    const result = dryRun.getSummary(TARGET);
    const serialized = JSON.stringify(result);

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_BLOCKED');
    assert.equal(result.summary.runtimeLoaderMigrationRequired, true);
    assert.equal(result.summary.sourceApplyEligible, false);
    assert.equal(result.summary.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(result.summary.sourceBlobSha, SOURCE_BLOB_SHA);

    for (const forbidden of [
        'sourceContent',
        'source-reviewer-001',
        'Reviewed exact deterministic source proposal',
        'reviewNote',
        'reviewerDisplayName',
        'p1c8-human-certification-record',
        'certificationRecord',
        'certifiedProfile',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `summary leaked: ${forbidden}`);
    }
});

test('P1C28 preserves runtime loader behavior at revision 1 while exposing the capability list', async () => {
    const registryModule = await import(
        '../src/lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs'
    );
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );

    assert.deepEqual(
        [...registryModule.RUNTIME_CERTIFICATION_SUPPORTED_SOURCE_REVISIONS],
        [1],
    );

    const current = materializationModule.deepFreeze({
        schemaVersion: 1,
        sourceType: 'source-controlled-static-bundle',
        sourceRevision: 1,
        certifications: [],
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
    assert.equal(registryModule.validateRuntimeCertificationSource(current).ok, true);

    const revision2 = materializationModule.deepFreeze({
        ...current,
        sourceRevision: 2,
    });
    const validation = registryModule.validateRuntimeCertificationSource(revision2);
    assert.equal(validation.ok, false);
    assert.equal(validation.reason, 'RUNTIME_CERTIFICATION_SOURCE_IDENTITY_INVALID');
});

test('P1C28 has no file/GitHub write, UI, runtime-load, routing, or cutover capability', () => {
    const runtimeSource = fs.readFileSync(
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
        'utf8',
    );
    const dryRun = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs',
        'utf8',
    );
    const settings = fs.readFileSync('src/components/SettingsModal.js', 'utf8');
    const panel = fs.readFileSync('src/components/RouterDiagnosticsPanel.js', 'utf8');
    const main = fs.readFileSync('src/main.js', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    assert.ok(runtimeSource.includes('const certifications = [];'));
    assert.ok(runtimeSource.includes('sourceRevision: 1'));

    for (const forbidden of [
        "from 'node:fs'",
        "from 'fs'",
        'writeFile',
        'createWriteStream',
        'fetch(',
        'octokit',
        'updateFile',
        'createCommit',
        'updateRef',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'loadRuntimeCertifiedResourceProfileRegistry',
        'sourceMutationApplied: true',
        'runtimeRegistryLoaded: true',
        'authenticityVerified: true',
        'routingEligible: true',
        'cutoverAuthorized: true',
    ]) {
        assert.equal(dryRun.includes(forbidden), false, `unexpected P1C28 capability: ${forbidden}`);
    }

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(surface.includes('runtimeCertificationSourceApplyDryRun'), false);
        assert.equal(surface.includes('prepareRuntimeCertificationSourceApplyDryRun'), false);
    }
});
