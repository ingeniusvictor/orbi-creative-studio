const test = require('node:test');
const assert = require('node:assert/strict');

async function modules() {
    const [session, certification, profiles] = await Promise.all([
        import('../src/lib/computeRouter/benchmarkSessionEvidence.mjs'),
        import('../src/lib/computeRouter/resourceProfileCertification.mjs'),
        import('../src/lib/computeRouter/modelResourceProfiles.mjs'),
    ]);
    return { session, certification, profiles };
}

function sample(runIndex) {
    return {
        schemaVersion: 1,
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        resolution: { width: 1024, height: 1024 },
        harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
        sourceCommit: 'a'.repeat(40),
        runtimeIdentity: 'sd.cpp-cuda12',
        runtimeVersion: 'runtime-v1',
        runtimeBinarySha256: 'b'.repeat(64),
        modelArtifactSha256: 'c'.repeat(64),
        measuredAt: `2026-09-16T03:00:0${runIndex}.000Z`,
        peakSystemRamMiB: [0, 8000, 8500, 8200][runIndex],
        peakVramMiB: [0, 6000, 6200, 6100][runIndex],
    };
}

function runEvidence(runIndex) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample: sample(runIndex),
        auxiliaryArtifacts: [
            { role: 'llm', sha256: 'd'.repeat(64) },
            { role: 'vae', sha256: 'e'.repeat(64) },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

async function readySession() {
    const { session } = await modules();
    return session.buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });
}

test('P1C8 converts an approved P1C7 session into an exact P1C4 certified profile', async () => {
    const { certification, profiles } = await modules();
    const sessionResult = await readySession();
    const result = certification.certifyResourceProfile({
        sessionResult,
        decision: 'approve',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Reviewed controlled benchmark evidence and approved exact derived requirements.',
    });

    assert.equal(result.status, 'RESOURCE_PROFILE_CERTIFICATION_RECORDED');
    assert.equal(profiles.validateCertifiedResourceProfile(result.certifiedProfile).ok, true);
    assert.deepEqual(result.certifiedProfile.requirements, {
        minSystemRamMiB: 10200,
        minVramMiB: 7440,
    });

    const resolved = profiles.resolveCertifiedResourceRequirements({
        profile: result.certifiedProfile,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.equal(resolved.status, 'RESOURCE_PROFILE_CERTIFIED');
    assert.deepEqual(resolved.requirements, {
        minSystemRamMiB: 10200,
        minVramMiB: 7440,
    });
});

test('P1C8 reviewer cannot provide lowered or alternate requirements because no override input exists', async () => {
    const { certification } = await modules();
    const sessionResult = await readySession();
    const result = certification.certifyResourceProfile({
        sessionResult,
        decision: 'approve',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Approve exact evidence-derived requirements.',
        approvedRequirements: { minSystemRamMiB: 1, minVramMiB: 1 },
    });

    assert.deepEqual(result.certifiedProfile.requirements, {
        minSystemRamMiB: 10200,
        minVramMiB: 7440,
    });
});

test('P1C8 requires an explicit approve decision and valid reviewer declaration', async () => {
    const { certification } = await modules();
    const sessionResult = await readySession();

    const rejected = certification.certifyResourceProfile({
        sessionResult,
        decision: 'reject',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Not approved.',
    });
    assert.equal(rejected.status, 'RESOURCE_PROFILE_CERTIFICATION_REJECTED');
    assert.equal(rejected.reason, 'CERTIFICATION_DECISION_NOT_APPROVED');

    const missingReviewer = certification.certifyResourceProfile({
        sessionResult,
        decision: 'approve',
        reviewer: { id: '', displayName: '' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Approve.',
    });
    assert.equal(missingReviewer.reason, 'CERTIFICATION_REVIEWER_INVALID');
});

test('P1C8 does not claim verified reviewer identity, authenticity, routing or cutover', async () => {
    const { certification } = await modules();
    const sessionResult = await readySession();
    const result = certification.certifyResourceProfile({
        sessionResult,
        decision: 'approve',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Approve exact benchmark-derived resource profile.',
    });

    assert.equal(result.reviewerIdentityVerified, false);
    assert.equal(result.authenticityVerified, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(result.certificationRecord.reviewer.reviewerIdentityVerified, false);
    assert.equal(result.certificationRecord.authenticityVerified, false);
});

test('P1C8 rejects a forged session that claims prior promotion or routing authority', async () => {
    const { certification } = await modules();
    const sessionResult = await readySession();
    const forged = {
        ...sessionResult,
        routingEligible: true,
    };

    const result = certification.certifyResourceProfile({
        sessionResult: forged,
        decision: 'approve',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Approve.',
    });
    assert.equal(result.status, 'RESOURCE_PROFILE_CERTIFICATION_REJECTED');
    assert.equal(result.reason, 'SESSION_AUTHORITY_INVALID');
});
