const test = require('node:test');
const assert = require('node:assert/strict');

test('P1C38 creates an auditable non-mutating baseline advancement proposal', async () => {
    const {
        buildUpstreamBaselineAdvanceProposal,
        validateUpstreamBaselineAdvanceProposal,
    } = await import('../src/lib/upstreamBaselineAdvanceProposal.mjs');

    const proposal = buildUpstreamBaselineAdvanceProposal({
        driftReport: {
            upstream: { repository: 'Anil-matcha/Open-Generative-AI', branch: 'main' },
            observedAt: '2026-09-21T03:30:00Z',
            baselineSha: '1111111111111111111111111111111111111111',
            headSha: '2222222222222222222222222222222222222222',
            headDate: '2026-09-21T03:00:00Z',
            headMessage: 'feat: add model',
            hasDrift: true,
        },
        adoptionManifest: {
            baselineSha: '1111111111111111111111111111111111111111',
            headSha: '2222222222222222222222222222222222222222',
            entries: [{ path: 'a' }, { path: 'b' }, { path: 'c' }],
        },
        reviewResult: {
            valid: true,
            baselineAdvanceEligible: true,
            resolved: [
                {
                    path: 'a',
                    decision: 'ADOPT',
                    implementation: { status: 'VERIFIED', orbiCommitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
                },
                {
                    path: 'b',
                    decision: 'ADAPT',
                    implementation: { status: 'VERIFIED', orbiCommitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
                },
                {
                    path: 'c',
                    decision: 'REJECT',
                    implementation: { status: 'NOT_APPLICABLE', orbiCommitSha: null },
                },
            ],
        },
    });

    assert.equal(proposal.valid, true);
    assert.equal(proposal.state, 'READY_FOR_HUMAN_APPROVAL');
    assert.equal(proposal.policyMutationAllowed, false);
    assert.equal(proposal.requiresHumanApproval, true);
    assert.equal(proposal.requiresSeparatePolicyPr, true);
    assert.deepEqual(proposal.decisionCounts, { ADOPT: 1, ADAPT: 1, REJECT: 1 });
    assert.deepEqual(proposal.implementationCommits, [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ]);
    assert.deepEqual(validateUpstreamBaselineAdvanceProposal(proposal), { valid: true, errors: [] });
});

test('P1C38 blocks proposal creation when review is incomplete', async () => {
    const { buildUpstreamBaselineAdvanceProposal } = await import('../src/lib/upstreamBaselineAdvanceProposal.mjs');

    const proposal = buildUpstreamBaselineAdvanceProposal({
        driftReport: {
            baselineSha: 'base',
            headSha: 'head',
            hasDrift: true,
        },
        adoptionManifest: {
            baselineSha: 'base',
            headSha: 'head',
            entries: [{ path: 'a' }],
        },
        reviewResult: {
            valid: false,
            baselineAdvanceEligible: false,
            resolved: [],
        },
    });

    assert.equal(proposal.valid, false);
    assert.equal(proposal.state, 'BLOCKED');
    assert.equal(proposal.baselineAdvanceEligible, false);
    assert.equal(proposal.policyMutationAllowed, false);
    assert.ok(proposal.errors.some((error) => error.includes('review result is not valid')));
});

test('P1C38 refuses no-op baseline advancement', async () => {
    const { buildUpstreamBaselineAdvanceProposal } = await import('../src/lib/upstreamBaselineAdvanceProposal.mjs');

    const proposal = buildUpstreamBaselineAdvanceProposal({
        driftReport: {
            baselineSha: 'same',
            headSha: 'same',
            hasDrift: false,
        },
        adoptionManifest: {
            baselineSha: 'same',
            headSha: 'same',
            entries: [],
        },
        reviewResult: {
            valid: true,
            baselineAdvanceEligible: true,
            resolved: [],
        },
    });

    assert.equal(proposal.valid, false);
    assert.ok(proposal.errors.includes('baseline already equals upstream head'));
    assert.ok(proposal.errors.includes('drift report does not contain drift'));
});
