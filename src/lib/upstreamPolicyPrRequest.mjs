const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function shortSha(value) {
    return typeof value === 'string' ? value.slice(0, 12).toLowerCase() : '';
}

export function buildUpstreamPolicyPrRequest(reviewPacket, options = {}) {
    const errors = [];

    if (!reviewPacket?.valid || reviewPacket?.state !== 'READY_FOR_HUMAN_POLICY_PR_REVIEW') {
        errors.push('valid P1C43 review packet is required');
    }
    if (!SHA40.test(reviewPacket?.fromBaselineSha || '')) {
        errors.push('source baseline SHA is invalid');
    }
    if (!SHA40.test(reviewPacket?.toBaselineSha || '')) {
        errors.push('target baseline SHA is invalid');
    }
    if (!SHA256.test(reviewPacket?.proposedPolicySha256 || '')) {
        errors.push('proposed policy SHA-256 is invalid');
    }
    if (!SHA256.test(reviewPacket?.handoffIdentitySha256 || '')) {
        errors.push('handoff identity SHA-256 is invalid');
    }
    if (!reviewPacket?.requiresHumanPolicyPr) {
        errors.push('P1C43 must require a human policy PR');
    }
    if (!reviewPacket?.requiresHumanMergeDecision) {
        errors.push('P1C43 must require a human merge decision');
    }

    if (errors.length) {
        return Object.freeze({
            valid: false,
            state: 'POLICY_PR_REQUEST_BLOCKED',
            policyMutationAllowed: false,
            policyPrCreationAllowed: false,
            mergeAllowed: false,
            errors: Object.freeze(errors),
        });
    }

    const repository = typeof options.repository === 'string' && options.repository.trim()
        ? options.repository.trim()
        : 'ingeniusvictor/orbi-creative-studio';
    const baseBranch = typeof options.baseBranch === 'string' && options.baseBranch.trim()
        ? options.baseBranch.trim()
        : 'integration/orbi-foundation';
    const policyPath = 'src/lib/upstreamDriftPolicy.mjs';
    const headBranch = `governance/upstream-baseline-${shortSha(reviewPacket.toBaselineSha)}`;

    return Object.freeze({
        schemaVersion: 1,
        valid: true,
        state: 'READY_FOR_HUMAN_POLICY_PR_REQUEST',
        repository,
        baseBranch,
        suggestedHeadBranch: headBranch,
        title: `governance(upstream): advance reviewed baseline to ${shortSha(reviewPacket.toBaselineSha)}`,
        fromBaselineSha: reviewPacket.fromBaselineSha,
        toBaselineSha: reviewPacket.toBaselineSha,
        toBaselineDate: reviewPacket.toBaselineDate || null,
        toBaselineMessage: reviewPacket.toBaselineMessage || null,
        handoffIdentitySha256: reviewPacket.handoffIdentitySha256,
        expectedProposedPolicySha256: reviewPacket.proposedPolicySha256,
        allowedFiles: Object.freeze([policyPath]),
        requiredChangedFields: Object.freeze([
            'OPEN_GENERATIVE_AI_UPSTREAM.baselineSha',
            'OPEN_GENERATIVE_AI_UPSTREAM.baselineDate',
        ]),
        policyMutationAllowed: false,
        branchCreationAllowed: false,
        policyPrCreationAllowed: false,
        mergeAllowed: false,
        requiresHumanBranchCreation: true,
        requiresHumanPolicyPrCreation: true,
        requiresHumanMergeDecision: true,
        reviewInstructions: Object.freeze([
            'Create the policy branch manually from the current integration/orbi-foundation head.',
            'Apply only the exact P1C39/P1C42 validated policy preview.',
            'Confirm the PR changes only src/lib/upstreamDriftPolicy.mjs.',
            'Confirm only baselineSha and baselineDate changed inside the policy file.',
            'Confirm the proposed policy SHA-256 matches expectedProposedPolicySha256.',
            'Run required PR gates and Foundation certification.',
            'Make a separate human merge decision after reviewing the actual PR.',
        ]),
        errors: Object.freeze([]),
    });
}

export function formatUpstreamPolicyPrRequestMarkdown(request) {
    if (!request?.valid) {
        return [
            '# ORBI Human Policy PR Request Manifest',
            '',
            '- State: **BLOCKED**',
            '- Automatic branch creation: **FORBIDDEN**',
            '- Automatic PR creation: **FORBIDDEN**',
            '- Automatic merge: **FORBIDDEN**',
            '',
            '## Blocking reasons',
            '',
            ...(request?.errors || ['invalid request']).map((error) => `- ${error}`),
            '',
        ].join('\n');
    }

    return [
        '# ORBI Human Policy PR Request Manifest',
        '',
        `- Repository: \`${request.repository}\``,
        `- Base branch: \`${request.baseBranch}\``,
        `- Suggested head branch: \`${request.suggestedHeadBranch}\``,
        `- PR title: ${request.title}`,
        `- From baseline: \`${request.fromBaselineSha}\``,
        `- To baseline: \`${request.toBaselineSha}\``,
        `- Expected policy SHA-256: \`${request.expectedProposedPolicySha256}\``,
        `- Handoff identity SHA-256: \`${request.handoffIdentitySha256}\``,
        '- Automatic branch creation: **FORBIDDEN**',
        '- Automatic PR creation: **FORBIDDEN**',
        '- Automatic merge: **FORBIDDEN**',
        '',
        '## Allowed file',
        '',
        ...request.allowedFiles.map((file) => `- \`${file}\``),
        '',
        '## Required changed fields',
        '',
        ...request.requiredChangedFields.map((field) => `- \`${field}\``),
        '',
        '## Human instructions',
        '',
        ...request.reviewInstructions.map((instruction) => `- [ ] ${instruction}`),
        '',
    ].join('\n');
}
