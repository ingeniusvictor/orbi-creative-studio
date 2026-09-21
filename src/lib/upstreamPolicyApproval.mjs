import crypto from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function canonicalHandoffIdentity(handoff) {
    return JSON.stringify({
        schemaVersion: handoff?.schemaVersion ?? null,
        fromBaselineSha: handoff?.fromBaselineSha ?? null,
        toBaselineSha: handoff?.toBaselineSha ?? null,
        toBaselineDate: handoff?.toBaselineDate ?? null,
        hashes: handoff?.hashes ?? null,
    });
}

export function computeUpstreamPolicyHandoffIdentity(handoff) {
    return crypto.createHash('sha256').update(canonicalHandoffIdentity(handoff), 'utf8').digest('hex');
}

export function buildUpstreamPolicyApprovalTemplate(handoff) {
    if (!handoff?.valid || handoff?.state !== 'READY_FOR_HUMAN_POLICY_PR') {
        throw new TypeError('A valid P1C40 handoff package is required');
    }

    return Object.freeze({
        schemaVersion: 1,
        handoffIdentitySha256: computeUpstreamPolicyHandoffIdentity(handoff),
        fromBaselineSha: handoff.fromBaselineSha,
        toBaselineSha: handoff.toBaselineSha,
        decision: null,
        approver: null,
        approvedAt: null,
        rationale: null,
        policyMutationAllowed: false,
        policyPrCreationAllowed: false,
    });
}

export function evaluateUpstreamPolicyApproval(handoff, approval) {
    const errors = [];

    if (!handoff?.valid || handoff?.state !== 'READY_FOR_HUMAN_POLICY_PR') {
        errors.push('valid P1C40 handoff is required');
    }
    if (!approval || typeof approval !== 'object') {
        errors.push('approval record is required');
    }

    const expectedIdentity = handoff?.valid ? computeUpstreamPolicyHandoffIdentity(handoff) : null;
    if (approval?.handoffIdentitySha256 !== expectedIdentity) {
        errors.push('handoff identity SHA-256 mismatch');
    }
    if (!SHA256.test(approval?.handoffIdentitySha256 || '')) {
        errors.push('handoff identity SHA-256 is invalid');
    }
    if (approval?.fromBaselineSha !== handoff?.fromBaselineSha) {
        errors.push('approval source baseline does not match handoff');
    }
    if (approval?.toBaselineSha !== handoff?.toBaselineSha) {
        errors.push('approval target baseline does not match handoff');
    }
    if (!SHA40.test(approval?.fromBaselineSha || '') || !SHA40.test(approval?.toBaselineSha || '')) {
        errors.push('approval baseline SHAs must be 40-character commit SHAs');
    }
    if (approval?.decision !== 'APPROVE_POLICY_PR') {
        errors.push('decision must be APPROVE_POLICY_PR');
    }
    if (typeof approval?.approver !== 'string' || !approval.approver.trim()) {
        errors.push('approver is required');
    }
    if (typeof approval?.rationale !== 'string' || !approval.rationale.trim()) {
        errors.push('approval rationale is required');
    }

    const approvedAt = Date.parse(approval?.approvedAt || '');
    if (!Number.isFinite(approvedAt)) {
        errors.push('approvedAt must be a valid ISO timestamp');
    }

    return Object.freeze({
        valid: errors.length === 0,
        state: errors.length === 0 ? 'HUMAN_APPROVAL_RECORDED' : 'APPROVAL_INVALID',
        handoffIdentitySha256: expectedIdentity,
        approver: typeof approval?.approver === 'string' ? approval.approver.trim() : null,
        approvedAt: Number.isFinite(approvedAt) ? new Date(approvedAt).toISOString() : null,
        rationale: typeof approval?.rationale === 'string' ? approval.rationale.trim() : null,
        policyMutationAllowed: false,
        policyPrCreationAllowed: false,
        requiresSeparatePolicyPr: true,
        errors: Object.freeze(errors),
    });
}

export function formatUpstreamPolicyApprovalMarkdown(result) {
    return [
        '# ORBI Upstream Policy Human Approval',
        '',
        `- State: **${result.state}**`,
        `- Valid approval: **${result.valid ? 'YES' : 'NO'}**`,
        '- Policy mutation: **FORBIDDEN**',
        '- Automatic PR creation: **FORBIDDEN**',
        '- Separate policy PR: **REQUIRED**',
        ...(result.valid ? [
            `- Approver: ${result.approver}`,
            `- Approved at: ${result.approvedAt}`,
            `- Handoff identity SHA-256: \`${result.handoffIdentitySha256}\``,
        ] : []),
        '',
        ...(result.errors?.length ? ['## Errors', '', ...result.errors.map((error) => `- ${error}`), ''] : []),
    ].join('\n');
}
