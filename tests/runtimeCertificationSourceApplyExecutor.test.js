const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const BASE_COMMIT_SHA = '85fcf79c4a1a0bec5338d93614d33f8593241e69';
const SOURCE_BLOB_SHA = '9f5004a13941a5ea33d876a68d3da703ec6902d9';
const NEW_COMMIT_SHA = '1'.repeat(40);
const NEW_BLOB_SHA = '2'.repeat(40);

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

function sourceReviewApproval() {
    return {
        sourceReviewApproved: true,
        reviewerId: 'source-reviewer-001',
        reviewerDisplayName: 'Victor',
        reviewNote: 'Reviewed deterministic source proposal.',
        reviewedAt: '2026-09-20T19:20:00.000Z',
    };
}

function sourceApplyApproval(overrides = {}) {
    return {
        sourceApplyApproved: true,
        operatorId: 'source-operator-001',
        operatorDisplayName: 'Victor',
        approvalNote: 'Approved exactly one guarded external source-control update.',
        approvedAt: '2026-09-20T19:45:00.000Z',
        ...overrides,
    };
}

function exactCurrentState(overrides = {}) {
    return {
        baseCommitSha: BASE_COMMIT_SHA,
        sourceBlobSha: SOURCE_BLOB_SHA,
        sourceRevision: 1,
        certificationCount: 0,
        ...overrides,
    };
}

function provenanceAttestation(plan, overrides = {}) {
    return {
        schemaVersion: 1,
        attestationType: 'p1c31-real-evidence-provenance-attestation',
        status: 'real-evidence-provenance-verified',
        context: {
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
        },
        acquisition: {
            origin: 'electron-main-controlled-benchmark',
            evidenceClass: 'real-runtime-measurement',
            runCount: 3,
            runIndexes: [1, 2, 3],
            trustedMainProcess: true,
            runtimeIntegrityVerified: true,
            runtimeManifestPinned: true,
            modelStateResolved: true,
            buildIdentityResolved: true,
            benchmarkProcessExecuted: true,
            fixture: false,
            synthetic: false,
            demo: false,
        },
        benchmarkContext: {
            harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
            sourceCommit: 'c'.repeat(40),
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            runtimeBinarySha256: 'd'.repeat(64),
            modelArtifactSha256: 'e'.repeat(64),
            auxiliaryArtifacts: [
                { role: 'llm', sha256: 'a'.repeat(64) },
                { role: 'vae', sha256: 'b'.repeat(64) },
            ],
        },
        bindings: {
            promotionPackageValidated: true,
            certificationEntryBound: true,
            sourceApplyPlanValidated: true,
            sourceApplyPlanBound: true,
        },
        planBinding: {
            baseCommitSha: plan.operation.expectedCurrent.baseCommitSha,
            sourceBlobSha: plan.operation.expectedCurrent.sourceBlobSha,
            baseSourceRevision: plan.operation.expectedCurrent.sourceRevision,
            baseCertificationCount: plan.operation.expectedCurrent.certificationCount,
            proposedSourceRevision: plan.operation.proposed.sourceRevision,
            proposedCertificationCount: plan.operation.proposed.certificationCount,
        },
        provenanceGateOnly: true,
        realEvidenceProvenanceVerified: true,
        trustedMainProcessAcquisition: true,
        cryptographicAuthenticityVerified: false,
        sourceMutationApplied: false,
        runtimeRegistryLoaded: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        ...overrides,
    };
}

async function makeReadyDryRun() {
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

    return dryRun.readDryRun(TARGET);
}

test('P1C30 default executor fails closed because no final-state reader or external writer is configured', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const result = await executorModule.executeRuntimeCertificationSourceApply(
        TARGET,
        { approval: sourceApplyApproval() },
    );

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_UNAVAILABLE');
    assert.equal(result.reason, 'SOURCE_APPLY_FINAL_STATE_READER_UNAVAILABLE');
    assert.equal(result.sourceMutationAppliedByModule, false);
    assert.equal(result.externalWriterInvoked, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
});

test('P1C31 blocks P1C30 before approval/state read when real evidence provenance is missing', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const plan = await makeReadyDryRun();
    let stateReads = 0;
    let writerCalls = 0;

    const executor = executorModule.createRuntimeCertificationSourceApplyExecutor({
        readDryRun: () => plan,
        readProvenanceAttestation: () => null,
        readCurrentState: async () => {
            stateReads += 1;
            return exactCurrentState();
        },
        applySourceUpdate: async () => {
            writerCalls += 1;
            return {};
        },
        attempts: new Map(),
    });

    const result = await executor.execute(TARGET, {
        approval: sourceApplyApproval(),
    });

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_REJECTED');
    assert.equal(result.reason, 'SOURCE_APPLY_REAL_EVIDENCE_PROVENANCE_MISSING');
    assert.equal(result.realEvidenceProvenanceVerified, false);
    assert.equal(stateReads, 0);
    assert.equal(writerCalls, 0);
});

