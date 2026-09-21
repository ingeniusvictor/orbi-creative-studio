function countDecisions(resolved = []) {
    const counts = { ADOPT: 0, ADAPT: 0, REJECT: 0 };
    for (const item of resolved) {
        if (Object.prototype.hasOwnProperty.call(counts, item?.decision)) {
            counts[item.decision] += 1;
        }
    }
    return Object.freeze(counts);
}

function uniqueImplementationCommits(resolved = []) {
    return Object.freeze([
        ...new Set(
            resolved
                .map((item) => item?.implementation?.orbiCommitSha)
                .filter(Boolean),
        ),
    ]);
}

export function buildUpstreamBaselineAdvanceProposal({
    driftReport,
    adoptionManifest,
    reviewResult,
} = {}) {
    if (!driftReport || typeof driftReport !== 'object') {
        throw new TypeError('Drift report is required');
    }
    if (!adoptionManifest || typeof adoptionManifest !== 'object') {
        throw new TypeError('Adoption manifest is required');
    }
    if (!reviewResult || typeof reviewResult !== 'object') {
        throw new TypeError('Review result is required');
    }

    const errors = [];
    if (!reviewResult.valid) errors.push('review result is not valid');
    if (!reviewResult.baselineAdvanceEligible) errors.push('review result is not baseline-advance eligible');
    if (driftReport.baselineSha !== adoptionManifest.baselineSha) errors.push('manifest baseline does not match drift baseline');
    if (driftReport.headSha !== adoptionManifest.headSha) errors.push('manifest head does not match drift head');
    if (driftReport.baselineSha === driftReport.headSha) errors.push('baseline already equals upstream head');
    if (!driftReport.hasDrift) errors.push('drift report does not contain drift');

    const resolved = Array.isArray(reviewResult.resolved) ? reviewResult.resolved : [];
    const manifestEntries = Array.isArray(adoptionManifest.entries) ? adoptionManifest.entries : [];
    if (resolved.length !== manifestEntries.length) {
        errors.push('resolved decision count does not match manifest entry count');
    }

    if (errors.length > 0) {
        return Object.freeze({
            valid: false,
            state: 'BLOCKED',
            baselineAdvanceEligible: false,
            policyMutationAllowed: false,
            requiresHumanApproval: true,
            errors: Object.freeze(errors),
        });
    }

    return Object.freeze({
        schemaVersion: 1,
        valid: true,
        state: 'READY_FOR_HUMAN_APPROVAL',
        baselineAdvanceEligible: true,
        policyMutationAllowed: false,
        requiresHumanApproval: true,
        requiresSeparatePolicyPr: true,
        upstream: driftReport.upstream,
        observedAt: driftReport.observedAt,
        fromBaselineSha: driftReport.baselineSha,
        toBaselineSha: driftReport.headSha,
        toBaselineDate: driftReport.headDate || null,
        toBaselineMessage: driftReport.headMessage || null,
        decisionCounts: countDecisions(resolved),
        implementationCommits: uniqueImplementationCommits(resolved),
        resolvedDecisions: Object.freeze(resolved.map((item) => Object.freeze({ ...item }))),
        errors: Object.freeze([]),
    });
}

export function validateUpstreamBaselineAdvanceProposal(proposal) {
    const errors = [];
    if (!proposal || typeof proposal !== 'object') {
        return Object.freeze({ valid: false, errors: Object.freeze(['proposal is required']) });
    }

    if (proposal.state !== 'READY_FOR_HUMAN_APPROVAL') {
        errors.push('proposal state must be READY_FOR_HUMAN_APPROVAL');
    }
    if (proposal.baselineAdvanceEligible !== true) {
        errors.push('proposal must be baseline-advance eligible');
    }
    if (proposal.policyMutationAllowed !== false) {
        errors.push('proposal cannot authorize policy mutation');
    }
    if (proposal.requiresHumanApproval !== true) {
        errors.push('proposal must require human approval');
    }
    if (proposal.requiresSeparatePolicyPr !== true) {
        errors.push('proposal must require a separate policy PR');
    }
    if (!proposal.fromBaselineSha || !proposal.toBaselineSha) {
        errors.push('from/to baseline SHAs are required');
    }
    if (proposal.fromBaselineSha === proposal.toBaselineSha) {
        errors.push('from/to baseline SHAs must differ');
    }
    if (!Array.isArray(proposal.resolvedDecisions) || proposal.resolvedDecisions.length === 0) {
        errors.push('resolved decisions are required');
    }

    return Object.freeze({
        valid: errors.length === 0,
        errors: Object.freeze(errors),
    });
}

export function formatUpstreamBaselineAdvanceProposalMarkdown(proposal) {
    if (!proposal?.valid) {
        const errors = Array.isArray(proposal?.errors) ? proposal.errors : ['invalid proposal'];
        return [
            '# ORBI Upstream Baseline Advancement Proposal',
            '',
            '- State: **BLOCKED**',
            '- Policy mutation: **FORBIDDEN**',
            '',
            '## Blocking reasons',
            '',
            ...errors.map((error) => `- ${error}`),
            '',
        ].join('\n');
    }

    return [
        '# ORBI Upstream Baseline Advancement Proposal',
        '',
        `- From baseline: \`${proposal.fromBaselineSha}\``,
        `- To baseline: \`${proposal.toBaselineSha}\``,
        `- Upstream date: ${proposal.toBaselineDate || 'unknown'}`,
        `- Upstream message: ${proposal.toBaselineMessage || 'unknown'}`,
        `- State: **${proposal.state}**`,
        '- Human approval: **REQUIRED**',
        '- Separate policy PR: **REQUIRED**',
        '- Policy mutation by this proposal: **FORBIDDEN**',
        '',
        '## Decisions',
        '',
        `- ADOPT: ${proposal.decisionCounts.ADOPT}`,
        `- ADAPT: ${proposal.decisionCounts.ADAPT}`,
        `- REJECT: ${proposal.decisionCounts.REJECT}`,
        '',
        '## Verified ORBI implementation commits',
        '',
        ...(proposal.implementationCommits.length
            ? proposal.implementationCommits.map((sha) => `- \`${sha}\``)
            : ['- None required by the resolved decisions.']),
        '',
    ].join('\n');
}
