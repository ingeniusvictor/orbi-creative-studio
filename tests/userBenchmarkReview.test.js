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
            measuredAt: `2026-09-18T14:4${runIndex}:00.000Z`,
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

async function loadModule() {
    return import('../src/lib/computeRouter/userBenchmarkReview.mjs');
}

test('P1C22 prepares a P1C7 review bundle from exactly three samples and explicit margin', async () => {
    const reviewModule = await loadModule();
    const review = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
        now: () => new Date('2026-09-18T15:00:00.000Z'),
    });

    const result = review.prepare({ target: TARGET, safetyMarginPct: 20 });

    assert.equal(result.status, 'USER_BENCHMARK_REVIEW_READY');
    assert.equal(result.reviewOnly, true);
    assert.equal(result.requiresHumanCertification, true);
    assert.equal(result.productionProfilePromoted, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.summary.runCount, 3);
    assert.deepEqual(result.summary.runIndexes, [1, 2, 3]);
    assert.equal(result.summary.reviewedAt, '2026-09-18T15:00:00.000Z');
    assert.equal(result.summary.safetyMarginPct, 20);
    assert.equal(result.summary.observedPeakSystemRamMiB, 12003);
    assert.equal(result.summary.observedPeakVramMiB, 7003);
    assert.deepEqual(result.summary.requirements, {
        minSystemRamMiB: 14404,
        minVramMiB: 8404,
    });
});

test('P1C22 rejects incomplete evidence and invalid margins without storing a review', async () => {
    const reviewModule = await loadModule();

    for (const margin of [-1, 101, NaN, Infinity, '20']) {
        const store = new Map();
        const review = reviewModule.createUserBenchmarkReview({
            store,
            readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
            now: () => new Date('2026-09-18T15:00:00.000Z'),
        });
        const result = review.prepare({ target: TARGET, safetyMarginPct: margin });
        assert.equal(result.reason, 'USER_BENCHMARK_REVIEW_MARGIN_INVALID');
        assert.equal(store.size, 0);
    }

    const incomplete = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2)],
        now: () => new Date('2026-09-18T15:00:00.000Z'),
    });
    assert.equal(
        incomplete.prepare({ target: TARGET, safetyMarginPct: 20 }).reason,
        'USER_BENCHMARK_REVIEW_SAMPLE_COUNT_INVALID',
    );
});

test('P1C22 fails closed on invalid clock or invalid P1C7 output', async () => {
    const reviewModule = await loadModule();

    const badClock = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
        now: () => ({ toISOString: () => 'not-an-iso-time' }),
    });
    assert.equal(
        badClock.prepare({ target: TARGET, safetyMarginPct: 20 }).reason,
        'USER_BENCHMARK_REVIEW_TIMESTAMP_INVALID',
    );

    const forged = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
        buildSessionEvidence: () => ({
            status: 'BENCHMARK_SESSION_READY_FOR_REVIEW',
            reason: null,
            evidenceBundle: {},
            productionProfilePromoted: false,
            routingEligible: true,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
        now: () => new Date('2026-09-18T15:00:00.000Z'),
    });
    assert.equal(
        forged.prepare({ target: TARGET, safetyMarginPct: 20 }).reason,
        'USER_BENCHMARK_REVIEW_SESSION_INVALID',
    );
});

test('P1C22 generated session is directly acceptable by the existing P1C8 review contract', async () => {
    const reviewModule = await loadModule();
    const certification = await import('../src/lib/computeRouter/resourceProfileCertification.mjs');
    const review = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
        now: () => new Date('2026-09-18T15:00:00.000Z'),
    });

    assert.equal(review.prepare({ target: TARGET, safetyMarginPct: 15 }).status, 'USER_BENCHMARK_REVIEW_READY');
    const session = review.readSession(TARGET);
    assert.deepEqual(certification.validateReviewableSession(session), {
        ok: true,
        reason: null,
        bundle: session.evidenceBundle,
        candidate: session.evidenceBundle.candidate,
    });
});

test('P1C22 public summary never exposes hashes, runtime identity, reviewer data or raw evidence', async () => {
    const reviewModule = await loadModule();
    const review = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
        now: () => new Date('2026-09-18T15:00:00.000Z'),
    });

    review.prepare({ target: TARGET, safetyMarginPct: 20 });
    const publicState = review.getSummary(TARGET);
    const serialized = JSON.stringify(publicState);

    for (const forbidden of [
        'sha256',
        'runtimeIdentity',
        'runtimeVersion',
        'sourceCommit',
        'harnessVersion',
        'auxiliaryArtifacts',
        'reviewer',
        'reviewNote',
        'certificationRecord',
    ]) {
        assert.equal(serialized.includes(forbidden), false, `summary leaked: ${forbidden}`);
    }
});

test('P1C22 internal review session is detached and immutable for later P1C8 use', async () => {
    const reviewModule = await loadModule();
    const review = reviewModule.createUserBenchmarkReview({
        store: new Map(),
        readEvidence: () => [runEvidence(1), runEvidence(2), runEvidence(3)],
        now: () => new Date('2026-09-18T15:00:00.000Z'),
    });

    review.prepare({ target: TARGET, safetyMarginPct: 20 });
    const first = review.readSession(TARGET);
    const second = review.readSession(TARGET);

    assert.notEqual(first, second);
    assert.notEqual(first.evidenceBundle, second.evidenceBundle);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.evidenceBundle), true);
    assert.equal(Object.isFrozen(first.evidenceBundle.candidate.recommendation.requirements), true);
    assert.equal(first.productionProfilePromoted, false);
    assert.equal(first.routingEligible, false);
});

test('P1C22 source remains in-memory and cannot certify or promote a profile', () => {
    const source = fs.readFileSync('src/lib/computeRouter/userBenchmarkReview.mjs', 'utf8');

    assert.ok(source.includes('buildBenchmarkSessionEvidence'));
    assert.ok(source.includes('validateReviewableSession'));
    assert.ok(source.includes('requiresHumanCertification: true'));

    for (const forbidden of [
        "from 'node:fs'",
        "from 'fs'",
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'certifyResourceProfile(',
        'RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE',
        'productionProfilePromoted: true',
        'routingEligible: true',
        'cutoverAuthorized: true',
    ]) {
        assert.equal(source.includes(forbidden), false, `unexpected P1C22 capability: ${forbidden}`);
    }
});
