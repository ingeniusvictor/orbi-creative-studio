const test = require('node:test');
const assert = require('node:assert/strict');

const handoff = {
  schemaVersion: 1,
  valid: true,
  state: 'READY_FOR_HUMAN_POLICY_PR',
  fromBaselineSha: '1111111111111111111111111111111111111111',
  toBaselineSha: '2222222222222222222222222222222222222222',
  toBaselineDate: '2026-09-21',
  hashes: {
    currentPolicySha256: 'a'.repeat(64),
    previewPolicySha256: 'b'.repeat(64),
    proposalSha256: 'c'.repeat(64),
    dryRunPlanSha256: 'd'.repeat(64),
  },
};

test('P1C41 creates a non-authorizing approval template bound to P1C40', async () => {
  const mod = await import('../src/lib/upstreamPolicyApproval.mjs');
  const template = mod.buildUpstreamPolicyApprovalTemplate(handoff);
  assert.match(template.handoffIdentitySha256, /^[0-9a-f]{64}$/);
  assert.equal(template.decision, null);
  assert.equal(template.policyMutationAllowed, false);
  assert.equal(template.policyPrCreationAllowed, false);
});

test('P1C41 validates an explicit human approval without granting mutation authority', async () => {
  const mod = await import('../src/lib/upstreamPolicyApproval.mjs');
  const identity = mod.computeUpstreamPolicyHandoffIdentity(handoff);
  const result = mod.evaluateUpstreamPolicyApproval(handoff, {
    handoffIdentitySha256: identity,
    fromBaselineSha: handoff.fromBaselineSha,
    toBaselineSha: handoff.toBaselineSha,
    decision: 'APPROVE_POLICY_PR',
    approver: 'human-reviewer',
    approvedAt: '2026-09-21T10:00:00Z',
    rationale: 'Reviewed the handoff and approve creation of a separate policy PR.',
  });
  assert.equal(result.valid, true);
  assert.equal(result.state, 'HUMAN_APPROVAL_RECORDED');
  assert.equal(result.policyMutationAllowed, false);
  assert.equal(result.policyPrCreationAllowed, false);
  assert.equal(result.requiresSeparatePolicyPr, true);
});

test('P1C41 rejects approval copied to a different handoff', async () => {
  const mod = await import('../src/lib/upstreamPolicyApproval.mjs');
  const identity = mod.computeUpstreamPolicyHandoffIdentity(handoff);
  const altered = { ...handoff, toBaselineSha: '3333333333333333333333333333333333333333' };
  const result = mod.evaluateUpstreamPolicyApproval(altered, {
    handoffIdentitySha256: identity,
    fromBaselineSha: altered.fromBaselineSha,
    toBaselineSha: altered.toBaselineSha,
    decision: 'APPROVE_POLICY_PR',
    approver: 'human-reviewer',
    approvedAt: '2026-09-21T10:00:00Z',
    rationale: 'Copied approval.',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('identity')));
});
