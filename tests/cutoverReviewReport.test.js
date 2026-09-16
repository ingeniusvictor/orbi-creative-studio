const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function review() {
    return import('../src/lib/computeRouter/cutoverReviewReport.mjs');
}

function route(routeKey, overrides = {}) {
    const [expectedProviderId, operation] = routeKey.split(':');
    return {
        routeKey,
        expectedProviderId,
        operation,
        eligibleForCutoverReview: true,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        certifiedModelIds: [`${routeKey}-model`],
        reasons: [],
        ...overrides,
    };
}

function assessment(overrides = {}) {
    return {
        schemaVersion: 1,
        profileId: 'studio-image-video-v1',
        requestedProfileId: 'studio-image-video-v1',
        profileMatches: true,
        certificationSchemaValid: true,
        certificationFreshnessStrict: true,
        certificationGloballyCertified: true,
        duplicateCertificationRoutes: [],
        duplicateProviders: [],
        releaseGates: {
            ciGreen: true,
            platformMatrixGreen: true,
            securityReviewApproved: true,
            rollbackPlanApproved: true,
        },
        missingReleaseGates: [],
        eligibleForCutoverReview: true,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        reason: 'ELIGIBLE_FOR_CUTOVER_REVIEW',
        routes: [
            route('sdcpp-device:t2i'),
            route('wan2gp-lan:t2i'),
            route('wan2gp-lan:t2v'),
            route('wan2gp-lan:i2v'),
            route('muapi-cloud:t2i'),
            route('muapi-cloud:i2i'),
            route('muapi-cloud:t2v'),
            route('muapi-cloud:i2v'),
            route('muapi-cloud:v2v'),
        ],
        ...overrides,
    };
}

test('ready eligibility assessment becomes a READY_FOR_REVIEW report without authorizing cutover', async () => {
    const { buildCutoverReviewReport } = await review();
    const report = buildCutoverReviewReport({
        assessment: assessment(),
        generatedAt: 1000,
    });

    assert.equal(report.reviewStatus, 'READY_FOR_REVIEW');
    assert.equal(report.readyForReview, true);
    assert.equal(report.cutoverAuthorized, false);
    assert.equal(report.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(report.summary.routeCount, 9);
    assert.equal(report.summary.eligibleRouteCount, 9);
    assert.equal(report.summary.blockedRouteCount, 0);
    assert.deepEqual(report.globalBlockers, []);
});

test('missing release gate is surfaced as a global blocker', async () => {
    const { buildCutoverReviewReport } = await review();
    const input = assessment({
        eligibleForCutoverReview: false,
        reason: 'NOT_ELIGIBLE_FOR_CUTOVER_REVIEW',
        releaseGates: {
            ciGreen: false,
            platformMatrixGreen: true,
            securityReviewApproved: true,
            rollbackPlanApproved: true,
        },
        missingReleaseGates: ['ciGreen'],
    });

    const report = buildCutoverReviewReport({ assessment: input, generatedAt: 1000 });
    assert.equal(report.reviewStatus, 'BLOCKED');
    assert.equal(report.readyForReview, false);
    assert.ok(report.globalBlockers.includes('eligibility-assessment-not-eligible'));
    assert.ok(report.globalBlockers.includes('release-gate:ciGreen'));
    assert.equal(report.summary.missingReleaseGateCount, 1);
});

test('route blockers remain visible and count against review readiness', async () => {
    const { buildCutoverReviewReport } = await review();
    const input = assessment({
        eligibleForCutoverReview: false,
        routes: assessment().routes.map((item) => item.routeKey === 'muapi-cloud:t2v'
            ? {
                ...item,
                eligibleForCutoverReview: false,
                reasons: ['provider-health:offline'],
            }
            : item),
    });

    const report = buildCutoverReviewReport({ assessment: input, generatedAt: 2000 });
    assert.equal(report.reviewStatus, 'BLOCKED');
    assert.equal(report.summary.eligibleRouteCount, 8);
    assert.equal(report.summary.blockedRouteCount, 1);
    const blocked = report.routes.find((item) => item.routeKey === 'muapi-cloud:t2v');
    assert.deepEqual(blocked.reasons, ['provider-health:offline']);
});

test('review rejects globally authorizing assessments', async () => {
    const { buildCutoverReviewReport } = await review();
    assert.throws(
        () => buildCutoverReviewReport({
            assessment: assessment({ cutoverAuthorized: true }),
            generatedAt: 1000,
        }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_INPUT',
    );
});

test('review rejects a route that claims cutover authority or non-legacy execution', async () => {
    const { buildCutoverReviewReport } = await review();

    const routeAuthorized = assessment();
    routeAuthorized.routes = routeAuthorized.routes.map((item, index) => index === 0
        ? { ...item, cutoverAuthorized: true }
        : item);
    assert.throws(
        () => buildCutoverReviewReport({ assessment: routeAuthorized, generatedAt: 1000 }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_INPUT',
    );

    const wrongAuthority = assessment();
    wrongAuthority.routes = wrongAuthority.routes.map((item, index) => index === 0
        ? { ...item, executionAuthority: 'compute-router' }
        : item);
    assert.throws(
        () => buildCutoverReviewReport({ assessment: wrongAuthority, generatedAt: 1000 }),
        (error) => error.code === 'INVALID_CUTOVER_REVIEW_INPUT',
    );
});

test('text formatter keeps authority boundary explicit', async () => {
    const { buildCutoverReviewReport, formatCutoverReviewText } = await review();
    const report = buildCutoverReviewReport({ assessment: assessment(), generatedAt: 1000 });
    const text = formatCutoverReviewText(report);

    assert.ok(text.includes('ORBI Compute Router — Cutover Review Report'));
    assert.ok(text.includes('Status: READY_FOR_REVIEW'));
    assert.ok(text.includes('Execution authority: legacy-dispatcher-only'));
    assert.ok(text.includes('Cutover authorized: NO'));
    assert.ok(text.includes('Routes: 9/9 eligible for review'));
    assert.equal(text.includes('Cutover authorized: YES'), false);
});

test('cutover review report remains pure and isolated from Studio execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/cutoverReviewReport.mjs', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localAI.generate',
        'muapi.generate',
        'routeGenerationRequest(',
        'localStorage',
        'sessionStorage',
        'window.',
        'globalThis.',
    ]) {
        assert.equal(source.includes(token), false, `unexpected review side effect token: ${token}`);
    }

    assert.equal(image.includes('cutoverReviewReport'), false);
    assert.equal(video.includes('cutoverReviewReport'), false);
});
