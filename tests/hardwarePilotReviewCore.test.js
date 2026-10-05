const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildHardwarePilotReviewProjection,
    recordHardwarePilotReviewDecision,
    sanitizeDecisionResult,
} = require('../electron/lib/hardwarePilotReviewCore');

function fixtureBundle() {
    const target = { modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024 };
    const runs = [1, 2, 3].map((runIndex) => ({
        sample: {
            runIndex,
            modelId: target.modelId,
            backend: target.backend,
            resolution: { width: target.width, height: target.height },
            measuredAt: `2026-09-22T02:0${runIndex}:00.000Z`,
            peakSystemRamMiB: 12000 + runIndex,
            peakVramMiB: 7000 + runIndex,
        },
    }));
    const performance = [1, 2, 3].map((runIndex) => ({
        runIndex,
        modelId: target.modelId,
        backend: target.backend,
        resolution: { width: target.width, height: target.height },
        measuredAt: `2026-09-22T02:0${runIndex}:00.000Z`,
        durationMs: 1500 + runIndex,
    }));

    return {
        schemaVersion: 1,
        evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
        evidenceClass: 'real-runtime-hardware-pilot',
        target,
        sampleCount: 3,
        runIndexes: [1, 2, 3],
        capturedFrom: runs[0].sample.measuredAt,
        capturedTo: runs[2].sample.measuredAt,
        benchmarkContext: {
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
        },
        runEvidence: runs,
        performanceEvidence: performance,
        localPathsIncluded: false,
        hardwareIdentityIncluded: false,
        promptContentIncluded: false,
        cryptographicAuthenticityVerified: false,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

test('P1C67 builds a sanitized human-review projection with 3 measured runs', () => {
    const projection = buildHardwarePilotReviewProjection({
        sha256: 'a'.repeat(64),
        bundle: fixtureBundle(),
    });

    assert.equal(projection.status, 'HARDWARE_PILOT_REVIEW_READY');
    assert.equal(projection.sampleCount, 3);
    assert.deepEqual(projection.runs.map((run) => run.runIndex), [1, 2, 3]);
    assert.equal(projection.timing.minDurationMs, 1501);
    assert.equal(projection.timing.maxDurationMs, 1503);
    assert.equal(projection.timing.averageDurationMs, 1502);
    assert.equal(projection.observedResources.peakSystemRamMiB, 12003);
    assert.equal(projection.observedResources.peakVramMiB, 7003);
    assert.equal(projection.requiresHumanReview, true);
    assert.equal(projection.routingEligible, false);
    assert.equal(projection.cutoverAuthorized, false);

    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes('runtimeBinarySha256'), false);
    assert.equal(serialized.includes('modelArtifactSha256'), false);
    assert.equal(serialized.includes('auxiliaryArtifacts'), false);
    assert.equal(serialized.includes('selectedDeviceName'), false);
});

test('P1C68 requires an explicit human decision and non-empty review note', () => {
    const projection = buildHardwarePilotReviewProjection({
        sha256: 'b'.repeat(64),
        bundle: fixtureBundle(),
    });

    assert.throws(() => recordHardwarePilotReviewDecision({
        projection,
        decision: 'approve',
        reviewNote: '',
        decidedAt: '2026-10-05T03:30:00.000Z',
    }), /note is invalid/);

    const approved = recordHardwarePilotReviewDecision({
        projection,
        decision: 'approve',
        reviewNote: 'Three real runs reviewed; observed envelope accepted for pilot evidence.',
        decidedAt: '2026-10-05T03:30:00.000Z',
    });

    assert.equal(approved.status, 'HARDWARE_PILOT_REVIEW_APPROVED');
    assert.equal(approved.humanReviewCompleted, true);
    assert.equal(approved.requiresHumanReview, false);
    assert.equal(approved.routingEligible, false);
    assert.equal(approved.cutoverAuthorized, false);
});

test('P1C69 approved evidence creates only an evidence-scoped pilot-certified profile', () => {
    const projection = buildHardwarePilotReviewProjection({
        sha256: 'c'.repeat(64),
        bundle: fixtureBundle(),
    });
    const record = recordHardwarePilotReviewDecision({
        projection,
        decision: 'approve',
        reviewNote: 'Reviewed and approved for pilot evidence only.',
        decidedAt: '2026-10-05T03:31:00.000Z',
    });
    const safe = sanitizeDecisionResult(record);

    assert.equal(safe.profile.status, 'pilot-certified');
    assert.equal(safe.profile.certificationScope, 'hardware-pilot-evidence-review-only');
    assert.equal(safe.profile.evidenceSha256, 'c'.repeat(64));
    assert.equal(safe.profile.productionProfilePromoted, false);
    assert.equal(safe.profile.routingEligible, false);
    assert.equal(safe.profile.cutoverAuthorized, false);
    assert.equal(safe.profile.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(Object.hasOwn(safe, 'reviewNote'), false);
});

test('P1C68 rejection never creates a profile', () => {
    const projection = buildHardwarePilotReviewProjection({
        sha256: 'd'.repeat(64),
        bundle: fixtureBundle(),
    });
    const rejected = recordHardwarePilotReviewDecision({
        projection,
        decision: 'reject',
        reviewNote: 'Observed envelope is not acceptable.',
        decidedAt: '2026-10-05T03:32:00.000Z',
    });

    assert.equal(rejected.status, 'HARDWARE_PILOT_REVIEW_DECISION_REJECTED');
    assert.equal(rejected.profile, null);
    assert.equal(rejected.routingEligible, false);
});
