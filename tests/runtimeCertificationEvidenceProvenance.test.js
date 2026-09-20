const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const BASE_COMMIT_SHA = '1363ee5ecf5ad9c4727275fe59443a5183b240a4';
const SOURCE_BLOB_SHA = '9f5004a13941a5ea33d876a68d3da703ec6902d9';
const SOURCE_COMMIT = 'c'.repeat(40);
const RUNTIME_SHA = 'd'.repeat(64);
const MODEL_SHA = 'e'.repeat(64);
const LLM_SHA = 'a'.repeat(64);
const VAE_SHA = 'b'.repeat(64);

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
                    { role: 'llm', sha256: LLM_SHA },
                    { role: 'vae', sha256: VAE_SHA },
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
                sourceCommit: SOURCE_COMMIT,
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

function sourceReviewApproval() {
    return {
        sourceReviewApproved: true,
        reviewerId: 'source-reviewer-001',
        reviewerDisplayName: 'Victor',
        reviewNote: 'Reviewed exact deterministic source proposal.',
        reviewedAt: '2026-09-20T19:20:00.000Z',
    };
}

function acquisitionProof(runIndex, overrides = {}) {
    return {
        schemaVersion: 1,
        proofType: 'p1c31-real-benchmark-acquisition-proof',
        origin: 'electron-main-controlled-benchmark',
        evidenceClass: 'real-runtime-measurement',
        trustedMainProcess: true,
        runtimeIntegrityVerified: true,
        runtimeManifestPinned: true,
        modelStateResolved: true,
        buildIdentityResolved: true,
        benchmarkProcessExecuted: true,
        fixture: false,
        synthetic: false,
        demo: false,
        context: {
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
            runIndex,
        },
        benchmarkContext: {
            harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
            sourceCommit: SOURCE_COMMIT,
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            runtimeBinarySha256: RUNTIME_SHA,
            modelArtifactSha256: MODEL_SHA,
            auxiliaryArtifacts: [
                { role: 'llm', sha256: LLM_SHA },
                { role: 'vae', sha256: VAE_SHA },
            ],
        },
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...overrides,
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
    const dryRunModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyDryRun.mjs'
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
            review: sourceReviewApproval(),
        }).status,
        'RUNTIME_CERTIFICATION_SOURCE_COMMIT_HANDOFF_READY',
    );

    const dryRun = dryRunModule.createRuntimeCertificationSourceApplyDryRun({
        readHandoff: () => handoff.readHandoff(TARGET),
        readReviewArtifact: () => review.readArtifact(TARGET),
        readMaterialization: () => materialization.readMaterialization(TARGET),
        store: new Map(),
    });
    assert.equal(
        dryRun.prepare(TARGET, {
            baseCommitSha: BASE_COMMIT_SHA,
            sourceBlobSha: SOURCE_BLOB_SHA,
        }).status,
        'RUNTIME_CERTIFICATION_SOURCE_APPLY_DRY_RUN_READY',
    );

    return {
        promotionPackage: promotion.readPackage(TARGET),
        dryRunPlan: dryRun.readDryRun(TARGET),
    };
}

test('P1C31 verifies three real Electron-main acquisition proofs and binds them to P1C24/P1C28', async () => {
    const provenanceModule = await import(
        '../src/lib/computeRouter/runtimeCertificationEvidenceProvenance.mjs'
    );
    const chain = await makeChain();
    const gate = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [
            acquisitionProof(1),
            acquisitionProof(2),
            acquisitionProof(3),
        ],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => chain.dryRunPlan,
        store: new Map(),
    });

    const result = gate.verify(TARGET);
    assert.equal(result.status, 'RUNTIME_CERTIFICATION_EVIDENCE_PROVENANCE_VERIFIED');
    assert.equal(result.reason, null);
    assert.equal(result.realEvidenceProvenanceVerified, true);
    assert.equal(result.trustedMainProcessAcquisition, true);
    assert.equal(result.cryptographicAuthenticityVerified, false);
    assert.equal(result.sourceMutationApplied, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    const attestation = gate.readAttestation(TARGET);
    assert.equal(attestation.status, 'real-evidence-provenance-verified');
    assert.equal(attestation.acquisition.runCount, 3);
    assert.deepEqual(attestation.acquisition.runIndexes, [1, 2, 3]);
    assert.equal(attestation.acquisition.fixture, false);
    assert.equal(attestation.acquisition.synthetic, false);
    assert.equal(attestation.acquisition.demo, false);
    assert.equal(attestation.benchmarkContext.sourceCommit, SOURCE_COMMIT);
    assert.equal(attestation.planBinding.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(attestation.planBinding.sourceBlobSha, SOURCE_BLOB_SHA);
    assert.equal(attestation.planBinding.baseSourceRevision, 1);
    assert.equal(attestation.planBinding.baseCertificationCount, 0);
    assert.equal(attestation.planBinding.proposedSourceRevision, 2);
    assert.equal(attestation.planBinding.proposedCertificationCount, 1);
    assert.equal(Object.isFrozen(attestation), true);

    const validation = provenanceModule.validateRuntimeCertificationEvidenceProvenanceAttestation(
        attestation,
    );
    assert.equal(validation.ok, true);
});

