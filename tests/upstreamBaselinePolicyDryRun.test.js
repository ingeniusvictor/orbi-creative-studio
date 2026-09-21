const test = require('node:test');
const assert = require('node:assert/strict');

const SOURCE = `export const OPEN_GENERATIVE_AI_UPSTREAM = Object.freeze({
    repository: 'Anil-matcha/Open-Generative-AI',
    branch: 'main',
    baselineSha: '1111111111111111111111111111111111111111',
    baselineDate: '2026-09-19',
    license: 'MIT',
});

export const KEEP = 'unchanged';
`;

function proposal() {
    return {
        valid: true,
        state: 'READY_FOR_HUMAN_APPROVAL',
        baselineAdvanceEligible: true,
        policyMutationAllowed: false,
        requiresHumanApproval: true,
        requiresSeparatePolicyPr: true,
        fromBaselineSha: '1111111111111111111111111111111111111111',
        toBaselineSha: '2222222222222222222222222222222222222222',
        toBaselineDate: '2026-09-21T03:00:00Z',
    };
}

test('P1C39 builds a policy-only dry-run plan from an approved proposal', async () => {
    const {
        buildUpstreamBaselinePolicyUpdatePlan,
        inspectUpstreamBaselinePolicySource,
    } = await import('../src/lib/upstreamBaselinePolicyDryRun.mjs');

    const current = inspectUpstreamBaselinePolicySource(SOURCE);
    const plan = buildUpstreamBaselinePolicyUpdatePlan(proposal(), current);

    assert.equal(plan.valid, true);
    assert.equal(plan.state, 'DRY_RUN_READY');
    assert.equal(plan.sourceMutationAllowed, false);
    assert.deepEqual(plan.mutations, [
        {
            field: 'baselineSha',
            from: '1111111111111111111111111111111111111111',
            to: '2222222222222222222222222222222222222222',
        },
        {
            field: 'baselineDate',
            from: '2026-09-19',
            to: '2026-09-21',
        },
    ]);
});

test('P1C39 dry run changes only baselineSha and baselineDate in preview source', async () => {
    const {
        applyUpstreamBaselinePolicyDryRun,
        buildUpstreamBaselinePolicyUpdatePlan,
        inspectUpstreamBaselinePolicySource,
    } = await import('../src/lib/upstreamBaselinePolicyDryRun.mjs');

    const plan = buildUpstreamBaselinePolicyUpdatePlan(
        proposal(),
        inspectUpstreamBaselinePolicySource(SOURCE),
    );
    const result = applyUpstreamBaselinePolicyDryRun(SOURCE, plan);

    assert.equal(result.valid, true);
    assert.equal(result.state, 'DRY_RUN_COMPLETE');
    assert.equal(result.sourceMutationAllowed, false);
    assert.match(result.previewSource, /baselineSha: '2222222222222222222222222222222222222222'/);
    assert.match(result.previewSource, /baselineDate: '2026-09-21'/);
    assert.match(result.previewSource, /export const KEEP = 'unchanged';/);
    assert.equal(SOURCE.includes('2222222222222222222222222222222222222222'), false);
});

test('P1C39 blocks stale proposals whose source baseline no longer matches policy', async () => {
    const {
        buildUpstreamBaselinePolicyUpdatePlan,
        inspectUpstreamBaselinePolicySource,
    } = await import('../src/lib/upstreamBaselinePolicyDryRun.mjs');

    const stale = { ...proposal(), fromBaselineSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    const plan = buildUpstreamBaselinePolicyUpdatePlan(
        stale,
        inspectUpstreamBaselinePolicySource(SOURCE),
    );

    assert.equal(plan.valid, false);
    assert.equal(plan.state, 'BLOCKED');
    assert.ok(plan.errors.some((error) => error.includes('current policy baseline SHA')));
});

test('P1C39 rejects ambiguous policy source declarations', async () => {
    const { inspectUpstreamBaselinePolicySource } = await import('../src/lib/upstreamBaselinePolicyDryRun.mjs');

    assert.throws(
        () => inspectUpstreamBaselinePolicySource(`${SOURCE}\nbaselineSha: '3333333333333333333333333333333333333333'\n`),
        /exactly one baselineSha/,
    );
});
