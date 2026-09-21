import crypto from 'node:crypto';
import {
    computeUpstreamPolicyHandoffIdentity,
} from './upstreamPolicyApproval.mjs';

function sha256(text) {
    return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function validateUpstreamPolicyPrContent({
    handoff,
    approvalResult,
    currentPolicySource,
    proposedPolicySource,
} = {}) {
    const errors = [];

    if (!handoff?.valid || handoff?.state !== 'READY_FOR_HUMAN_POLICY_PR') {
        errors.push('valid P1C40 handoff is required');
    }
    if (!approvalResult?.valid || approvalResult?.state !== 'HUMAN_APPROVAL_RECORDED') {
        errors.push('valid P1C41 approval result is required');
    }
    if (typeof currentPolicySource !== 'string' || !currentPolicySource) {
        errors.push('current policy source is required');
    }
    if (typeof proposedPolicySource !== 'string' || !proposedPolicySource) {
        errors.push('proposed policy source is required');
    }

    const expectedIdentity = handoff?.valid ? computeUpstreamPolicyHandoffIdentity(handoff) : null;
    if (approvalResult?.handoffIdentitySha256 !== expectedIdentity) {
        errors.push('approval does not match handoff identity');
    }

    const currentHash = typeof currentPolicySource === 'string' ? sha256(currentPolicySource) : null;
    const proposedHash = typeof proposedPolicySource === 'string' ? sha256(proposedPolicySource) : null;

    if (handoff?.hashes?.currentPolicySha256 !== currentHash) {
        errors.push('current policy source hash does not match handoff');
    }
    if (handoff?.hashes?.previewPolicySha256 !== proposedHash) {
        errors.push('proposed policy source hash does not match approved preview');
    }

    return Object.freeze({
        valid: errors.length === 0,
        state: errors.length === 0 ? 'POLICY_PR_CONTENT_VALIDATED' : 'POLICY_PR_CONTENT_INVALID',
        handoffIdentitySha256: expectedIdentity,
        currentPolicySha256: currentHash,
        proposedPolicySha256: proposedHash,
        policyMutationAllowed: false,
        policyPrCreationAllowed: false,
        mergeAllowed: false,
        requiresSeparatePolicyPr: true,
        errors: Object.freeze(errors),
    });
}

export function formatUpstreamPolicyPrContentValidationMarkdown(result) {
    return [
        '# ORBI Upstream Policy PR Content Validation',
        '',
        `- State: **${result.state}**`,
        `- Valid content: **${result.valid ? 'YES' : 'NO'}**`,
        '- Policy mutation: **FORBIDDEN**',
        '- Automatic PR creation: **FORBIDDEN**',
        '- Automatic merge: **FORBIDDEN**',
        '- Separate human-reviewed policy PR: **REQUIRED**',
        ...(result.valid ? [
            `- Current policy SHA-256: \`${result.currentPolicySha256}\``,
            `- Proposed policy SHA-256: \`${result.proposedPolicySha256}\``,
            `- Handoff identity SHA-256: \`${result.handoffIdentitySha256}\``,
        ] : []),
        '',
        ...(result.errors?.length ? ['## Errors', '', ...result.errors.map((error) => `- ${error}`), ''] : []),
    ].join('\n');
}
