const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const policySource = "export const baselineSha = '2'.repeat(40);\n";
const policyHash = crypto.createHash('sha256').update(policySource, 'utf8').digest('hex');

const request = {
    valid: true,
    state: 'READY_FOR_HUMAN_POLICY_PR_REQUEST',
    repository: 'ingeniusvictor/orbi-creative-studio',
    baseBranch: 'integration/orbi-foundation',
    suggestedHeadBranch: 'governance/upstream-baseline-222222222222',
    title: 'governance(upstream): advance reviewed baseline to 222222222222',
    allowedFiles: ['src/lib/upstreamDriftPolicy.mjs'],
    expectedProposedPolicySha256: policyHash,
    handoffIdentitySha256: 'a'.repeat(64),
};

const pullRequest = {
    repository: 'ingeniusvictor/orbi-creative-studio',
    number: 900,
    state: 'open',
    draft: false,
    baseBranch: 'integration/orbi-foundation',
    headBranch: 'governance/upstream-baseline-222222222222',
    title: 'governance(upstream): advance reviewed baseline to 222222222222',
};

test('P1C45 validates the exact human policy PR envelope without merge authority', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrEnvelope.mjs');
    const result = mod.validateHumanPolicyPrEnvelope({
        request,
        pullRequest,
        changedFiles: ['src/lib/upstreamDriftPolicy.mjs'],
        proposedPolicySource: policySource,
    });

    assert.equal(result.valid, true);
    assert.equal(result.state, 'HUMAN_POLICY_PR_ENVELOPE_VALIDATED');
    assert.equal(result.mergeAllowed, false);
    assert.equal(result.requiresCiSuccess, true);
    assert.equal(result.requiresFoundationCertification, true);
    assert.equal(result.requiresHumanMergeDecision, true);
    assert.equal(result.observedProposedPolicySha256, policyHash);
});

test('P1C45 blocks extra files and altered policy bytes', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrEnvelope.mjs');
    const result = mod.validateHumanPolicyPrEnvelope({
        request,
        pullRequest,
        changedFiles: [
            'src/lib/upstreamDriftPolicy.mjs',
            'electron/main.js',
        ],
        proposedPolicySource: policySource + '// changed\n',
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('changed file set')));
    assert.ok(result.errors.some((error) => error.includes('SHA-256')));
    assert.equal(result.mergeAllowed, false);
});

test('P1C45 blocks wrong branch/title/repository or draft state', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrEnvelope.mjs');
    const result = mod.validateHumanPolicyPrEnvelope({
        request,
        pullRequest: {
            ...pullRequest,
            repository: 'other/repo',
            baseBranch: 'main',
            headBranch: 'feature/unsafe',
            title: 'different title',
            draft: true,
        },
        changedFiles: ['src/lib/upstreamDriftPolicy.mjs'],
        proposedPolicySource: policySource,
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('repository')));
    assert.ok(result.errors.some((error) => error.includes('base branch')));
    assert.ok(result.errors.some((error) => error.includes('head branch')));
    assert.ok(result.errors.some((error) => error.includes('title')));
    assert.ok(result.errors.some((error) => error.includes('draft')));
});

test('P1C45 markdown preserves the final human merge boundary', async () => {
    const mod = await import('../src/lib/upstreamPolicyPrEnvelope.mjs');
    const result = mod.validateHumanPolicyPrEnvelope({
        request,
        pullRequest,
        changedFiles: ['src/lib/upstreamDriftPolicy.mjs'],
        proposedPolicySource: policySource,
    });
    const markdown = mod.formatHumanPolicyPrEnvelopeMarkdown(result);

    assert.match(markdown, /Automatic merge: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /Foundation certification: \*\*REQUIRED\*\*/);
    assert.match(markdown, /Separate human merge decision: \*\*REQUIRED\*\*/);
});
