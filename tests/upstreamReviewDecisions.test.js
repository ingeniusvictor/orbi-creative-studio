const test = require('node:test');
const assert = require('node:assert/strict');

function manifestFixture() {
    return {
        baselineSha: 'base',
        headSha: 'head',
        entries: [
            {
                path: 'packages/studio/src/klingModels.js',
                authorityClass: 'UPSTREAM_CANDIDATE',
                triageKind: 'NEW_MODEL',
                directAdoptionCandidate: true,
                requiredReviews: ['TECHNICAL', 'LICENSE', 'PRODUCT'],
            },
            {
                path: 'electron/main.js',
                authorityClass: 'ORBI_OWNED',
                triageKind: 'ORBI_CONFLICT',
                directAdoptionCandidate: false,
                requiredReviews: ['TECHNICAL'],
            },
        ],
    };
}

test('P1C37 generates a non-authorizing pending decision template', async () => {
    const { buildUpstreamReviewDecisionTemplate } = await import('../src/lib/upstreamReviewDecisions.mjs');
    const template = buildUpstreamReviewDecisionTemplate(manifestFixture());

    assert.equal(template.state, 'AWAITING_DECISIONS');
    assert.equal(template.sourceMutationAllowed, false);
    assert.equal(template.baselineAdvanceAuthorized, false);
    assert.equal(template.decisions.length, 2);
    assert.equal(template.decisions[0].decision, null);
    assert.equal(template.decisions[0].reviews.LICENSE, 'PENDING');
});

test('P1C37 allows baseline eligibility only after complete reviewed decisions', async () => {
    const { evaluateUpstreamReviewDecisions } = await import('../src/lib/upstreamReviewDecisions.mjs');

    const result = evaluateUpstreamReviewDecisions(manifestFixture(), {
        baselineSha: 'base',
        headSha: 'head',
        decisions: [
            {
                path: 'packages/studio/src/klingModels.js',
                decision: 'ADOPT',
                rationale: 'Reviewed model metadata and license; selected for ORBI.',
                reviews: { TECHNICAL: 'APPROVED', LICENSE: 'APPROVED', PRODUCT: 'APPROVED' },
                implementation: {
                    status: 'VERIFIED',
                    orbiCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                },
            },
            {
                path: 'electron/main.js',
                decision: 'ADAPT',
                rationale: 'Useful upstream behavior was manually adapted behind ORBI trust boundaries.',
                reviews: { TECHNICAL: 'APPROVED' },
                implementation: {
                    status: 'VERIFIED',
                    orbiCommitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                },
            },
        ],
    });

    assert.equal(result.valid, true);
    assert.equal(result.baselineAdvanceEligible, true);
    assert.equal(result.state, 'REVIEW_COMPLETE');
    assert.equal(result.sourceMutationAllowed, false);
});

test('P1C37 rejects direct adoption of ORBI-owned code and incomplete reviews', async () => {
    const { evaluateUpstreamReviewDecisions } = await import('../src/lib/upstreamReviewDecisions.mjs');

    const result = evaluateUpstreamReviewDecisions(manifestFixture(), {
        baselineSha: 'base',
        headSha: 'head',
        decisions: [
            {
                path: 'packages/studio/src/klingModels.js',
                decision: 'ADOPT',
                rationale: 'Candidate.',
                reviews: { TECHNICAL: 'APPROVED', LICENSE: 'PENDING', PRODUCT: 'APPROVED' },
                implementation: { status: 'VERIFIED', orbiCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
            },
            {
                path: 'electron/main.js',
                decision: 'ADOPT',
                rationale: 'Do not permit this.',
                reviews: { TECHNICAL: 'APPROVED' },
                implementation: { status: 'VERIFIED', orbiCommitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
            },
        ],
    });

    assert.equal(result.valid, false);
    assert.equal(result.baselineAdvanceEligible, false);
    assert.ok(result.errors.some((error) => error.includes('LICENSE review is not approved')));
    assert.ok(result.errors.some((error) => error.includes('direct ADOPT is not permitted')));
});

test('P1C37 accepts a reviewed rejection without implementation mutation', async () => {
    const { evaluateUpstreamReviewDecisions } = await import('../src/lib/upstreamReviewDecisions.mjs');

    const manifest = {
        baselineSha: 'base',
        headSha: 'head',
        entries: [{
            path: 'README.md',
            directAdoptionCandidate: false,
            requiredReviews: ['TECHNICAL'],
        }],
    };

    const result = evaluateUpstreamReviewDecisions(manifest, {
        baselineSha: 'base',
        headSha: 'head',
        decisions: [{
            path: 'README.md',
            decision: 'REJECT',
            rationale: 'Documentation change is not relevant to ORBI.',
            reviews: { TECHNICAL: 'APPROVED' },
            implementation: { status: 'NOT_APPLICABLE', orbiCommitSha: null },
        }],
    });

    assert.equal(result.valid, true);
    assert.equal(result.baselineAdvanceEligible, true);
});
