export const UPSTREAM_ADOPTION_DECISION = Object.freeze({
    PENDING_REVIEW: 'PENDING_REVIEW',
    ADOPT: 'ADOPT',
    ADAPT: 'ADAPT',
    REJECT: 'REJECT',
});

const REVIEW = Object.freeze({
    TECHNICAL: 'TECHNICAL',
    SECURITY: 'SECURITY',
    LICENSE: 'LICENSE',
    PRODUCT: 'PRODUCT',
});

function unique(values) {
    return [...new Set(values)];
}

function requiredReviewsFor(file) {
    const reviews = [REVIEW.TECHNICAL];

    if (file.triageAction === 'SECURITY_REVIEW' || file.triageKind === 'SECURITY') {
        reviews.push(REVIEW.SECURITY);
    }
    if (file.triageKind === 'NEW_MODEL') {
        reviews.push(REVIEW.LICENSE, REVIEW.PRODUCT);
    }
    if (file.triageKind === 'UI') {
        reviews.push(REVIEW.PRODUCT);
    }
    if (file.triageKind === 'DOCUMENTATION') {
        return [REVIEW.TECHNICAL];
    }

    return unique(reviews);
}

function directAdoptionCandidate(file) {
    return file.classification === 'UPSTREAM_CANDIDATE'
        && file.triageAction === 'CANDIDATE_REVIEW'
        && file.triageKind !== 'SECURITY'
        && file.triageKind !== 'ORBI_CONFLICT';
}

function entryFor(file, headSha) {
    return Object.freeze({
        path: file.path,
        upstreamHeadSha: headSha,
        authorityClass: file.classification,
        triageKind: file.triageKind,
        triageAction: file.triageAction,
        decision: UPSTREAM_ADOPTION_DECISION.PENDING_REVIEW,
        requiredReviews: Object.freeze(requiredReviewsFor(file)),
        directAdoptionCandidate: directAdoptionCandidate(file),
        automaticAdoptionAllowed: false,
        sourceMutationAllowed: false,
        baselineAdvanceEligible: false,
    });
}

export function buildUpstreamAdoptionManifest(triageReport) {
    if (!triageReport || typeof triageReport !== 'object') {
        throw new TypeError('Triage report is required');
    }

    const entries = (Array.isArray(triageReport.files) ? triageReport.files : [])
        .map((file) => entryFor(file, triageReport.headSha));

    return Object.freeze({
        schemaVersion: 1,
        upstream: triageReport.upstream,
        observedAt: triageReport.observedAt,
        baselineSha: triageReport.baselineSha,
        headSha: triageReport.headSha,
        hasDrift: Boolean(triageReport.hasDrift),
        state: entries.length === 0 ? 'NO_DRIFT' : 'REVIEW_REQUIRED',
        automaticAdoptionAllowed: false,
        sourceMutationAllowed: false,
        baselineAdvanceEligible: false,
        entries: Object.freeze(entries),
    });
}

export function validateUpstreamAdoptionManifest(manifest) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object') {
        return Object.freeze({ valid: false, errors: Object.freeze(['manifest is required']) });
    }

    if (manifest.automaticAdoptionAllowed !== false) {
        errors.push('automatic adoption must remain disabled');
    }
    if (manifest.sourceMutationAllowed !== false) {
        errors.push('source mutation must remain disabled');
    }
    if (manifest.baselineAdvanceEligible !== false) {
        errors.push('baseline advancement must remain disabled at manifest creation');
    }

    for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
        if (!entry.path) errors.push('entry path is required');
        if (entry.upstreamHeadSha !== manifest.headSha) {
            errors.push(`${entry.path || '<unknown>'}: upstream head mismatch`);
        }
        if (entry.decision !== UPSTREAM_ADOPTION_DECISION.PENDING_REVIEW) {
            errors.push(`${entry.path || '<unknown>'}: generated decision must be PENDING_REVIEW`);
        }
        if (entry.automaticAdoptionAllowed !== false || entry.sourceMutationAllowed !== false) {
            errors.push(`${entry.path || '<unknown>'}: generated entry cannot authorize mutation`);
        }
        if (entry.baselineAdvanceEligible !== false) {
            errors.push(`${entry.path || '<unknown>'}: generated entry cannot authorize baseline advancement`);
        }
        if (entry.authorityClass === 'ORBI_OWNED' && entry.directAdoptionCandidate) {
            errors.push(`${entry.path || '<unknown>'}: ORBI-owned path cannot be a direct adoption candidate`);
        }
        if (!Array.isArray(entry.requiredReviews) || entry.requiredReviews.length === 0) {
            errors.push(`${entry.path || '<unknown>'}: at least one review is required`);
        }
    }

    return Object.freeze({
        valid: errors.length === 0,
        errors: Object.freeze(errors),
    });
}

export function formatUpstreamAdoptionManifestMarkdown(manifest) {
    const lines = [
        '# ORBI Upstream Adoption Manifest',
        '',
        `- Baseline: \`${manifest.baselineSha}\``,
        `- Upstream head: \`${manifest.headSha || 'unknown'}\``,
        `- State: **${manifest.state}**`,
        '- Automatic adoption: **FORBIDDEN**',
        '- Source mutation: **FORBIDDEN**',
        '- Baseline advancement: **NOT ELIGIBLE**',
        '',
        '## Review entries',
        '',
    ];

    if (manifest.entries.length === 0) {
        lines.push('- No drift; no adoption entries were created.');
    } else {
        for (const entry of manifest.entries) {
            lines.push(
                `- \`${entry.path}\` — decision \`${entry.decision}\`; authority \`${entry.authorityClass}\`; triage \`${entry.triageKind}\`; reviews ${entry.requiredReviews.map((review) => `\`${review}\``).join(', ')}; direct candidate **${entry.directAdoptionCandidate ? 'YES' : 'NO'}**`,
            );
        }
    }

    return `${lines.join('\n')}\n`;
}
