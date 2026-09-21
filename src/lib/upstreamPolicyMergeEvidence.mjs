const SHA40 = /^[0-9a-f]{40}$/i;

const REQUIRED_FOUNDATION_JOBS = Object.freeze([
    'core-linux',
    'windows-desktop',
    'macos-package',
]);

function validSuccessEvidence(evidence, workflowName, headSha) {
    return Boolean(
        evidence
        && evidence.workflowName === workflowName
        && evidence.conclusion === 'success'
        && evidence.headSha === headSha
        && Number.isInteger(evidence.runId)
        && evidence.runId > 0
    );
}

export function buildHumanPolicyMergeEvidence({
    envelopeValidation,
    prHeadSha,
    integratedCi,
    foundationCertification,
} = {}) {
    const errors = [];

    if (
        !envelopeValidation?.valid
        || envelopeValidation?.state !== 'HUMAN_POLICY_PR_ENVELOPE_VALIDATED'
    ) {
        errors.push('valid P1C45 policy PR envelope validation is required');
    }

    if (!SHA40.test(prHeadSha || '')) {
        errors.push('policy PR head SHA must be a 40-character commit SHA');
    }

    if (!validSuccessEvidence(
        integratedCi,
        'ORBI Pull Request integrated gate',
        prHeadSha,
    )) {
        errors.push('green integrated PR gate evidence bound to the policy PR head is required');
    }

    if (!validSuccessEvidence(
        foundationCertification,
        'ORBI Foundation integrated certification',
        prHeadSha,
    )) {
        errors.push('green Foundation certification evidence bound to the policy PR head is required');
    }

    if (foundationCertification?.event !== 'pull_request') {
        errors.push('Foundation certification must be a pre-merge pull_request run');
    }

    const foundationJobs = Array.isArray(foundationCertification?.jobs)
        ? foundationCertification.jobs
        : [];
    for (const requiredJob of REQUIRED_FOUNDATION_JOBS) {
        const job = foundationJobs.find((candidate) => candidate?.name === requiredJob);
        if (!job || job.conclusion !== 'success') {
            errors.push(`Foundation job ${requiredJob} must be green`);
        }
    }

    return Object.freeze({
        schemaVersion: 1,
        valid: errors.length === 0,
        state: errors.length === 0
            ? 'READY_FOR_HUMAN_MERGE_DECISION'
            : 'MERGE_EVIDENCE_INCOMPLETE',
        repository: envelopeValidation?.repository || null,
        prNumber: envelopeValidation?.prNumber || null,
        prHeadSha: SHA40.test(prHeadSha || '') ? prHeadSha.toLowerCase() : null,
        handoffIdentitySha256: envelopeValidation?.handoffIdentitySha256 || null,
        integratedCiRunId: Number.isInteger(integratedCi?.runId) ? integratedCi.runId : null,
        foundationRunId: Number.isInteger(foundationCertification?.runId)
            ? foundationCertification.runId
            : null,
        foundationJobs: Object.freeze(
            foundationJobs.map((job) => Object.freeze({
                name: job?.name || null,
                conclusion: job?.conclusion || null,
            })),
        ),
        policyMutationAllowed: false,
        automaticMergeAllowed: false,
        mergeAllowed: false,
        requiresHumanMergeDecision: true,
        errors: Object.freeze(errors),
    });
}

export function formatHumanPolicyMergeEvidenceMarkdown(packet) {
    return [
        '# ORBI Human Policy Merge Evidence',
        '',
        `- State: **${packet.state}**`,
        `- Valid evidence: **${packet.valid ? 'YES' : 'NO'}**`,
        `- Repository: ${packet.repository ? `\`${packet.repository}\`` : 'unknown'}`,
        `- PR: ${packet.prNumber ?? 'unknown'}`,
        `- PR head: ${packet.prHeadSha ? `\`${packet.prHeadSha}\`` : 'unknown'}`,
        `- Integrated CI run: ${packet.integratedCiRunId ?? 'unknown'}`,
        `- Foundation run: ${packet.foundationRunId ?? 'unknown'}`,
        '- Automatic merge: **FORBIDDEN**',
        '- Human merge decision: **REQUIRED**',
        '',
        '## Foundation jobs',
        '',
        ...(packet.foundationJobs?.length
            ? packet.foundationJobs.map((job) => `- ${job.name}: **${job.conclusion || 'unknown'}**`)
            : ['- none']),
        '',
        ...(packet.errors?.length ? ['## Errors', '', ...packet.errors.map((error) => `- ${error}`), ''] : []),
    ].join('\n');
}
