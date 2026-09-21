const test = require('node:test');
const assert = require('node:assert/strict');

const proposal = {
  valid: true,
  state: 'READY_FOR_HUMAN_APPROVAL',
  fromBaselineSha: '1111111111111111111111111111111111111111',
  toBaselineSha: '2222222222222222222222222222222222222222',
  toBaselineDate: '2026-09-21',
  decisionCounts: { ADOPT: 1, ADAPT: 0, REJECT: 0 },
  implementationCommits: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
};
const plan = {
  valid: true,
  state: 'DRY_RUN_READY',
  sourceMutationAllowed: false,
  fromBaselineSha: proposal.fromBaselineSha,
  toBaselineSha: proposal.toBaselineSha,
};
const currentPolicySource = "baselineSha: '1111111111111111111111111111111111111111'\n";
const previewPolicySource = "baselineSha: '2222222222222222222222222222222222222222'\n";

test('P1C40 builds a non-mutating integrity-bound handoff package', async () => {
  const { buildUpstreamPolicyHandoffPackage } = await import('../src/lib/upstreamPolicyHandoff.mjs');
  const bundle = buildUpstreamPolicyHandoffPackage({ proposal, plan, currentPolicySource, previewPolicySource });
  assert.equal(bundle.valid, true);
  assert.equal(bundle.state, 'READY_FOR_HUMAN_POLICY_PR');
  assert.equal(bundle.sourceMutationAllowed, false);
  assert.equal(bundle.policyPrAuthorized, false);
  assert.equal(bundle.requiresHumanApproval, true);
  assert.match(bundle.hashes.currentPolicySha256, /^[0-9a-f]{64}$/);
  assert.match(bundle.hashes.previewPolicySha256, /^[0-9a-f]{64}$/);
  assert.equal(bundle.approvalChecklist.length, 5);
});

test('P1C40 blocks mismatched proposal and dry-run baselines', async () => {
  const { buildUpstreamPolicyHandoffPackage } = await import('../src/lib/upstreamPolicyHandoff.mjs');
  const bundle = buildUpstreamPolicyHandoffPackage({
    proposal,
    plan: { ...plan, toBaselineSha: '3333333333333333333333333333333333333333' },
    currentPolicySource,
    previewPolicySource,
  });
  assert.equal(bundle.valid, false);
  assert.equal(bundle.state, 'BLOCKED');
  assert.ok(bundle.errors.some((error) => error.includes('target baselines differ')));
});

test('P1C40 markdown explicitly forbids mutation and requires human approval', async () => {
  const { buildUpstreamPolicyHandoffPackage, formatUpstreamPolicyHandoffMarkdown } = await import('../src/lib/upstreamPolicyHandoff.mjs');
  const bundle = buildUpstreamPolicyHandoffPackage({ proposal, plan, currentPolicySource, previewPolicySource });
  const markdown = formatUpstreamPolicyHandoffMarkdown(bundle);
  assert.match(markdown, /Source mutation: \*\*FORBIDDEN\*\*/);
  assert.match(markdown, /HUMAN APPROVAL REQUIRED/);
  assert.match(markdown, /Current policy SHA-256/);
});