test('P1C31 rejects missing provenance and any fixture/synthetic/demo marker', async () => {
    const provenanceModule = await import(
        '../src/lib/computeRouter/runtimeCertificationEvidenceProvenance.mjs'
    );
    const chain = await makeChain();

    const missing = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => chain.dryRunPlan,
        store: new Map(),
    });
    assert.equal(
        missing.verify(TARGET).reason,
        'REAL_EVIDENCE_PROVENANCE_RUN_COUNT_INVALID',
    );

    for (const mutation of [
        { fixture: true },
        { synthetic: true },
        { demo: true },
        { trustedMainProcess: false },
        { benchmarkProcessExecuted: false },
    ]) {
        const gate = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
            readProvenance: () => [
                acquisitionProof(1),
                acquisitionProof(2, mutation),
                acquisitionProof(3),
            ],
            readPromotionPackage: () => chain.promotionPackage,
            readDryRun: () => chain.dryRunPlan,
            store: new Map(),
        });
        assert.equal(
            gate.verify(TARGET).reason,
            'REAL_EVIDENCE_PROVENANCE_PROOF_INVALID',
        );
        assert.equal(gate.readAttestation(TARGET), null);
    }
});

test('P1C31 rejects run-index/context drift and certification binding mismatch', async () => {
    const provenanceModule = await import(
        '../src/lib/computeRouter/runtimeCertificationEvidenceProvenance.mjs'
    );
    const chain = await makeChain();

    const badIndexes = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [
            acquisitionProof(1),
            acquisitionProof(1),
            acquisitionProof(3),
        ],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => chain.dryRunPlan,
        store: new Map(),
    });
    assert.equal(
        badIndexes.verify(TARGET).reason,
        'REAL_EVIDENCE_PROVENANCE_RUN_INDEX_INVALID',
    );

    const drifted = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [
            acquisitionProof(1),
            acquisitionProof(2, {
                benchmarkContext: {
                    ...acquisitionProof(2).benchmarkContext,
                    runtimeBinarySha256: 'f'.repeat(64),
                },
            }),
            acquisitionProof(3),
        ],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => chain.dryRunPlan,
        store: new Map(),
    });
    assert.equal(
        drifted.verify(TARGET).reason,
        'REAL_EVIDENCE_PROVENANCE_CONTEXT_DRIFT',
    );

    const wrongSource = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [
            acquisitionProof(1, {
                benchmarkContext: {
                    ...acquisitionProof(1).benchmarkContext,
                    sourceCommit: '9'.repeat(40),
                },
            }),
            acquisitionProof(2, {
                benchmarkContext: {
                    ...acquisitionProof(2).benchmarkContext,
                    sourceCommit: '9'.repeat(40),
                },
            }),
            acquisitionProof(3, {
                benchmarkContext: {
                    ...acquisitionProof(3).benchmarkContext,
                    sourceCommit: '9'.repeat(40),
                },
            }),
        ],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => chain.dryRunPlan,
        store: new Map(),
    });
    assert.equal(
        wrongSource.verify(TARGET).reason,
        'REAL_EVIDENCE_PROVENANCE_CERTIFICATION_BINDING_MISMATCH',
    );
});

test('P1C31 rejects a P1C28 source plan that no longer contains the bound certification entry', async () => {
    const provenanceModule = await import(
        '../src/lib/computeRouter/runtimeCertificationEvidenceProvenance.mjs'
    );
    const chain = await makeChain();
    const tamperedPlan = {
        ...chain.dryRunPlan,
        operation: {
            ...chain.dryRunPlan.operation,
            proposed: {
                ...chain.dryRunPlan.operation.proposed,
                sourceContent: 'export const unrelated = true;\n',
            },
        },
    };

    const gate = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [
            acquisitionProof(1),
            acquisitionProof(2),
            acquisitionProof(3),
        ],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => tamperedPlan,
        store: new Map(),
    });

    assert.equal(
        gate.verify(TARGET).reason,
        'REAL_EVIDENCE_PROVENANCE_SOURCE_BINDING_MISMATCH',
    );
});

test('P1C31 public summary is sanitized and omits raw hashes/source content/reviewer evidence', async () => {
    const provenanceModule = await import(
        '../src/lib/computeRouter/runtimeCertificationEvidenceProvenance.mjs'
    );
    const chain = await makeChain();
    const gate = provenanceModule.createRuntimeCertificationEvidenceProvenanceGate({
        readProvenance: () => [
            acquisitionProof(1),
            acquisitionProof(2),
            acquisitionProof(3),
        ],
        readPromotionPackage: () => chain.promotionPackage,
        readDryRun: () => chain.dryRunPlan,
        store: new Map(),
    });

    gate.verify(TARGET);
    const summary = gate.getSummary(TARGET);
    const serialized = JSON.stringify(summary);

    assert.equal(summary.summary.fixture, false);
    assert.equal(summary.summary.synthetic, false);
    assert.equal(summary.summary.demo, false);
    assert.equal(summary.summary.cryptographicAuthenticityVerified, false);

    for (const forbidden of [
        RUNTIME_SHA,
        MODEL_SHA,
        LLM_SHA,
        VAE_SHA,
        'sourceContent',
        'reviewer-001',
        'Controlled local benchmark reviewed and approved',
        'certificationRecord',
        'certifiedProfile',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `summary leaked: ${forbidden}`);
    }
});

test('P1C31 adds no source mutation, registry load, UI, routing, or cutover capability', () => {
    const provenance = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationEvidenceProvenance.mjs',
        'utf8',
    );
    const runtimeSource = fs.readFileSync(
        'src/lib/computeRouter/runtimeResourceProfileCertifications.mjs',
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
        'routingEligible: true',
        'cutoverAuthorized: true',
        "executionAuthority: 'compute-router'",
        'cryptographicAuthenticityVerified: true',
    ]) {
        assert.equal(provenance.includes(forbidden), false, `unexpected P1C31 capability: ${forbidden}`);
    }

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(surface.includes('runtimeCertificationEvidenceProvenance'), false);
        assert.equal(surface.includes('verifyRuntimeCertificationEvidenceProvenance'), false);
    }
});
