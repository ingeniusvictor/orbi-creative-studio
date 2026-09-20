const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const BASE_COMMIT_SHA = 'f4667a70ccb7bacb96927b709fe400341ff8686f';
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

function reviewApproval(overrides = {}) {
    return {
        sourceReviewApproved: true,
        reviewerId: 'source-reviewer-001',
        reviewerDisplayName: 'Victor',
        reviewNote: 'Reviewed exact deterministic source proposal for controlled commit handoff.',
        reviewedAt: '2026-09-20T17:45:00.000Z',
        ...overrides,
    };
}

async function makeReviewChain() {
    const promotionModule = await import(
        '../src/lib/computeRouter/runtimeCertificationPromotion.mjs'
    );
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
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

    return {
        materialization: materialization.readMaterialization(TARGET),
        reviewArtifact: review.readArtifact(TARGET),
    };
}

test('P1C27 creates an explicit reviewed source commit handoff bound to exact Git base identity', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();

    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    const result = handoff.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        review: reviewApproval(),
    });

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_READY');
    assert.equal(result.handoffOnly, true);
    assert.equal(result.sourceReviewApproved, true);
    assert.equal(result.sourceCommitRequired, true);
    assert.equal(result.requiresExternalSourceCommit, true);
    assert.equal(result.baseIdentityBound, true);
    assert.equal(result.staleProtectionRequired, true);
    assert.equal(result.sourceMutationApplied, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const artifact = handoff.readHandoff(TARGET);
    assert.equal(
        artifact.handoffType,
        'p1c27-runtime-certification-source-commit-handoff',
    );
    assert.equal(artifact.status, 'external-source-commit-required');
    assert.equal(artifact.targetPath, 'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs');
    assert.equal(artifact.baseIdentity.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(artifact.baseIdentity.sourceBlobSha, SOURCE_BLOB_SHA);
    assert.equal(artifact.baseIdentity.sourceRevision, 1);
    assert.equal(artifact.baseIdentity.certificationCount, 0);
    assert.equal(artifact.proposal.proposedSourceRevision, 2);
    assert.equal(artifact.proposal.proposedCertificationCount, 1);
    assert.equal(artifact.proposal.sourceContent, chain.reviewArtifact.sourceContent);
    assert.equal(artifact.review.sourceReviewApproved, true);
    assert.equal(artifact.review.reviewerIdentityVerified, false);
    assert.equal(Object.isFrozen(artifact), true);
    assert.equal(Object.isFrozen(artifact.baseIdentity), true);
    assert.equal(Object.isFrozen(artifact.proposal), true);
    assert.equal(Object.isFrozen(artifact.review), true);

    const validation = handoffModule.validateRuntimeCertificationSourceCommitHandoff(artifact);
    assert.equal(validation.ok, true);
});

test('P1C27 rejected and empty states never claim source review approval', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();
    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    const rejected = handoff.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        review: reviewApproval({ sourceReviewApproved: false }),
    });
    assert.equal(rejected.status, 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_REJECTED');
    assert.equal(rejected.reason, 'SOURCE_HANDOFF_REVIEW_NOT_APPROVED');
    assert.equal(rejected.sourceReviewApproved, false);

    const empty = handoff.getSummary(TARGET);
    assert.equal(empty.status, 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_EMPTY');
    assert.equal(empty.sourceReviewApproved, false);
});

test('P1C27 requires valid Git identities and complete explicit source-review approval', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();
    const create = () => handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    assert.equal(
        create().prepare(TARGET, {
            baseCommitSha: 'bad',
            sourceBlobSha: SOURCE_BLOB_SHA,
            review: reviewApproval(),
        }).reason,
        'SOURCE_HANDOFF_BASE_COMMIT_SHA_INVALID',
    );

    assert.equal(
        create().prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: 'bad',
            review: reviewApproval(),
        }).reason,
        'SOURCE_HANDOFF_SOURCE_BLOB_SHA_INVALID',
    );

    assert.equal(
        create().prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
            review: reviewApproval({ reviewerId: '   ' }),
        }).reason,
        'SOURCE_HANDOFF_REVIEWER_ID_REQUIRED',
    );

    assert.equal(
        create().prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
            review: reviewApproval({ reviewNote: '' }),
        }).reason,
        'SOURCE_HANDOFF_REVIEW_NOTE_REQUIRED',
    );

    assert.equal(
        create().prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
            review: reviewApproval({ reviewedAt: 'not-a-date' }),
        }).reason,
        'SOURCE_HANDOFF_REVIEWED_AT_INVALID',
    );
});

