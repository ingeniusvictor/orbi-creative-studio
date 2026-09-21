import crypto from 'node:crypto';

function sha256(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function buildUpstreamPolicyReviewPacket({
    handoff,
    approvalResult,
    contentValidation,
    proposedPolicySource,
} = {}) {
    const errors = [];

    if (!handoff?.valid || handoff?.state !== 'READY_FOR_HUMAN_POLICY_PR') {
        errors.push('valid P1C40 handoff is required');
    }
    if (!approvalResult?.valid || approvalResult?.state !== 'HUMAN_APPROVAL_RECORDED') {
        errors.push('valid P1C41 approval result is required');
    }
    if (!contentValidation?.valid || contentValidation?.state !== 'POLICY_PR_CONTENT_VALIDATED') {
        errors.push('valid P1C42 content validation is required');
    }
    if (typeof proposedPolicySource !== 'string' || !proposedPolicySource) {
        errors.push('proposed policy source is required');
    }

    const proposedPolicySha256 = typeof proposedPolicySource === 'string'
        ? sha256(proposedPolicySource)
        : null;

    if (
        contentValidation?.proposedPolicySha256
        && proposedPolicySha256 !== contentValidation.proposedPolicySha256
    ) {
        errors.push('proposed policy source changed after P1C42 validation');
    }
    if (
        handoff?.hashes?.previewPolicySha256
        && proposedPolicySha256 !== handoff.hashes.previewPolicySha256
    ) {
        errors.push('proposed policy source no longer matches P1C40 preview');
    }
    if (
        approvalResult?.handoffIdentitySha256
        && contentValidation?.handoffIdentitySha256
        && approvalResult.handoffIdentitySha256 !== contentValidation.handoffIdentitySha256
    ) {
        errors.push('approval and content validation refer to different handoffs');
    }

    if (errors.length) {
        return Object.freeze({
            valid: false,
            state: 'REVIEW_PACKET_BLOCKED',
            policyMutationAllowed: false,
            policyPrCreationAllowed: false,
            mergeAllowed: false,
            errors: Object.freeze(errors),
        });
    }

    return Object.freeze({
        schemaVersion: 1,
        valid: true,
        state: 'READY_FOR_HUMAN_POLICY_PR_REVIEW',
        fromBaselineSha: handoff.fromBaselineSha,
        toBaselineSha: handoff.toBaselineSha,
        toBaselineDate: handoff.toBaselineDate || null,
        toBaselineMessage: handoff.toBaselineMessage || null,
        handoffIdentitySha256: approvalResult.handoffIdentitySha256,
        proposedPolicySha256,
        approver: approvalResult.approver || null,
        approvedAt: approvalResult.approvedAt || null,
        approvalRationale: approvalResult.rationale || null,
        policyMutationAllowed: false,
        policyPrCreationAllowed: false,
        mergeAllowed: false,
        requiresHumanPolicyPr: true,
        requiresHumanMergeDecision: true,
        reviewChecklist: Object.freeze([
            'Verify this packet still targets the current canonical policy baseline.',
            'Verify the proposed policy SHA-256 matches the approved preview.',
            'Verify the policy PR changes only baselineSha and baselineDate.',
            'Verify required CI and Foundation certification are green on the policy PR.',
            'Make a separate human merge decision after reviewing the actual policy PR.',
        ]),
        errors: Object.freeze([]),
    });
}

export function formatUpstreamPolicyReviewPacketMarkdown(packet) {
    if (!packet?.valid) {
        return [
            '# ORBI Upstream Policy PR Review Packet',
            '',
            '- State: **BLOCKED**',
            '- Automatic PR creation: **FORBIDDEN**',
            '- Automatic merge: **FORBIDDEN**',
            '',
            '## Blocking reasons',
            '',
            ...(packet?.errors || ['invalid review packet']).map((error) => `- ${error}`),
            '',
        ].join('\n');
    }

    return [
        '# ORBI Upstream Policy PR Review Packet',
        '',
        `- From baseline: \`${packet.fromBaselineSha}\``,
        `- To baseline: \`${packet.toBaselineSha}\``,
        `- Target date: ${packet.toBaselineDate || 'unknown'}`,
        `- Approver: ${packet.approver || 'unspecified'}`,
        `- Approved at: ${packet.approvedAt || 'unknown'}`,
        `- Proposed policy SHA-256: \`${packet.proposedPolicySha256}\``,
        `- Handoff identity SHA-256: \`${packet.handoffIdentitySha256}\``,
        `- State: **${packet.state}**`,
        '- Automatic PR creation: **FORBIDDEN**',
        '- Automatic merge: **FORBIDDEN**',
        '',
        '## Final review checklist',
        '',
        ...packet.reviewChecklist.map((item) => `- [ ] ${item}`),
        '',
    ].join('\n');
}
