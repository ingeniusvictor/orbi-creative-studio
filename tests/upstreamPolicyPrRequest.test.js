const test = require('node:test');
const assert = require('node:assert/strict');

const reviewPacket = {
    valid: true,
    state: 'READY_FOR_HUMAN_POLICY_PR_REVIEW',
    fromBaselineSha: '1'.repeat(40),
    toBaselineSha: '2'.repeat(40),
    toBaselineDate: '2026-09-21',
    toBaselineMessage: 'reviewed upstream change',
    handoffIdentitySha256: 'a'.repeat(64),
    proposedPolicySha256: 'b'.repeat(64),
    requiresHumanPolicyPr: true,
    requiresHumanMergeDecision: true,
};

test('P1C44 builds a non-authorizing human policy PR request manifest', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrRequest.mjs');
    const request = mod.buildUpstreamPolicyPrRequest(reviewPacket);

    assert.equal(request.valid, true);
    assert.equal(request.state, 'READY_FOR_HUMAN_POLICY_PR_REQUEST');
    assert.equal(request.repository, 'ingeniusvictor/orbi-creative-studio');
    assert.equal(request.baseBranch, 'integration/orbi-foundation');
    assert.equal(request.suggestedHeadBranch, 'governance/upstream-baseline-222222222222');
    assert.deepEqual(request.allowedFiles, ['src/lib/upstreamDriftPolicy.mjs']);
    assert.deepEqual(request.requiredChangedFields, [
        'OPEN_GENERATIVE_AI_UPSTREAM.baselineSha',
        'OPEN_GENERATIVE_AI_UPSTREAM.baselineDate',
    ]);
    assert.equal(request.policyMutationAllowed, false);
    assert.equal(request.branchCreationAllowed, false);
    assert.equal(request.policyPrCreationAllowed, false);
    assert.equal(request.mergeAllowed, false);
    assert.equal(request.requiresHumanBranchCreation, true);
    assert.equal(request.requiresHumanPolicyPrCreation, true);
    assert.equal(request.requiresHumanMergeDecision, true);
});

test('P1C44 refuses an unvalidated or incomplete P1C43 packet', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrRequest.mjs');
    const request = mod.buildUpstreamPolicyPrRequest({
        ...reviewPacket,
        valid: false,
        proposedPolicySha256: 'bad',
    });

    assert.equal(request.valid, false);
    assert.equal(request.state, 'POLICY_PR_REQUEST_BLOCKED');
    assert.equal(request.policyPrCreationAllowed, false);
    assert.ok(request.errors.some((error) => error.includes('P1C43')));
    assert.ok(request.errors.some((error) => error.includes('SHA-256')));
});

test('P1C44 markdown keeps human-only boundaries explicit', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrRequest.mjs');
    const request = mod.buildUpstreamPolicyPrRequest(reviewPacket);
    const markdown = mod.formatUpstreamPolicyPrRequestMarkdown(request);

    assert.match(markdown, /Automatic branch creation: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /Automatic PR creation: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /Automatic merge: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /src\/lib\/upstreamDriftPolicy\.mjs/);
    assert.match(markdown, /baselineSha/);
    assert.match(markdown, /baselineDate/);
});
