import crypto from 'node:crypto';

function sha256(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeFiles(files) {
    if (!Array.isArray(files)) return [];
    return [...new Set(files.filter((file) => typeof file === 'string' && file.trim()).map((file) => file.trim()))]
        .sort();
}

export function validateHumanPolicyPrEnvelope({
    request,
    pullRequest,
    changedFiles,
    proposedPolicySource,
} = {}) {
    const errors = [];

    if (!request?.valid || request?.state !== 'READY_FOR_HUMAN_POLICY_PR_REQUEST') {
        errors.push('valid P1C44 policy PR request is required');
    }
    if (!pullRequest || typeof pullRequest !== 'object') {
        errors.push('pull request metadata is required');
    }
    if (typeof proposedPolicySource !== 'string' || !proposedPolicySource) {
        errors.push('proposed policy source is required');
    }

    const files = normalizeFiles(changedFiles);
    const allowedFiles = normalizeFiles(request?.allowedFiles);
    const proposedPolicySha256 = typeof proposedPolicySource === 'string'
        ? sha256(proposedPolicySource)
        : null;

    if (pullRequest?.repository !== request?.repository) {
        errors.push('pull request repository does not match request');
    }
    if (pullRequest?.baseBranch !== request?.baseBranch) {
        errors.push('pull request base branch does not match request');
    }
    if (pullRequest?.headBranch !== request?.suggestedHeadBranch) {
        errors.push('pull request head branch does not match request');
    }
    if (pullRequest?.title !== request?.title) {
        errors.push('pull request title does not match request');
    }
    if (pullRequest?.state !== 'open') {
        errors.push('pull request must be open for validation');
    }
    if (pullRequest?.draft === true) {
        errors.push('pull request must not remain draft at final envelope validation');
    }

    if (files.length !== allowedFiles.length || files.some((file, index) => file !== allowedFiles[index])) {
        errors.push('changed file set does not exactly match P1C44 allowed files');
    }

    if (proposedPolicySha256 !== request?.expectedProposedPolicySha256) {
        errors.push('proposed policy SHA-256 does not match approved P1C44 content');
    }

    return Object.freeze({
        schemaVersion: 1,
        valid: errors.length === 0,
        state: errors.length === 0
            ? 'HUMAN_POLICY_PR_ENVELOPE_VALIDATED'
            : 'HUMAN_POLICY_PR_ENVELOPE_INVALID',
        repository: pullRequest?.repository || null,
        prNumber: Number.isInteger(pullRequest?.number) ? pullRequest.number : null,
        baseBranch: pullRequest?.baseBranch || null,
        headBranch: pullRequest?.headBranch || null,
        title: pullRequest?.title || null,
        changedFiles: Object.freeze(files),
        expectedProposedPolicySha256: request?.expectedProposedPolicySha256 || null,
        observedProposedPolicySha256: proposedPolicySha256,
        handoffIdentitySha256: request?.handoffIdentitySha256 || null,
        policyMutationAllowed: false,
        policyPrCreationAllowed: false,
        mergeAllowed: false,
        requiresCiSuccess: true,
        requiresFoundationCertification: true,
        requiresHumanMergeDecision: true,
        errors: Object.freeze(errors),
    });
}

export function formatHumanPolicyPrEnvelopeMarkdown(result) {
    return [
        '# ORBI Human Policy PR Envelope Validation',
        '',
        `- State: **${result.state}**`,
        `- Valid envelope: **${result.valid ? 'YES' : 'NO'}**`,
        `- Repository: ${result.repository ? `\`${result.repository}\`` : 'unknown'}`,
        `- PR: ${result.prNumber ?? 'unknown'}`,
        `- Base branch: ${result.baseBranch ? `\`${result.baseBranch}\`` : 'unknown'}`,
        `- Head branch: ${result.headBranch ? `\`${result.headBranch}\`` : 'unknown'}`,
        '- Automatic merge: **FORBIDDEN**',
        '- CI success: **REQUIRED**',
        '- Foundation certification: **REQUIRED**',
        '- Separate human merge decision: **REQUIRED**',
        '',
        '## Changed files',
        '',
        ...(result.changedFiles?.length ? result.changedFiles.map((file) => `- \`${file}\``) : ['- none']),
        '',
        ...(result.errors?.length ? ['## Errors', '', ...result.errors.map((error) => `- ${error}`), ''] : []),
    ].join('\n');
}
