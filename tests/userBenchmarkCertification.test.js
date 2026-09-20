const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const SOURCE_COMMIT = 'a'.repeat(40);
const RUNTIME_SHA = 'b'.repeat(64);
const MODEL_SHA = 'c'.repeat(64);
const LLM_SHA = 'd'.repeat(64);
const VAE_SHA = 'e'.repeat(64);

function runEvidence(runIndex) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample: {
            schemaVersion: 1,
            protocolVersion: 'p1c5-v1',
            runIndex,
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
            harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
            sourceCommit: SOURCE_COMMIT,
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            runtimeBinarySha256: RUNTIME_SHA,
            modelArtifactSha256: MODEL_SHA,
            measuredAt: `2026-09-19T19:0${runIndex}:00.000Z`,
            peakSystemRamMiB: 12000 + runIndex,
            peakVramMiB: 7000 + runIndex,
        },
        auxiliaryArtifacts: [
            { role: 'llm', sha256: LLM_SHA },
            { role: 'vae', sha256: VAE_SHA },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

async function reviewSession() {
    const p1c7 = await import('../src/lib/computeRouter/benchmarkSessionEvidence.mjs');
    const result = p1c7.buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-19T19:10:00.000Z',
    });
    assert.equal(result.status, 'BENCHMARK_SESSION_READY_FOR_REVIEW');
    return result;
}

async function loadModule() {
    return import('../src/lib/computeRouter/userBenchmarkCertification.mjs');
}

test('P1C23 records an explicit P1C8 human certification without loading the runtime registry', async () => {
    const certificationModule = await loadModule();
    const session = await reviewSession();
    const certification = certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => session,
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });

    const result = certification.recordCertification({
        target: TARGET,
        decision: 'approve',
        reviewer: {
            id: 'reviewer-local-001',
            displayName: 'Victor',
        },
        reviewNote: 'Reviewed three exact-context controlled benchmark runs and approved the derived requirements.',
    });

    assert.equal(result.status, 'USER_BENCHMARK_CERTIFICATION_RECORDED');
    assert.equal(result.certificationOnly, true);
    assert.equal(result.runtimeRegistryLoaded, false);
    assert.equal(result.reviewerIdentityVerified, false);
    assert.equal(result.authenticityVerified, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.summary.certifiedAt, '2026-09-19T19:20:00.000Z');
    assert.equal(result.summary.reviewerDisplayName, 'Victor');
    assert.equal(result.summary.reviewerIdentityVerified, false);
    assert.equal(result.summary.authenticityVerified, false);
    assert.equal(result.summary.runtimeRegistryLoaded, false);
    assert.deepEqual(result.summary.requirements, {
        minSystemRamMiB: 14404,
        minVramMiB: 8404,
    });
});

test('P1C23 requires explicit approval, exact reviewer fields and non-empty review note', async () => {
    const certificationModule = await loadModule();
    const session = await reviewSession();

    const make = () => certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => session,
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });

    assert.equal(make().recordCertification({
        target: TARGET,
        decision: 'reject',
        reviewer: { id: 'r1', displayName: 'Victor' },
        reviewNote: 'No.',
    }).reason, 'USER_BENCHMARK_CERTIFICATION_DECISION_NOT_APPROVED');

    for (const reviewer of [
        null,
        { id: '', displayName: 'Victor' },
        { id: 'r1', displayName: '' },
        { id: 'r1', displayName: 'Victor', extra: true },
    ]) {
        assert.equal(make().recordCertification({
            target: TARGET,
            decision: 'approve',
            reviewer,
            reviewNote: 'Reviewed.',
        }).reason, 'USER_BENCHMARK_CERTIFICATION_REVIEWER_INVALID');
    }

    for (const reviewNote of ['', '   ', 'x'.repeat(2001)]) {
        assert.equal(make().recordCertification({
            target: TARGET,
            decision: 'approve',
            reviewer: { id: 'r1', displayName: 'Victor' },
            reviewNote,
        }).reason, 'USER_BENCHMARK_CERTIFICATION_NOTE_INVALID');
    }
});

test('P1C23 fails closed if the P1C22 review package is unavailable', async () => {
    const certificationModule = await loadModule();
    const certification = certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => null,
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });

    const result = certification.recordCertification({
        target: TARGET,
        decision: 'approve',
        reviewer: { id: 'r1', displayName: 'Victor' },
        reviewNote: 'Reviewed.',
    });

    assert.equal(result.reason, 'USER_BENCHMARK_CERTIFICATION_REVIEW_UNAVAILABLE');
});

