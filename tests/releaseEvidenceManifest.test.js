const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function releaseEvidence() {
    return import('../src/lib/computeRouter/releaseEvidenceManifest.mjs');
}

const SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function greenInput(overrides = {}) {
    const generatedAt = 1_000_000;
    return {
        sourceCommit: SOURCE,
        generatedAt,
        ci: {
            sourceCommit: SOURCE,
            status: 'passed',
            runId: 'gha-run-123',
            completedAt: generatedAt - 4000,
        },
        platforms: {
            linux: {
                sourceCommit: SOURCE,
                status: 'passed',
                evidenceId: 'linux-run-1',
                completedAt: generatedAt - 3000,
            },
            macos: {
                sourceCommit: SOURCE,
                status: 'passed',
                evidenceId: 'macos-run-1',
                completedAt: generatedAt - 2500,
            },
            windows: {
                sourceCommit: SOURCE,
                status: 'passed',
                evidenceId: 'windows-run-1',
                completedAt: generatedAt - 2000,
            },
        },
        securityReview: {
            sourceCommit: SOURCE,
            approved: true,
            reviewId: 'security-review-1',
            reviewedAt: generatedAt - 1500,
        },
        rollbackPlan: {
            sourceCommit: SOURCE,
            approved: true,
            planId: 'rollback-plan-1',
            reviewedAt: generatedAt - 1000,
        },
        ...overrides,
    };
}

test('fully commit-bound evidence completes all release gates without authorizing cutover', async () => {
    const { buildReleaseEvidenceManifest, extractReleaseGates } = await releaseEvidence();
    const manifest = buildReleaseEvidenceManifest(greenInput());

    assert.equal(manifest.ready, true);
    assert.equal(manifest.status, 'RELEASE_EVIDENCE_COMPLETE');
    assert.equal(manifest.sourceCommit, SOURCE);
    assert.equal(manifest.profileId, 'studio-image-video-v1');
    assert.equal(manifest.cutoverAuthorized, false);
    assert.equal(manifest.executionAuthority, 'legacy-dispatcher-only');
    assert.deepEqual(manifest.issues, []);
    assert.deepEqual(manifest.releaseGates, {
        ciGreen: true,
        platformMatrixGreen: true,
        securityReviewApproved: true,
        rollbackPlanApproved: true,
    });
    assert.deepEqual(extractReleaseGates(manifest), manifest.releaseGates);
});

test('CI evidence for a different commit fails closed', async () => {
    const { buildReleaseEvidenceManifest, extractReleaseGates } = await releaseEvidence();
    const input = greenInput();
    input.ci = { ...input.ci, sourceCommit: OTHER };

    const manifest = buildReleaseEvidenceManifest(input);
    assert.equal(manifest.ready, false);
    assert.equal(manifest.releaseGates.ciGreen, false);
    assert.ok(manifest.issues.includes('ci:commit-mismatch'));
    assert.equal(extractReleaseGates(manifest).ciGreen, false);
});

test('all three platform records must pass for the platform matrix gate', async () => {
    const { buildReleaseEvidenceManifest } = await releaseEvidence();
    const input = greenInput();
    input.platforms.windows = {
        sourceCommit: SOURCE,
        status: 'unavailable',
        evidenceId: 'windows-run-1',
        completedAt: input.generatedAt - 1000,
    };

    const manifest = buildReleaseEvidenceManifest(input);
    assert.equal(manifest.releaseGates.platformMatrixGreen, false);
    assert.ok(manifest.issues.includes('platform:windows:status-unavailable'));
    assert.equal(manifest.ready, false);
});

test('security and rollback approvals are independent exact-commit gates', async () => {
    const { buildReleaseEvidenceManifest } = await releaseEvidence();
    const input = greenInput();
    input.securityReview = {
        ...input.securityReview,
        approved: false,
    };
    input.rollbackPlan = {
        ...input.rollbackPlan,
        sourceCommit: OTHER,
    };

    const manifest = buildReleaseEvidenceManifest(input);
    assert.equal(manifest.releaseGates.securityReviewApproved, false);
    assert.equal(manifest.releaseGates.rollbackPlanApproved, false);
    assert.ok(manifest.issues.includes('security:not-approved'));
    assert.ok(manifest.issues.includes('rollback:commit-mismatch'));
});

test('future-dated evidence outside skew tolerance is invalid', async () => {
    const { buildReleaseEvidenceManifest, MAX_FUTURE_SKEW_MS } = await releaseEvidence();
    const input = greenInput();
    input.ci = {
        ...input.ci,
        completedAt: input.generatedAt + MAX_FUTURE_SKEW_MS + 1,
    };

    const manifest = buildReleaseEvidenceManifest(input);
    assert.equal(manifest.releaseGates.ciGreen, false);
    assert.ok(manifest.issues.includes('ci:timestamp-invalid'));
});

test('manually flipping stored gate booleans cannot forge extracted release gates', async () => {
    const { buildReleaseEvidenceManifest, extractReleaseGates } = await releaseEvidence();
    const input = greenInput();
    input.ci = { ...input.ci, status: 'failed' };
    const manifest = buildReleaseEvidenceManifest(input);

    const forged = {
        ...manifest,
        releaseGates: {
            ciGreen: true,
            platformMatrixGreen: true,
            securityReviewApproved: true,
            rollbackPlanApproved: true,
        },
    };

    const extracted = extractReleaseGates(forged);
    assert.equal(extracted.ciGreen, false);
    assert.equal(extracted.platformMatrixGreen, true);
    assert.equal(extracted.securityReviewApproved, true);
    assert.equal(extracted.rollbackPlanApproved, true);
});

test('extract rejects any manifest that tries to claim cutover authority', async () => {
    const { buildReleaseEvidenceManifest, extractReleaseGates } = await releaseEvidence();
    const manifest = buildReleaseEvidenceManifest(greenInput());

    assert.throws(
        () => extractReleaseGates({ ...manifest, cutoverAuthorized: true }),
        (error) => error.code === 'INVALID_RELEASE_EVIDENCE',
    );
    assert.throws(
        () => extractReleaseGates({ ...manifest, executionAuthority: 'compute-router' }),
        (error) => error.code === 'INVALID_RELEASE_EVIDENCE',
    );
});

test('unsupported profile and malformed source commit are rejected', async () => {
    const { buildReleaseEvidenceManifest } = await releaseEvidence();

    assert.throws(
        () => buildReleaseEvidenceManifest({
            ...greenInput(),
            profileId: 'other-profile',
        }),
        (error) => error.code === 'INVALID_RELEASE_EVIDENCE',
    );

    assert.throws(
        () => buildReleaseEvidenceManifest({
            ...greenInput(),
            sourceCommit: 'short-sha',
        }),
        (error) => error.code === 'INVALID_RELEASE_EVIDENCE',
    );
});

test('release evidence module is pure and isolated from execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/releaseEvidenceManifest.mjs', 'utf8');
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
        assert.equal(source.includes(token), false, `unexpected release evidence side effect token: ${token}`);
    }

    assert.equal(image.includes('releaseEvidenceManifest'), false);
    assert.equal(video.includes('releaseEvidenceManifest'), false);
    assert.ok(source.includes("RELEASE_EXECUTION_AUTHORITY = 'legacy-dispatcher-only'"));
    assert.ok(source.includes('cutoverAuthorized: false'));
});