test('P1C30 invokes an injected external writer exactly once after final-state revalidation', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const plan = await makeReadyDryRun();

    let stateReads = 0;
    let writerCalls = 0;
    let capturedRequest = null;

    const executor = executorModule.createRuntimeCertificationSourceApplyExecutor({
        readDryRun: () => plan,
        readProvenanceAttestation: () => provenanceAttestation(plan),
        readCurrentState: async () => {
            stateReads += 1;
            return exactCurrentState();
        },
        applySourceUpdate: async (request) => {
            writerCalls += 1;
            capturedRequest = request;
            return {
                applied: true,
                mutationCount: 1,
                targetPath: request.targetPath,
                previousBaseCommitSha: request.expectedCurrent.baseCommitSha,
                previousSourceBlobSha: request.expectedCurrent.sourceBlobSha,
                newCommitSha: NEW_COMMIT_SHA,
                newSourceBlobSha: NEW_BLOB_SHA,
                sourceRevision: request.proposed.sourceRevision,
                certificationCount: request.proposed.certificationCount,
            };
        },
        attempts: new Map(),
    });

    const result = await executor.execute(TARGET, {
        approval: sourceApplyApproval(),
    });

    assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_EXECUTED');
    assert.equal(result.reason, null);
    assert.equal(stateReads, 1);
    assert.equal(writerCalls, 1);
    assert.equal(result.sourceApplyApproved, true);
    assert.equal(result.realEvidenceProvenanceVerified, true);
    assert.equal(result.finalStateValidated, true);
    assert.equal(result.externalWriterInvoked, true);
    assert.equal(result.externalMutationReported, true);
    assert.equal(result.retryAllowed, false);
    assert.equal(result.sourceMutationAppliedByModule, false);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    assert.equal(
        capturedRequest.requestType,
        'p1c30-external-source-control-update-request',
    );
    assert.equal(capturedRequest.operationType, 'replace-source-controlled-file');
    assert.equal(capturedRequest.expectedMutationCount, 1);
    assert.equal(capturedRequest.expectedCurrent.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(capturedRequest.expectedCurrent.sourceBlobSha, SOURCE_BLOB_SHA);
    assert.equal(capturedRequest.expectedCurrent.sourceRevision, 1);
    assert.equal(capturedRequest.expectedCurrent.certificationCount, 0);
    assert.equal(capturedRequest.proposed.sourceRevision, 2);
    assert.equal(capturedRequest.proposed.certificationCount, 1);
    assert.equal(capturedRequest.proposed.sourceContent, plan.operation.proposed.sourceContent);
    assert.equal(capturedRequest.provenance.attestationType, 'p1c31-real-evidence-provenance-attestation');
    assert.equal(capturedRequest.provenance.realEvidenceProvenanceVerified, true);
    assert.equal(capturedRequest.provenance.cryptographicAuthenticityVerified, false);
    assert.equal(capturedRequest.provenance.baseCommitSha, BASE_COMMIT_SHA);
    assert.equal(capturedRequest.provenance.sourceBlobSha, SOURCE_BLOB_SHA);

    assert.equal(result.receipt.newCommitSha, NEW_COMMIT_SHA);
    assert.equal(result.receipt.newSourceBlobSha, NEW_BLOB_SHA);
    assert.equal(result.receipt.sourceRevision, 2);
    assert.equal(result.receipt.certificationCount, 1);
    assert.equal(result.receipt.mutationCount, 1);
});

test('P1C30 blocks every stale final-state dimension before writer invocation', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const plan = await makeReadyDryRun();

    const cases = [
        [exactCurrentState({ baseCommitSha: '3'.repeat(40) }), 'SOURCE_APPLY_FINAL_BASE_COMMIT_STALE'],
        [exactCurrentState({ sourceBlobSha: '4'.repeat(40) }), 'SOURCE_APPLY_FINAL_SOURCE_BLOB_STALE'],
        [exactCurrentState({ sourceRevision: 2 }), 'SOURCE_APPLY_FINAL_SOURCE_REVISION_STALE'],
        [exactCurrentState({ certificationCount: 1 }), 'SOURCE_APPLY_FINAL_CERTIFICATION_COUNT_STALE'],
    ];

    for (const [state, expectedReason] of cases) {
        let writerCalls = 0;
        const executor = executorModule.createRuntimeCertificationSourceApplyExecutor({
            readDryRun: () => plan,
            readCurrentState: async () => state,
            applySourceUpdate: async () => {
                writerCalls += 1;
                throw new Error('must not execute');
            },
            attempts: new Map(),
        });

        const result = await executor.execute(TARGET, {
            approval: sourceApplyApproval(),
        });

        assert.equal(result.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_REJECTED');
        assert.equal(result.reason, expectedReason);
        assert.equal(writerCalls, 0);
        assert.equal(result.sourceMutationAppliedByModule, false);
    }
});

