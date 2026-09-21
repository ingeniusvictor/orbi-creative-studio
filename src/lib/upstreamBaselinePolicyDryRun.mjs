const SHA40 = /^[0-9a-f]{40}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function singleMatch(source, expression, label) {
    const matches = [...source.matchAll(expression)];
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${label} declaration, found ${matches.length}`);
    }
    return matches[0][1];
}

export function inspectUpstreamBaselinePolicySource(sourceText) {
    if (typeof sourceText !== 'string' || !sourceText) {
        throw new TypeError('Policy source text is required');
    }

    return Object.freeze({
        baselineSha: singleMatch(sourceText, /baselineSha:\s*'([0-9a-f]{40})'/gi, 'baselineSha'),
        baselineDate: singleMatch(sourceText, /baselineDate:\s*'(\d{4}-\d{2}-\d{2})'/g, 'baselineDate'),
    });
}

function normalizeProposalDate(value) {
    if (typeof value !== 'string' || value.length < 10) return null;
    const date = value.slice(0, 10);
    return DATE.test(date) ? date : null;
}

export function buildUpstreamBaselinePolicyUpdatePlan(proposal, currentPolicy) {
    const errors = [];

    if (!proposal || typeof proposal !== 'object') {
        return Object.freeze({ valid: false, state: 'BLOCKED', sourceMutationAllowed: false, errors: Object.freeze(['proposal is required']) });
    }
    if (!currentPolicy || typeof currentPolicy !== 'object') {
        return Object.freeze({ valid: false, state: 'BLOCKED', sourceMutationAllowed: false, errors: Object.freeze(['current policy identity is required']) });
    }

    if (proposal.valid !== true) errors.push('baseline proposal is not valid');
    if (proposal.state !== 'READY_FOR_HUMAN_APPROVAL') errors.push('baseline proposal is not ready for human approval');
    if (proposal.baselineAdvanceEligible !== true) errors.push('baseline proposal is not baseline-advance eligible');
    if (proposal.policyMutationAllowed !== false) errors.push('proposal unexpectedly authorizes policy mutation');
    if (proposal.requiresHumanApproval !== true) errors.push('proposal must require human approval');
    if (proposal.requiresSeparatePolicyPr !== true) errors.push('proposal must require a separate policy PR');

    if (!SHA40.test(proposal.fromBaselineSha || '')) errors.push('proposal fromBaselineSha is invalid');
    if (!SHA40.test(proposal.toBaselineSha || '')) errors.push('proposal toBaselineSha is invalid');
    if (proposal.fromBaselineSha === proposal.toBaselineSha) errors.push('proposal baseline SHAs must differ');

    if (currentPolicy.baselineSha !== proposal.fromBaselineSha) {
        errors.push('current policy baseline SHA does not match proposal source baseline');
    }
    if (!DATE.test(currentPolicy.baselineDate || '')) {
        errors.push('current policy baseline date is invalid');
    }

    const toBaselineDate = normalizeProposalDate(proposal.toBaselineDate);
    if (!toBaselineDate) errors.push('proposal upstream baseline date is required');

    if (errors.length > 0) {
        return Object.freeze({
            valid: false,
            state: 'BLOCKED',
            sourceMutationAllowed: false,
            requiresHumanApproval: true,
            errors: Object.freeze(errors),
        });
    }

    return Object.freeze({
        schemaVersion: 1,
        valid: true,
        state: 'DRY_RUN_READY',
        sourceMutationAllowed: false,
        requiresHumanApproval: true,
        requiresSeparatePolicyPr: true,
        policyPath: 'src/lib/upstreamDriftPolicy.mjs',
        from: Object.freeze({
            baselineSha: currentPolicy.baselineSha,
            baselineDate: currentPolicy.baselineDate,
        }),
        to: Object.freeze({
            baselineSha: proposal.toBaselineSha,
            baselineDate: toBaselineDate,
        }),
        mutations: Object.freeze([
            Object.freeze({ field: 'baselineSha', from: currentPolicy.baselineSha, to: proposal.toBaselineSha }),
            Object.freeze({ field: 'baselineDate', from: currentPolicy.baselineDate, to: toBaselineDate }),
        ]),
        errors: Object.freeze([]),
    });
}

export function applyUpstreamBaselinePolicyDryRun(sourceText, plan) {
    if (!plan?.valid || plan.state !== 'DRY_RUN_READY') {
        throw new Error('A valid DRY_RUN_READY plan is required');
    }
    if (plan.sourceMutationAllowed !== false) {
        throw new Error('Dry-run plan cannot authorize source mutation');
    }

    const current = inspectUpstreamBaselinePolicySource(sourceText);
    if (current.baselineSha !== plan.from.baselineSha || current.baselineDate !== plan.from.baselineDate) {
        throw new Error('Policy source changed after the dry-run plan was created');
    }

    const shaToken = `baselineSha: '${plan.from.baselineSha}'`;
    const dateToken = `baselineDate: '${plan.from.baselineDate}'`;
    if (sourceText.split(shaToken).length !== 2) throw new Error('baselineSha token is not unique');
    if (sourceText.split(dateToken).length !== 2) throw new Error('baselineDate token is not unique');

    const previewSource = sourceText
        .replace(shaToken, `baselineSha: '${plan.to.baselineSha}'`)
        .replace(dateToken, `baselineDate: '${plan.to.baselineDate}'`);

    const previewIdentity = inspectUpstreamBaselinePolicySource(previewSource);
    if (previewIdentity.baselineSha !== plan.to.baselineSha || previewIdentity.baselineDate !== plan.to.baselineDate) {
        throw new Error('Dry-run preview identity does not match the plan');
    }

    const reversed = previewSource
        .replace(`baselineSha: '${plan.to.baselineSha}'`, shaToken)
        .replace(`baselineDate: '${plan.to.baselineDate}'`, dateToken);
    if (reversed !== sourceText) {
        throw new Error('Dry-run preview changed source outside the governed baseline fields');
    }

    return Object.freeze({
        valid: true,
        state: 'DRY_RUN_COMPLETE',
        sourceMutationAllowed: false,
        policyPath: plan.policyPath,
        from: plan.from,
        to: plan.to,
        previewSource,
    });
}

export function formatUpstreamBaselinePolicyDryRunMarkdown(plan, result = null) {
    const lines = [
        '# ORBI Upstream Baseline Policy Dry Run',
        '',
        `- State: **${result?.state || plan?.state || 'BLOCKED'}**`,
        '- Source mutation: **FORBIDDEN**',
        '- Human approval before real policy PR: **REQUIRED**',
    ];

    if (!plan?.valid) {
        lines.push('', '## Blocking reasons', '');
        for (const error of plan?.errors || ['invalid plan']) lines.push(`- ${error}`);
        return `${lines.join('\n')}\n`;
    }

    lines.push(
        '',
        '## Proposed policy-only changes',
        '',
        `- \`baselineSha\`: \`${plan.from.baselineSha}\` → \`${plan.to.baselineSha}\``,
        `- \`baselineDate\`: \`${plan.from.baselineDate}\` → \`${plan.to.baselineDate}\``,
        '',
        `Preview file: \`${plan.policyPath}\` (not written in place)`,
    );
    return `${lines.join('\n')}\n`;
}