test('P1C27 stale guard rejects commit, blob, revision, and certification-count drift independently', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();
    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    handoff.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        review: reviewApproval(),
    });
    const artifact = handoff.readHandoff(TARGET);

    const exact = handoffModule.validateRuntimeCertificationSourceCommitHandoffAgainstState(
        artifact,
        {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
            sourceRevision: 1,
            certificationCount: 0,
        },
    );
    assert.equal(exact.ok, true);
    assert.equal(exact.stale, false);

    assert.equal(
        handoffModule.validateRuntimeCertificationSourceCommitHandoffAgainstState(
            artifact,
            {
                baseCommitSha: '1'.repeat(40),
                sourceBlobSha: SOURCE_BLOB_SHA,
                sourceRevision: 1,
                certificationCount: 0,
            },
        ).reason,
        'SOURCE_COMMIT_BASE_COMMIT_STALE',
    );

    assert.equal(
        handoffModule.validateRuntimeCertificationSourceCommitHandoffAgainstState(
            artifact,
            {
                baseCommitSha: BASE_COMMIT_SHA,
                sourceBlobSha: '2'.repeat(40),
                sourceRevision: 1,
                certificationCount: 0,
            },
        ).reason,
        'SOURCE_COMMIT_SOURCE_BLOB_STALE',
    );

    assert.equal(
        handoffModule.validateRuntimeCertificationSourceCommitHandoffAgainstState(
            artifact,
            {
                baseCommitSha: BASE_COMMIT_SHA,
                sourceBlobSha: SOURCE_BLOB_SHA,
                sourceRevision: 2,
                certificationCount: 0,
            },
        ).reason,
        'SOURCE_COMMIT_SOURCE_REVISION_STALE',
    );

    assert.equal(
        handoffModule.validateRuntimeCertificationSourceCommitHandoffAgainstState(
            artifact,
            {
                baseCommitSha: BASE_COMMIT_SHA,
                sourceBlobSha: SOURCE_BLOB_SHA,
                sourceRevision: 1,
                certificationCount: 1,
            },
        ).reason,
        'SOURCE_COMMIT_CERTIFICATION_COUNT_STALE',
    );
});

test('P1C27 summary is sanitized and exposes no source content or human review text', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();
    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    handoff.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        review: reviewApproval(),
    });
    const result = handoff.getSummary(TARGET);
    const serialized = JSON.stringify(result);

    assert.equal(result.summary.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(result.summary.sourceBlobSha, SOURCE_BLOB_SHA);
    assert.equal(result.summary.baseSourceRevision, 1);
    assert.equal(result.summary.proposedSourceRevision, 2);
    assert.equal(result.summary.sourceReviewApproved, true);
    assert.equal(result.summary.sourceMutationApplied, false);
    assert.equal(result.summary.runtimeRegistryLoaded, false);

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

test('P1C27 rejects a tampered P1C26 review artifact before handoff creation', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();
    const tampered = {
        ...chain.reviewArtifact,
        sourceContent: chain.reviewArtifact.sourceContent.replace(
            'routingEligible: false',
            'routingEligible: true',
        ),
    };
    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => tampered,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    const result = handoff.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        review: reviewApproval(),
    });
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_REJECTED');
    assert.equal(result.reason, 'SOURCE_HANDOFF_REVIEW_ARTIFACT_INVALID');
    assert.equal(handoff.readHandoff(TARGET), null);
});

test('P1C27 returns detached immutable handoff copies', async () => {
    const handoffModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs'
    );
    const chain = await makeReviewChain();
    const handoff = handoffModule.createRuntimeCertificationSourceCommitHandoff({
        readReviewArtifact: () => chain.reviewArtifact,
        readMaterialization: () => chain.materialization,
        store: new Map(),
    });

    handoff.prepare(TARGET, {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        review: reviewApproval(),
    });

    const first = handoff.readHandoff(TARGET);
    const second = handoff.readHandoff(TARGET);

    assert.notEqual(first, second);
    assert.notEqual(first.baseIdentity, second.baseIdentity);
    assert.notEqual(first.proposal, second.proposal);
    assert.notEqual(first.review, second.review);
    assert.equal(first.proposal.sourceContent, second.proposal.sourceContent);
    assert.equal(Object.isFrozen(first), true);
});

test('P1C27 has no source-write, GitHub-write, UI, runtime-load, routing, or cutover capability', () => {
    const runtimeSource = fs.readFileSync(
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
        'utf8',
    );
    const handoff = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationSourceCommitHandoff.mjs',
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
        'github',
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
        assert.equal(handoff.includes(forbidden), false, `unexpected P1C27 capability: ${forbidden}`);
    }

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(surface.includes('runtimeCertificationSourceCommitHandoff'), false);
        assert.equal(surface.includes('prepareRuntimeCertificationSourceCommitHandoff'), false);
    }
});
