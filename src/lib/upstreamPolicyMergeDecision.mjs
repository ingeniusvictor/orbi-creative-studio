import crypto from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const DECISIONS = Object.freeze(['APPROVE_MERGE', 'REJECT_MERGE']);

function canonicalEvidenceIdentity(packet) {
    return JSON.stringify({
        schemaVersion: packet?.schemaVersion ?? null,
        repository: packet?.repository ?? null,
        prNumber: packet?.prNumber ?? null,
        prHeadSha: packet?.prHeadSha ?? null,
        handoffIdentitySha256: packet?.handoffIdentitySha256 ?? null,
        integratedCiRunId: packet?.integratedCiRunId ?? null,
        foundationRunId: packet?.foundationRunId ?? null,
        foundationJobs: packet?.foundationJobs ?? null,
    });
}

export function computeHumanPolicyMergeEvidenceIdentity(packet) {
    return crypto
        .createHash('sha256')
        .update(canonicalEvidenceIdentity(packet), 'utf8')
        .digest('hex');
}

export function buildHumanPolicyMergeDecisionTemplate(evidencePacket) {
    if (
        !evidencePacket?.valid
        || evidencePacket?.state !== 'READY_FOR_HUMAN_MERGE_DECISION'
    ) {
        throw new TypeError('valid P1C47 merge evidence packet is required');
    }

    return Object.freeze({
        schemaVersion: 1,
        evidenceIdentitySha256: computeHumanPolicyMergeEvidenceIdentity(evidencePacket),
        repository: evidencePacket.repository,
        prNumber: evidencePacket.prNumber,
        prHeadSha: evidencePacket.prHeadSha,
        decision: null,
        reviewer: null,
        decidedAt: null,
        rationale: null,
        automaticMergeAllowed: false,
        mergeExecutionAllowed: false,
    });
}

export function evaluateHumanPolicyMergeDecision(evidencePacket, decisionRecord) {
    const errors = [];

    if (
        !evidencePacket?.valid
        || evidencePacket?.state !== 'READY_FOR_HUMAN_MERGE_DECISION'
    ) {
        errors.push('valid P1C47 merge evidence packet is required');
    }

    const expectedIdentity = evidencePacket?.valid
        ? computeHumanPolicyMergeEvidenceIdentity(evidencePacket)
        : null;

    if (!decisionRecord || typeof decisionRecord !== 'object') {
        errors.push('human merge decision record is required');
    }

    if (decisionRecord?.evidenceIdentitySha256 !== expectedIdentity) {
        errors.push('merge evidence identity SHA-256 mismatch');
    }
    if (!SHA256.test(decisionRecord?.evidenceIdentitySha256 || '')) {
        errors.push('merge evidence identity SHA-256 is invalid');
    }
    if (decisionRecord?.repository !== evidencePacket?.repository) {
        errors.push('decision repository does not match evidence packet');
    }
    if (decisionRecord?.prNumber !== evidencePacket?.prNumber) {
        errors.push('decision PR number does not match evidence packet');
    }
    if (decisionRecord?.prHeadSha !== evidencePacket?.prHeadSha) {
        errors.push('decision PR head SHA does not match evidence packet');
    }
    if (!SHA40.test(decisionRecord?.prHeadSha || '')) {
        errors.push('decision PR head SHA must be a 40-character commit SHA');
    }
    if (!DECISIONS.includes(decisionRecord?.decision)) {
        errors.push('decision must be APPROVE_MERGE or REJECT_MERGE');
    }
    if (typeof decisionRecord?.reviewer !== 'string' || !decisionRecord.reviewer.trim()) {
        errors.push('reviewer is required');
    }
    if (typeof decisionRecord?.rationale !== 'string' || !decisionRecord.rationale.trim()) {
        errors.push('decision rationale is required');
    }

    const decidedAt = Date.parse(decisionRecord?.decidedAt || '');
    if (!Number.isFinite(decidedAt)) {
        errors.push('decidedAt must be a valid ISO timestamp');
    }

    const valid = errors.length === 0;
    const approved = valid && decisionRecord.decision === 'APPROVE_MERGE';
    const rejected = valid && decisionRecord.decision === 'REJECT_MERGE';

    return Object.freeze({
        schemaVersion: 1,
        valid,
        state: !valid
            ? 'HUMAN_MERGE_DECISION_INVALID'
            : approved
                ? 'HUMAN_MERGE_APPROVAL_RECORDED'
                : 'HUMAN_MERGE_REJECTION_RECORDED',
        evidenceIdentitySha256: expectedIdentity,
        repository: evidencePacket?.repository || null,
        prNumber: evidencePacket?.prNumber || null,
        prHeadSha: evidencePacket?.prHeadSha || null,
        decision: valid ? decisionRecord.decision : null,
        reviewer: typeof decisionRecord?.reviewer === 'string'
            ? decisionRecord.reviewer.trim()
            : null,
        decidedAt: Number.isFinite(decidedAt)
            ? new Date(decidedAt).toISOString()
            : null,
        rationale: typeof decisionRecord?.rationale === 'string'
            ? decisionRecord.rationale.trim()
            : null,
        approved,
        rejected,
        automaticMergeAllowed: false,
        mergeExecutionAllowed: false,
        requiresSeparateRepositoryMergeAction: approved,
        mergeMustRemainUnperformed: true,
        errors: Object.freeze(errors),
    });
}

export function formatHumanPolicyMergeDecisionMarkdown(result) {
    return [
        '# ORBI Human Policy Merge Decision',
        '',
        `- State: **${result.state}**`,
        `- Valid decision: **${result.valid ? 'YES' : 'NO'}**`,
        `- Decision: **${result.decision || 'UNSET'}**`,
        `- Reviewer: ${result.reviewer || 'unknown'}`,
        `- Decided at: ${result.decidedAt || 'unknown'}`,
        '- Automatic merge: **FORBIDDEN**',
        '- Merge execution in this phase: **FORBIDDEN**',
        `- Separate repository merge action: **${result.requiresSeparateRepositoryMergeAction ? 'REQUIRED' : 'NOT AUTHORIZED'}**`,
        '',
        ...(result.rationale ? ['## Rationale', '', result.rationale, ''] : []),
        ...(result.errors?.length ? ['## Errors', '', ...result.errors.map((error) => `- ${error}`), ''] : []),
    ].join('\n');
}
