const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const currentPolicySource = "baselineSha: '1111111111111111111111111111111111111111'\n";
const proposedPolicySource = "baselineSha: '2222222222222222222222222222222222222222'\n";

const handoff = {
  schemaVersion: 1,
  valid: true,
  state: 'READY_FOR_HUMAN_POLICY_PR',
  fromBaselineSha: '1111111111111111111111111111111111111111',
  toBaselineSha: '2222222222222222222222222222222222222222',
  toBaselineDate: '2026-09-21',
  hashes: {
    currentPolicySha256: sha256(currentPolicySource),
    previewPolicySha256: sha256(proposedPolicySource),
    proposalSha256: 'c'.repeat(64),
    dryRunPlanSha256: 'd'.repeat(64),
  },
};

test('P1C42 validates proposed policy bytes against the approved P1C40 preview', async () => {
  const approval = await import('../src/lib/upstreamPolicyApproval.mjs');
  const validator = await import('../src/lib/upstreamPolicyPrContent.mjs');
  const approvalResult = {
    valid: true,
    state: 'HUMAN_APPROVAL_RECORDED',
    handoffIdentitySha256: approval.computeUpstreamPolicyHandoffIdentity(handoff),
  };

  const result = validator.validateUpstreamPolicyPrContent({
    handoff,
    approvalResult,
    currentPolicySource,
    proposedPolicySource,
  });

  assert.equal(result.valid, true);
  assert.equal(result.state, 'POLICY_PR_CONTENT_VALIDATED');
  assert.equal(result.policyMutationAllowed, false);
  assert.equal(result.policyPrCreationAllowed, false);
  assert.equal(result.mergeAllowed, false);
});

test('P1C42 rejects proposed bytes different from the approved preview', async () => {
  const approval = await import('../src/lib/upstreamPolicyApproval.mjs');
  const validator = await import('../src/lib/upstreamPolicyPrContent.mjs');
  const approvalResult = {
    valid: true,
    state: 'HUMAN_APPROVAL_RECORDED',
    handoffIdentitySha256: approval.computeUpstreamPolicyHandoffIdentity(handoff),
  };

  const result = validator.validateUpstreamPolicyPrContent({
    handoff,
    approvalResult,
    currentPolicySource,
    proposedPolicySource: proposedPolicySource + 'tampered\n',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('approved preview')));
});

test('P1C42 rejects approval records for another handoff', async () => {
  const validator = await import('../src/lib/upstreamPolicyPrContent.mjs');
  const result = validator.validateUpstreamPolicyPrContent({
    handoff,
    approvalResult: {
      valid: true,
      state: 'HUMAN_APPROVAL_RECORDED',
      handoffIdentitySha256: 'f'.repeat(64),
    },
    currentPolicySource,
    proposedPolicySource,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('approval does not match')));
});