test('P1C23 rejects forged downstream authority and arbitrary certification failures', async () => {
    const certificationModule = await loadModule();
    const session = await reviewSession();

    const forged = certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => session,
        certify: () => ({
            status: 'RESOURCE_PROFILE_CERTIFICATION_RECORDED',
            reason: null,
            certificationRecord: {},
            certifiedProfile: {},
            reviewerIdentityVerified: false,
            authenticityVerified: false,
            routingEligible: true,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });
    assert.equal(forged.recordCertification({
        target: TARGET,
        decision: 'approve',
        reviewer: { id: 'r1', displayName: 'Victor' },
        reviewNote: 'Reviewed.',
    }).reason, 'USER_BENCHMARK_CERTIFICATION_RESULT_INVALID');

    const throwing = certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => session,
        certify: () => {
            throw new Error('C:/private/path reviewer-secret');
        },
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });
    const result = throwing.recordCertification({
        target: TARGET,
        decision: 'approve',
        reviewer: { id: 'r1', displayName: 'Victor' },
        reviewNote: 'Reviewed.',
    });
    assert.equal(result.reason, 'USER_BENCHMARK_CERTIFICATION_FAILED');
    assert.equal(JSON.stringify(result).includes('private'), false);
});

test('P1C23 internal result preserves the real P1C8 record and certified P1C4 profile', async () => {
    const certificationModule = await loadModule();
    const profileModule = await import('../src/lib/computeRouter/modelResourceProfiles.mjs');
    const session = await reviewSession();
    const certification = certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => session,
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });

    certification.recordCertification({
        target: TARGET,
        decision: 'approve',
        reviewer: { id: 'reviewer-local-001', displayName: 'Victor' },
        reviewNote: 'Reviewed.',
    });
    const first = certification.readCertification(TARGET);
    const second = certification.readCertification(TARGET);

    assert.notEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.certificationRecord), true);
    assert.equal(first.certificationRecord.evidenceType, 'p1c8-human-certification-record');
    assert.equal(first.certificationRecord.reviewer.reviewerIdentityVerified, false);
    assert.equal(first.certificationRecord.authenticityVerified, false);
    assert.equal(profileModule.validateCertifiedResourceProfile(first.certifiedProfile).ok, true);
    assert.equal(first.certifiedProfile.status, 'certified');
    assert.equal(first.routingEligible, false);
    assert.equal(first.cutoverAuthorized, false);
});

test('P1C23 public summary omits reviewer id, review note, hashes and raw certification records', async () => {
    const certificationModule = await loadModule();
    const session = await reviewSession();
    const certification = certificationModule.createUserBenchmarkCertification({
        store: new Map(),
        readReviewSession: () => session,
        now: () => new Date('2026-09-19T19:20:00.000Z'),
    });

    certification.recordCertification({
        target: TARGET,
        decision: 'approve',
        reviewer: { id: 'private-reviewer-id', displayName: 'Victor' },
        reviewNote: 'private review note',
    });

    const publicState = certification.getSummary(TARGET);
    const serialized = JSON.stringify(publicState);
    assert.equal(serialized.includes('private-reviewer-id'), false);
    assert.equal(serialized.includes('private review note'), false);

    for (const forbidden of [
        'certificationRecord',
        'certifiedProfile',
        'sha256',
        'runtimeIdentity',
        'runtimeVersion',
        'sourceCommit',
        'auxiliaryArtifacts',
        'reviewNote',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `summary leaked: ${forbidden}`);
    }
});

test('P1C23 source remains in-memory and never modifies the runtime certification source or routing', () => {
    const source = fs.readFileSync('src/lib/computeRouter/userBenchmarkCertification.mjs', 'utf8');

    assert.ok(source.includes('certifyResourceProfile'));
    assert.ok(source.includes('runtimeRegistryLoaded: false'));
    assert.ok(source.includes('reviewerIdentityVerified: false'));
    assert.ok(source.includes('authenticityVerified: false'));

    for (const forbidden of [
        "from 'node:fs'",
        "from 'fs'",
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE',
        'runtimeResourceProfileCertifications',
        'loadRuntimeCertifiedResourceProfileRegistry',
        'productionProfilePromoted: true',
        'runtimeRegistryLoaded: true',
        'routingEligible: true',
        'cutoverAuthorized: true',
    ]) {
        assert.equal(source.includes(forbidden), false, `unexpected P1C23 capability: ${forbidden}`);
    }
});
