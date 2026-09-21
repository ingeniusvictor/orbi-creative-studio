export const UPSTREAM_REVIEW_DECISION = Object.freeze({
    ADOPT: 'ADOPT',
    ADAPT: 'ADAPT',
    REJECT: 'REJECT',
});

export const UPSTREAM_REVIEW_STATUS = Object.freeze({
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
});

export const UPSTREAM_IMPLEMENTATION_STATUS = Object.freeze({
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

function reviewTemplate(entry) {
    const reviews = {};
    for (const review of entry.requiredReviews || []) {
        reviews[review] = UPSTREAM_REVIEW_STATUS.PENDING;
    }

    return Object.freeze({
        path: entry.path,
        decision: null,
        rationale: null,
        reviews: Object.freeze(reviews),
        implementation: Object.freeze({
            status: UPSTREAM_IMPLEMENTATION_STATUS.PENDING,
            orbiCommitSha: null,
        }),
    });
}

export function buildUpstreamReviewDecisionTemplate(manifest) {
    if (!manifest || typeof manifest !== 'object') {
        throw new TypeError('Adoption manifest is required');
    }

    const decisions = (Array.isArray(manifest.entries) ? manifest.entries : []).map(reviewTemplate);

    return Object.freeze({
        schemaVersion: 1,
        baselineSha: manifest.baselineSha,
        headSha: manifest.headSha,
        state: decisions.length === 0 ? 'NO_DRIFT' : 'AWAITING_DECISIONS',
        sourceMutationAllowed: false,
        baselineAdvanceAuthorized: false,
        decisions: Object.freeze(decisions),
    });
}

function normalizedDecisionMap(submission) {
    const map = new Map();
    const errors = [];
    for (const item of Array.isArray(submission?.decisions) ? submission.decisions : []) {
        if (!item || typeof item.path !== 'string' || !item.path) {
            errors.push('decision path is required');
            continue;
        }
        if (map.has(item.path)) {
            errors.push(`${item.path}: duplicate decision`);
            continue;
        }
        map.set(item.path, item);
    }
    return { map, errors };
}

export function evaluateUpstreamReviewDecisions(manifest, submission) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object') {
        return Object.freeze({ valid: false, baselineAdvanceEligible: false, state: 'INVALID', errors: Object.freeze(['manifest is required']) });
    }
    if (!submission || typeof submission !== 'object') {
        return Object.freeze({ valid: false, baselineAdvanceEligible: false, state: 'INVALID', errors: Object.freeze(['decision submission is required']) });
    }

    if (submission.baselineSha !== manifest.baselineSha) errors.push('baseline SHA mismatch');
    if (submission.headSha !== manifest.headSha) errors.push('upstream head SHA mismatch');

    const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
    if (entries.length === 0) {
        return Object.freeze({
            valid: errors.length === 0,
            baselineAdvanceEligible: false,
            state: errors.length === 0 ? 'NO_DRIFT' : 'INVALID',
            errors: Object.freeze(errors),
            resolved: Object.freeze([]),
            sourceMutationAllowed: false,
        });
    }

    const normalized = normalizedDecisionMap(submission);
    errors.push(...normalized.errors);

    const manifestPaths = new Set(entries.map((entry) => entry.path));
    for (const path of normalized.map.keys()) {
        if (!manifestPaths.has(path)) errors.push(`${path}: decision does not belong to manifest`);
    }

    const resolved = [];

    for (const entry of entries) {
        const decision = normalized.map.get(entry.path);
        if (!decision) {
            errors.push(`${entry.path}: final decision is required`);
            continue;
        }

        if (!Object.values(UPSTREAM_REVIEW_DECISION).includes(decision.decision)) {
            errors.push(`${entry.path}: decision must be ADOPT, ADAPT, or REJECT`);
        }

        if (typeof decision.rationale !== 'string' || !decision.rationale.trim()) {
            errors.push(`${entry.path}: rationale is required`);
        }

        for (const review of entry.requiredReviews || []) {
            if (decision.reviews?.[review] !== UPSTREAM_REVIEW_STATUS.APPROVED) {
                errors.push(`${entry.path}: ${review} review is not approved`);
            }
        }

        if (decision.decision === UPSTREAM_REVIEW_DECISION.ADOPT && !entry.directAdoptionCandidate) {
            errors.push(`${entry.path}: direct ADOPT is not permitted for this entry`);
        }

        const implementation = decision.implementation || {};
        if (
            decision.decision === UPSTREAM_REVIEW_DECISION.ADOPT
            || decision.decision === UPSTREAM_REVIEW_DECISION.ADAPT
        ) {
            if (implementation.status !== UPSTREAM_IMPLEMENTATION_STATUS.VERIFIED) {
                errors.push(`${entry.path}: implementation must be VERIFIED before baseline advancement`);
            }
            if (!COMMIT_SHA.test(implementation.orbiCommitSha || '')) {
                errors.push(`${entry.path}: verified ORBI commit SHA is required`);
            }
        }

        if (decision.decision === UPSTREAM_REVIEW_DECISION.REJECT) {
            if (implementation.status !== UPSTREAM_IMPLEMENTATION_STATUS.NOT_APPLICABLE) {
                errors.push(`${entry.path}: rejected change must use NOT_APPLICABLE implementation status`);
            }
        }

        resolved.push(Object.freeze({
            path: entry.path,
            decision: decision.decision,
            rationale: typeof decision.rationale === 'string' ? decision.rationale.trim() : '',
            reviews: Object.freeze({ ...(decision.reviews || {}) }),
            implementation: Object.freeze({
                status: implementation.status || null,
                orbiCommitSha: implementation.orbiCommitSha || null,
            }),
        }));
    }

    const valid = errors.length === 0 && resolved.length === entries.length;
    return Object.freeze({
        valid,
        baselineAdvanceEligible: valid,
        state: valid ? 'REVIEW_COMPLETE' : 'REVIEW_INCOMPLETE',
        errors: Object.freeze(errors),
        resolved: Object.freeze(resolved),
        sourceMutationAllowed: false,
    });
}

export function formatUpstreamReviewTemplateMarkdown(template) {
    const lines = [
        '# ORBI Upstream Review Decision Template',
        '',
        `- Baseline: \`${template.baselineSha}\``,
        `- Upstream head: \`${template.headSha || 'unknown'}\``,
        `- State: **${template.state}**`,
        '- Source mutation: **FORBIDDEN**',
        '- Baseline advancement: **NOT AUTHORIZED BY THIS TEMPLATE**',
        '',
        '## Decisions',
        '',
    ];

    if (template.decisions.length === 0) {
        lines.push('- No drift; no decisions are required.');
    } else {
        for (const item of template.decisions) {
            const reviews = Object.keys(item.reviews).map((review) => `\`${review}\``).join(', ');
            lines.push(`- \`${item.path}\` — decision pending; required reviews: ${reviews || 'none'}`);
        }
    }

    return `${lines.join('\n')}\n`;
}
