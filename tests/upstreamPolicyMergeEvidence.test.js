const test = require('node:test');
const assert = require('node:assert/strict');

const headSha = 'c'.repeat(40);

const envelopeValidation = {
    valid: true,
    state: 'HUMAN_POLICY_PR_ENVELOPE_VALIDATED',
    repository: 'ingeniusvictor/orbi-creative-studio',
    prNumber: 999,
    handoffIdentitySha256: 'a'.repeat(64),
};

const integratedCi = {
    workflowName: 'ORBI Pull Request integrated gate',
    conclusion: 'success',
    headSha,
    runId: 12345,
};

const foundationCertification = {
    workflowName: 'ORBI Foundation integrated certification',
    conclusion: 'success',
    headSha,
    runId: 23456,
    event: 'pull_request',
    jobs: [
        { name: 'core-linux', conclusion: 'success' },
        { name: 'windows-desktop', conclusion: 'success' },
        { name: 'macos-package', conclusion: 'success' },
    ],
};

test('P1C47 builds final evidence without granting automatic merge authority', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeEvidence.mjs');
    const packet = mod.buildHumanPolicyMergeEvidence({
        envelopeValidation,
        prHeadSha: headSha,
        integratedCi,
        foundationCertification,
    });

    assert.equal(packet.valid, true);
    assert.equal(packet.state, 'READY_FOR_HUMAN_MERGE_DECISION');
    assert.equal(packet.prHeadSha, headSha);
    assert.equal(packet.integratedCiRunId, 12345);
    assert.equal(packet.foundationRunId, 23456);
    assert.equal(packet.automaticMergeAllowed, false);
    assert.equal(packet.mergeAllowed, false);
    assert.equal(packet.requiresHumanMergeDecision, true);
});

test('P1C47 blocks evidence from a different PR head', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeEvidence.mjs');
    const packet = mod.buildHumanPolicyMergeEvidence({
        envelopeValidation,
        prHeadSha: headSha,
        integratedCi: { ...integratedCi, headSha: 'd'.repeat(40) },
        foundationCertification,
    });

    assert.equal(packet.valid, false);
    assert.ok(packet.errors.some((error) => error.includes('integrated PR gate')));
});

test('P1C47 requires all three Foundation platform jobs green', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeEvidence.mjs');
    const packet = mod.buildHumanPolicyMergeEvidence({
        envelopeValidation,
        prHeadSha: headSha,
        integratedCi,
        foundationCertification: {
            ...foundationCertification,
            jobs: [
                { name: 'core-linux', conclusion: 'success' },
                { name: 'windows-desktop', conclusion: 'failure' },
                { name: 'macos-package', conclusion: 'success' },
            ],
        },
    });

    assert.equal(packet.valid, false);
    assert.ok(packet.errors.some((error) => error.includes('windows-desktop')));
});

test('P1C47 rejects post-merge Foundation evidence', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeEvidence.mjs');
    const packet = mod.buildHumanPolicyMergeEvidence({
        envelopeValidation,
        prHeadSha: headSha,
        integratedCi,
        foundationCertification: {
            ...foundationCertification,
            event: 'push',
        },
    });

    assert.equal(packet.valid, false);
    assert.ok(packet.errors.some((error) => error.includes('pre-merge')));
});

test('P1C47 markdown makes the final human boundary explicit', async () => {
    const mod = await import('../src/lib/upstreamPolicyMergeEvidence.mjs');
    const packet = mod.buildHumanPolicyMergeEvidence({
        envelopeValidation,
        prHeadSha: headSha,
        integratedCi,
        foundationCertification,
    });
    const markdown = mod.formatHumanPolicyMergeEvidenceMarkdown(packet);

    assert.match(markdown, /READY_FOR_HUMAN_MERGE_DECISION/);
    assert.match(markdown, /Automatic merge: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /Human merge decision: \*\*REQUIRED\*\*/);
    assert.match(markdown, /core-linux: \*\*success\*\*/);
});
