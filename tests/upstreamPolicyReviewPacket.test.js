const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const proposedPolicySource = "baselineSha: '2222222222222222222222222222222222222222'\n";
const proposedHash = sha256(proposedPolicySource);

const handoff = {
  valid: true,
  state: 'READY_FOR_HUMAN_POLICY_PR',
  fromBaselineSha: '1111111111111111111111111111111111111111',
  toBaselineSha: '2222222222222222222222222222222222222222',
  toBaselineDate: '2026-09-21',
  toBaselineMessage: 'upstream reviewed change',
  hashes: {
    previewPolicySha256: proposedHash,
  },
};

const approvalResult = {
  valid: true,
  state: 'HUMAN_APPROVAL_RECORDED',
  handoffIdentitySha256: 'a'.repeat(64),
  approver: 'human-reviewer',
  approvedAt: '2026-09-21T10:00:00.000Z',
  rationale: 'Reviewed and approved for a separate policy PR.',
};

const contentValidation = {
  valid: true,
  state: 'POLICY_PR_CONTENT_VALIDATED',
  handoffIdentitySha256: 'a'.repeat(64),
  proposedPolicySha256: proposedHash,
};

test('P1C43 builds a final human review packet without PR or merge authority', async () => {
  const mod = await import('../src/lib/upstreamPolicyReviewPacket.mjs');
  const packet = mod.buildUpstreamPolicyReviewPacket({
    handoff,
    approvalResult,
    contentValidation,
    proposedPolicySource,
  });

  assert.equal(packet.valid, true);
  assert.equal(packet.state, 'READY_FOR_HUMAN_POLICY_PR_REVIEW');
  assert.equal(packet.policyMutationAllowed, false);
  assert.equal(packet.policyPrCreationAllowed, false);
  assert.equal(packet.mergeAllowed, false);
  assert.equal(packet.requiresHumanPolicyPr, true);
  assert.equal(packet.requiresHumanMergeDecision, true);
  assert.equal(packet.reviewChecklist.length, 5);
});

test('P1C43 blocks when proposed policy changes after P1C42 validation', async () => {
  const mod = await import('../src/lib/upstreamPolicyReviewPacket.mjs');
  const packet = mod.buildUpstreamPolicyReviewPacket({
    handoff,
    approvalResult,
    contentValidation,
    proposedPolicySource: proposedPolicySource + 'tampered\n',
  });

  assert.equal(packet.valid, false);
  assert.ok(packet.errors.some((error) => error.includes('changed after P1C42')));
});

test('P1C43 blocks mismatched approval and content handoff identities', async () => {
  const mod = await import('../src/lib/upstreamPolicyReviewPacket.mjs');
  const packet = mod.buildUpstreamPolicyReviewPacket({
    handoff,
    approvalResult,
    contentValidation: { ...contentValidation, handoffIdentitySha256: 'b'.repeat(64) },
    proposedPolicySource,
  });

  assert.equal(packet.valid, false);
  assert.ok(packet.errors.some((error) => error.includes('different handoffs')));
});