test('P1C30 requires explicit source-apply approval before final-state read or writer invocation', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const plan = await makeReadyDryRun();

    let stateReads = 0;
    let writerCalls = 0;
    const executor = executorModule.createRuntimeCertificationSourceApplyExecutor({
        readDryRun: () => plan,
        readProvenanceAttestation: () => provenanceAttestation(plan),
        readCurrentState: async () => {
            stateReads += 1;
            return exactCurrentState();
        },
        applySourceUpdate: async () => {
            writerCalls += 1;
            return {};
        },
        attempts: new Map(),
    });

    const result = await executor.execute(TARGET, {
        approval: sourceApplyApproval({ sourceApplyApproved: false }),
    });

    assert.equal(result.reason, 'SOURCE_APPLY_NOT_APPROVED');
    assert.equal(stateReads, 0);
    assert.equal(writerCalls, 0);
    assert.equal(result.sourceApplyApproved, false);
});

test('P1C30 treats thrown or invalid writer outcomes as indeterminate and permanently blocks automatic retry', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const plan = await makeReadyDryRun();

    for (const writer of [
        async () => { throw new Error('transport lost after request'); },
        async () => ({
            applied: true,
            mutationCount: 2,
            targetPath: plan.operation.targetPath,
            previousBaseCommitSha: BASE_COMMIT_SHA,
            previousSourceBlobSha: SOURCE_BLOB_SHA,
            newCommitSha: NEW_COMMIT_SHA,
            newSourceBlobSha: NEW_BLOB_SHA,
            sourceRevision: 2,
            certificationCount: 1,
        }),
    ]) {
        let writerCalls = 0;
        const attempts = new Map();
        const executor = executorModule.createRuntimeCertificationSourceApplyExecutor({
            readDryRun: () => plan,
            readCurrentState: async () => exactCurrentState(),
            applySourceUpdate: async (request) => {
                writerCalls += 1;
                return writer(request);
            },
            attempts,
        });

        const first = await executor.execute(TARGET, {
            approval: sourceApplyApproval(),
        });
        assert.equal(first.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_INDETERMINATE');
        assert.equal(first.externalWriterInvoked, true);
        assert.equal(first.externalMutationReported, false);
        assert.equal(first.retryAllowed, false);
        assert.equal(writerCalls, 1);

        const second = await executor.execute(TARGET, {
            approval: sourceApplyApproval(),
        });
        assert.equal(second.status, 'RUNTIME_CERTIFICATION_SOURCE_APPLY_EXECUTOR_REJECTED');
        assert.equal(second.reason, 'SOURCE_APPLY_EXECUTION_ALREADY_ATTEMPTED');
        assert.equal(second.retryAllowed, false);
        assert.equal(writerCalls, 1);
    }
});

test('P1C30 successful receipt summary is sanitized', async () => {
    const executorModule = await import(
        '../src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs'
    );
    const plan = await makeReadyDryRun();

    const executor = executorModule.createRuntimeCertificationSourceApplyExecutor({
        readDryRun: () => plan,
        readProvenanceAttestation: () => provenanceAttestation(plan),
        readCurrentState: async () => exactCurrentState(),
        applySourceUpdate: async (request) => ({
            applied: true,
            mutationCount: 1,
            targetPath: request.targetPath,
            previousBaseCommitSha: request.expectedCurrent.baseCommitSha,
            previousSourceBlobSha: request.expectedCurrent.sourceBlobSha,
            newCommitSha: NEW_COMMIT_SHA,
            newSourceBlobSha: NEW_BLOB_SHA,
            sourceRevision: request.proposed.sourceRevision,
            certificationCount: request.proposed.certificationCount,
        }),
        attempts: new Map(),
    });

    const result = await executor.execute(TARGET, {
        approval: sourceApplyApproval(),
    });
    const serialized = JSON.stringify(result);

    for (const forbidden of [
        'sourceContent',
        'source-operator-001',
        'Approved exactly one guarded external source-control update',
        'approvalNote',
        'operatorDisplayName',
        'p1c8-human-certification-record',
        'certificationRecord',
        'certifiedProfile',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `receipt leaked: ${forbidden}`);
    }
});

test('P1C30 module has no direct filesystem/GitHub writer, UI, runtime-load, routing, or cutover capability', () => {
    const executor = fs.readFileSync(
        'src/lib/computeRouter/runtimeCertificationSourceApplyExecutor.mjs',
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
        'routingEligible: true',
        'cutoverAuthorized: true',
        "executionAuthority: 'compute-router'",
    ]) {
        assert.equal(executor.includes(forbidden), false, `unexpected P1C30 direct capability: ${forbidden}`);
    }

    assert.ok(executor.includes('applySourceUpdate = null'));
    assert.ok(executor.includes('readCurrentState = null'));
    assert.ok(executor.includes("sourceControlAuthority: 'external-injected-writer-only'"));
    assert.ok(executor.includes('sourceMutationAppliedByModule: false'));

    for (const surface of [settings, panel, main, image, video]) {
        assert.equal(surface.includes('runtimeCertificationSourceApplyExecutor'), false);
        assert.equal(surface.includes('executeRuntimeCertificationSourceApply'), false);
    }
});
