const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

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

async function makeMaterialization() {
    const promotionModule = await import(
        '../src/lib/computeRouter/runtimeCertificationPromotion.mjs'
    );
    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
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

    return materialization.readMaterialization(TARGET);
}

test('P1C26 renders an exact deterministic source-review artifact from P1C25', async () => {
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
    );
    const materialization = await makeMaterialization();

    const review = reviewModule.createRuntimeCertificationSourceReview({
        readMaterialization: () => materialization,
        store: new Map(),
    });

    const result = review.prepare(TARGET);
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_REVIEW_READY');
    assert.equal(result.reviewArtifactOnly, true);
    assert.equal(result.sourceReviewRequired, true);
    assert.equal(result.sourceCommitRequired, true);
    assert.equal(result.sourceMutationApplied, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const artifact = review.readArtifact(TARGET);
    assert.equal(
        artifact.artifactType,
        'p1c26-runtime-certification-source-review-artifact',
    );
    assert.equal(artifact.status, 'source-review-required');
    assert.equal(
        artifact.targetPath,
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
    );
    assert.equal(artifact.contentFormat, 'utf-8-javascript-module');
    assert.equal(artifact.baseSourceRevision, 1);
    assert.equal(artifact.proposedSourceRevision, 2);
    assert.equal(artifact.certificationCountBefore, 0);
    assert.equal(artifact.certificationCountAfter, 1);
    assert.equal(artifact.candidateRegistryValidated, true);
    assert.equal(artifact.deterministicSerialization, true);
    assert.ok(artifact.sourceContent.includes('sourceRevision: 2'));
    assert.ok(artifact.sourceContent.includes('const certifications = ['));
    assert.ok(artifact.sourceContent.includes('"evidenceType": "p1c8-human-certification-record"'));
    assert.ok(artifact.sourceContent.includes('"reviewNote": "Controlled local benchmark reviewed and approved."'));
    assert.equal(artifact.sourceContent.includes('sourceRevision: 1'), false);

    const validation = reviewModule.validateRuntimeCertificationSourceReviewArtifact(
        artifact,
        materialization,
    );
    assert.equal(validation.ok, true);
    assert.equal(validation.proposedSourceRevision, 2);
    assert.equal(validation.certificationCount, 1);
    assert.equal(Object.isFrozen(artifact), true);
});

test('P1C26 source rendering is deterministic across object insertion order', async () => {
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
    );
    const materialization = await makeMaterialization();

    const original = reviewModule.renderRuntimeCertificationSourceModule(
        materialization.sourceSnapshot,
    );

    const source = materialization.sourceSnapshot;
    const entry = source.certifications[0];
    const shuffled = {
        executionAuthority: source.executionAuthority,
        cutoverAuthorized: source.cutoverAuthorized,
        routingEligible: source.routingEligible,
        authenticityVerified: source.authenticityVerified,
        certifications: [{
            executionAuthority: entry.executionAuthority,
            routingEligible: entry.routingEligible,
            cutoverAuthorized: entry.cutoverAuthorized,
            authenticityVerified: entry.authenticityVerified,
            reviewerIdentityVerified: entry.reviewerIdentityVerified,
            certifiedProfile: {
                evidence: {
                    safetyMarginPct: entry.certifiedProfile.evidence.safetyMarginPct,
                    certifiedAt: entry.certifiedProfile.evidence.certifiedAt,
                    sourceCommit: entry.certifiedProfile.evidence.sourceCommit,
                    harnessVersion: entry.certifiedProfile.evidence.harnessVersion,
                    sampleCount: entry.certifiedProfile.evidence.sampleCount,
                    method: entry.certifiedProfile.evidence.method,
                },
                requirements: {
                    minVramMiB: entry.certifiedProfile.requirements.minVramMiB,
                    minSystemRamMiB: entry.certifiedProfile.requirements.minSystemRamMiB,
                },
                status: entry.certifiedProfile.status,
                resolution: {
                    height: entry.certifiedProfile.resolution.height,
                    width: entry.certifiedProfile.resolution.width,
                },
                backend: entry.certifiedProfile.backend,
                modelId: entry.certifiedProfile.modelId,
                schemaVersion: entry.certifiedProfile.schemaVersion,
            },
            certificationRecord: {
                executionAuthority: entry.certificationRecord.executionAuthority,
                cutoverAuthorized: entry.certificationRecord.cutoverAuthorized,
                routingEligible: entry.certificationRecord.routingEligible,
                authenticityVerified: entry.certificationRecord.authenticityVerified,
                reviewNote: entry.certificationRecord.reviewNote,
                certifiedAt: entry.certificationRecord.certifiedAt,
                reviewer: {
                    reviewerIdentityVerified:
                        entry.certificationRecord.reviewer.reviewerIdentityVerified,
                    displayName: entry.certificationRecord.reviewer.displayName,
                    id: entry.certificationRecord.reviewer.id,
                },
                approvedRequirements: {
                    minVramMiB:
                        entry.certificationRecord.approvedRequirements.minVramMiB,
                    minSystemRamMiB:
                        entry.certificationRecord.approvedRequirements.minSystemRamMiB,
                },
                session: {
                    auxiliaryArtifacts: entry.certificationRecord.session.auxiliaryArtifacts.map(
                        (artifact) => ({
                            sha256: artifact.sha256,
                            role: artifact.role,
                        }),
                    ),
                    reviewedAt: entry.certificationRecord.session.reviewedAt,
                    runIndexes: [...entry.certificationRecord.session.runIndexes],
                    runCount: entry.certificationRecord.session.runCount,
                    resolution: {
                        height: entry.certificationRecord.session.resolution.height,
                        width: entry.certificationRecord.session.resolution.width,
                    },
                    backend: entry.certificationRecord.session.backend,
                    modelId: entry.certificationRecord.session.modelId,
                },
                decision: entry.certificationRecord.decision,
                evidenceType: entry.certificationRecord.evidenceType,
                schemaVersion: entry.certificationRecord.schemaVersion,
            },
            reason: entry.reason,
            status: entry.status,
        }],
        sourceRevision: source.sourceRevision,
        sourceType: source.sourceType,
        schemaVersion: source.schemaVersion,
    };

    const materializationModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceMaterialization.mjs'
    );
    const frozenShuffled = materializationModule.deepFreeze(shuffled);
    const rendered = reviewModule.renderRuntimeCertificationSourceModule(frozenShuffled);

    assert.equal(rendered, original);
});

