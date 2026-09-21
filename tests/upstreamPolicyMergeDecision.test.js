const test = require('node:test');
const assert = require('node:assert/strict');

const evidencePacket = {
    schemaVersion: 1,
    valid: true,
    state: 'READY_FOR_HUMAN_MERGE_DECISION',
    repository: 'ingeniusvictor/orbi-creative-studio',
    prNumber: 999,
    prHeadSha: 'c'.repeat(40),
    handoffIdentitySha256: 'a'.repeat(64),
    integratedCiRunId: 12345,
    foundationRunId: 23456,
    foundationJobs: [
        { name: 'core-linux', conclusion: 'success' },
        { name: 'windows-desktop', conclusion: 'success' },
        { name: 'macos-package', conclusion: 'success' },
    ],
};

test('P1C48 creates a blank decision template bound to P1C47 evidence', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeDecision.mjs');
    const template = mod.buildHumanPolicyMergeDecisionTemplate(evidencePacket);

    assert.match(template.evidenceIdentitySha256, /^[0-9a-f]{64}$/);
    assert.equal(template.repository, evidencePacket.repository);
    assert.equal(template.prNumber, evidencePacket.prNumber);
    assert.equal(template.prHeadSha, evidencePacket.prHeadSha);
    assert.equal(template.decision, null);
    assert.equal(template.automaticMergeAllowed, false);
    assert.equal(template.mergeExecutionAllowed, false);
});

test('P1C48 records explicit human approval without executing merge', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeDecision.mjs');
    const template = mod.buildHumanPolicyMergeDecisionTemplate(evidencePacket);

    const result = mod.evaluateHumanPolicyMergeDecision(evidencePacket, {
        ...template,
        decision: 'APPROVE_MERGE',
        reviewer: 'human-reviewer',
        decidedAt: '2026-09-21T10:40:00.000Z',
        rationale: 'Reviewed the exact PR envelope and bound CI evidence.',
    });

    assert.equal(result.valid, true);
    assert.equal(result.state, 'HUMAN_MERGE_APPROVAL_RECORDED');
    assert.equal(result.approved, true);
    assert.equal(result.rejected, false);
    assert.equal(result.automaticMergeAllowed, false);
    assert.equal(result.mergeExecutionAllowed, false);
    assert.equal(result.requiresSeparateRepositoryMergeAction, true);
    assert.equal(result.mergeMustRemainUnperformed, true);
});

test('P1C48 records an explicit rejection and does not authorize a merge action', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeDecision.mjs');
    const template = mod.buildHumanPolicyMergeDecisionTemplate(evidencePacket);

    const result = mod.evaluateHumanPolicyMergeDecision(evidencePacket, {
        ...template,
        decision: 'REJECT_MERGE',
        reviewer: 'human-reviewer',
        decidedAt: '2026-09-21T10:40:00.000Z',
        rationale: 'Policy advancement is not accepted.',
    });

    assert.equal(result.valid, true);
    assert.equal(result.state, 'HUMAN_MERGE_REJECTION_RECORDED');
    assert.equal(result.approved, false);
    assert.equal(result.rejected, true);
    assert.equal(result.requiresSeparateRepositoryMergeAction, false);
    assert.equal(result.mergeExecutionAllowed, false);
});

test('P1C48 blocks stale evidence identity or wrong PR head', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeDecision.mjs');
    const template = mod.buildHumanPolicyMergeDecisionTemplate(evidencePacket);

    const result = mod.evaluateHumanPolicyMergeDecision(evidencePacket, {
        ...template,
        evidenceIdentitySha256: 'b'.repeat(64),
        prHeadSha: 'd'.repeat(40),
        decision: 'APPROVE_MERGE',
        reviewer: 'human-reviewer',
        decidedAt: '2026-09-21T10:40:00.000Z',
        rationale: 'Attempted stale approval.',
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('identity')));
    assert.ok(result.errors.some((error) => error.includes('head SHA')));
    assert.equal(result.mergeExecutionAllowed, false);
});

test('P1C48 requires explicit reviewer, timestamp, rationale and decision', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeDecision.mjs');
    const template = mod.buildHumanPolicyMergeDecisionTemplate(evidencePacket);

    const result = mod.evaluateHumanPolicyMergeDecision(evidencePacket, template);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes('decision must')));
    assert.ok(result.errors.some((error) => error.includes('reviewer')));
    assert.ok(result.errors.some((error) => error.includes('rationale')));
    assert.ok(result.errors.some((error) => error.includes('decidedAt')));
});

test('P1C48 markdown preserves the separate-action boundary', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeDecision.mjs');
    const template = mod.buildHumanPolicyMergeDecisionTemplate(evidencePacket);
    const result = mod.evaluateHumanPolicyMergeDecision(evidencePacket, {
        ...template,
        decision: 'APPROVE_MERGE',
        reviewer: 'human-reviewer',
        decidedAt: '2026-09-21T10:40:00.000Z',
        rationale: 'Approved after human review.',
    });

    const markdown = mod.formatHumanPolicyMergeDecisionMarkdown(result);
    assert.match(markdown, /Automatic merge: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /Merge execution in this phase: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /Separate repository merge action: \*\*REQUIRED\*\*/);
});
