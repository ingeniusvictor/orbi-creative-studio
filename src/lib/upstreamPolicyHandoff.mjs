import crypto from 'node:crypto';

function sha256(text) {
    return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function buildUpstreamPolicyHandoffPackage({
    proposal,
    plan,
    currentPolicySource,
    previewPolicySource,
} = {}) {
    const errors = [];
    if (!proposal?.valid) errors.push('baseline proposal must be valid');
    if (proposal?.state !== 'READY_FOR_HUMAN_APPROVAL') errors.push('baseline proposal must require human approval');
    if (!plan?.valid) errors.push('policy dry-run plan must be valid');
    if (plan?.state !== 'DRY_RUN_READY') errors.push('policy dry-run plan must be DRY_RUN_READY');
    if (plan?.sourceMutationAllowed !== false) errors.push('dry-run plan cannot authorize source mutation');
    if (typeof currentPolicySource !== 'string' || !currentPolicySource) errors.push('current policy source is required');
    if (typeof previewPolicySource !== 'string' || !previewPolicySource) errors.push('preview policy source is required');

    if (proposal?.fromBaselineSha && plan?.fromBaselineSha && proposal.fromBaselineSha !== plan.fromBaselineSha) {
        errors.push('proposal and dry-run source baselines differ');
    }
    if (proposal?.toBaselineSha && plan?.toBaselineSha && proposal.toBaselineSha !== plan.toBaselineSha) {
        errors.push('proposal and dry-run target baselines differ');
    }

    if (errors.length) {
        return Object.freeze({
            valid: false,
            state: 'BLOCKED',
            sourceMutationAllowed: false,
            policyPrAuthorized: false,
            errors: Object.freeze(errors),
        });
    }

    return Object.freeze({
        schemaVersion: 1,
        valid: true,
        state: 'READY_FOR_HUMAN_POLICY_PR',
        sourceMutationAllowed: false,
        policyPrAuthorized: false,
        requiresHumanApproval: true,
        requiresSeparatePolicyPr: true,
        fromBaselineSha: proposal.fromBaselineSha,
        toBaselineSha: proposal.toBaselineSha,
        toBaselineDate: proposal.toBaselineDate || null,
        toBaselineMessage: proposal.toBaselineMessage || null,
        decisionCounts: proposal.decisionCounts,
        implementationCommits: proposal.implementationCommits,
        hashes: Object.freeze({
            currentPolicySha256: sha256(currentPolicySource),
            previewPolicySha256: sha256(previewPolicySource),
            proposalSha256: sha256(JSON.stringify(proposal)),
            dryRunPlanSha256: sha256(JSON.stringify(plan)),
        }),
        approvalChecklist: Object.freeze([
            'Confirm proposal still targets the current reviewed baseline.',
            'Confirm all P1C37 decisions remain approved and implementation evidence is valid.',
            'Confirm preview changes only baselineSha and baselineDate.',
            'Confirm current policy SHA-256 matches this handoff package before opening the policy PR.',
            'Open a separate human-reviewed policy PR; do not apply this handoff automatically.',
        ]),
        errors: Object.freeze([]),
    });
}

export function formatUpstreamPolicyHandoffMarkdown(bundle) {
    if (!bundle?.valid) {
        return [
            '# ORBI Upstream Policy Handoff',
            '',
            '- State: **BLOCKED**',
            '- Source mutation: **FORBIDDEN**',
            '',
            '## Blocking reasons',
            '',
            ...(bundle?.errors || ['invalid handoff']).map((error) => `- ${error}`),
            '',
        ].join('\n');
    }

    return [
        '# ORBI Upstream Policy Handoff',
        '',
        `- From baseline: \`${bundle.fromBaselineSha}\``,
        `- To baseline: \`${bundle.toBaselineSha}\``,
        `- Target date: ${bundle.toBaselineDate || 'unknown'}`,
        `- State: **${bundle.state}**`,
        '- Source mutation: **FORBIDDEN**',
        '- Policy PR: **HUMAN APPROVAL REQUIRED**',
        '',
        '## Integrity hashes',
        '',
        `- Current policy SHA-256: \`${bundle.hashes.currentPolicySha256}\``,
        `- Preview policy SHA-256: \`${bundle.hashes.previewPolicySha256}\``,
        `- Proposal SHA-256: \`${bundle.hashes.proposalSha256}\``,
        `- Dry-run plan SHA-256: \`${bundle.hashes.dryRunPlanSha256}\``,
        '',
        '## Approval checklist',
        '',
        ...bundle.approvalChecklist.map((item) => `- [ ] ${item}`),
        '',
    ].join('\n');
}