test('P1C26 rejects missing materialization and tampered artifact content', async () => {
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
    );
    const materialization = await makeMaterialization();

    const missing = reviewModule.createRuntimeCertificationSourceReview({
        readMaterialization: () => null,
        store: new Map(),
    });
    assert.equal(
        missing.prepare(TARGET).reason,
        'SOURCE_REVIEW_MATERIALIZATION_MISSING',
    );
    assert.equal(missing.readArtifact(TARGET), null);

    const review = reviewModule.createRuntimeCertificationSourceReview({
        readMaterialization: () => materialization,
        store: new Map(),
    });
    review.prepare(TARGET);
    const artifact = review.readArtifact(TARGET);
    const tampered = {
        ...artifact,
        sourceContent: artifact.sourceContent.replace(
            'routingEligible: false',
            'routingEligible: true',
        ),
    };

    const validation = reviewModule.validateRuntimeCertificationSourceReviewArtifact(
        tampered,
        materialization,
    );
    assert.equal(validation.ok, false);
    assert.equal(validation.reason, 'SOURCE_REVIEW_ARTIFACT_CONTENT_MISMATCH');
});

test('P1C26 summary never exposes source content or certification evidence', async () => {
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
    );
    const materialization = await makeMaterialization();
    const review = reviewModule.createRuntimeCertificationSourceReview({
        readMaterialization: () => materialization,
        store: new Map(),
    });

    review.prepare(TARGET);
    const result = review.getSummary(TARGET);
    const serialized = JSON.stringify(result);

    assert.equal(result.summary.proposedSourceRevision, 2);
    assert.equal(result.summary.certificationCountAfter, 1);
    assert.equal(result.summary.deterministicSerialization, true);
    assert.equal(result.summary.sourceMutationApplied, false);
    assert.equal(result.summary.runtimeRegistryLoaded, false);

    for (const forbidden of [
        'sourceContent',
        'reviewer-001',
        'reviewNote',
        'Controlled local benchmark',
        '"sourceCommit":',
        'auxiliaryArtifacts',
        'certificationRecord',
        'certifiedProfile',
        'p1c8-human-certification-record',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `summary leaked: ${forbidden}`);
    }
});

test('P1C26 returns detached immutable artifacts', async () => {
    const reviewModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceReview.mjs'
    );
    const materialization = await makeMaterialization();
    const review = reviewModule.createRuntimeCertificationSourceReview({
        readMaterialization: () => materialization,
        store: new Map(),
    });

    review.prepare(TARGET);
    const first = review.readArtifact(TARGET);
    const second = review.readArtifact(TARGET);

    assert.notEqual(first, second);
    assert.notEqual(first.context, second.context);
    assert.equal(first.sourceContent, second.sourceContent);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.context), true);
});

test('P1C26 has no file-write, UI, startup, runtime-load, routing, or cutover capability', () => {
    const source = fs.readFileSync(
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
        'utf8',
    );
    const review = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationSourceReview.mjs',
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
        'writeFile',
        'createWriteStream',
        'fetch(',
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
        assert.equal(review.includes(forbidden), false, `unexpected P1C26 capability: ${forbidden}`);
    }

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(
            surface.includes('runtimeCertificationSourceReview'),
            false,
        );
        assert.equal(
            surface.includes('prepareRuntimeCertificationSourceReviewArtifact'),
            false,
        );
    }
});
