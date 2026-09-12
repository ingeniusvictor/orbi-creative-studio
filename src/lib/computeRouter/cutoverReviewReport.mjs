const CUTOVER_REVIEW_REPORT_SCHEMA_VERSION = 1;

function positiveTimestamp(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        const error = new Error(`${label} must be a positive finite timestamp`);
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }
    return number;
}

function requireAssessment(assessment) {
    if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
        const error = new Error('cutover eligibility assessment is required');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    if (assessment.schemaVersion !== 1) {
        const error = new Error('unsupported cutover eligibility schema version');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    if (assessment.cutoverAuthorized !== false) {
        const error = new Error('cutover review only accepts non-authorizing assessments');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    if (assessment.executionAuthority !== 'legacy-dispatcher-only') {
        const error = new Error('cutover review requires legacy dispatcher execution authority');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    if (!Array.isArray(assessment.routes)) {
        const error = new Error('assessment routes must be an array');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    return assessment;
}

function globalBlockers(assessment) {
    const blockers = [];

    if (assessment.profileMatches !== true) blockers.push('certification-profile');
    if (assessment.certificationSchemaValid !== true) blockers.push('certification-schema');
    if (assessment.certificationFreshnessStrict !== true) blockers.push('certification-freshness');
    if (assessment.certificationGloballyCertified !== true) blockers.push('parity-certification');

    for (const key of Array.isArray(assessment.duplicateCertificationRoutes)
        ? assessment.duplicateCertificationRoutes
        : []) {
        blockers.push(`duplicate-certification-route:${key}`);
    }

    for (const providerId of Array.isArray(assessment.duplicateProviders)
        ? assessment.duplicateProviders
        : []) {
        blockers.push(`duplicate-provider:${providerId}`);
    }

    for (const gate of Array.isArray(assessment.missingReleaseGates)
        ? assessment.missingReleaseGates
        : []) {
        blockers.push(`release-gate:${gate}`);
    }

    return Object.freeze(blockers);
}

function normalizeRoute(route) {
    if (!route || typeof route !== 'object' || Array.isArray(route)) {
        const error = new Error('route review entry must be an object');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    const routeKey = typeof route.routeKey === 'string' ? route.routeKey.trim() : '';
    if (!routeKey) {
        const error = new Error('routeKey is required');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    const reasons = Array.isArray(route.reasons)
        ? Object.freeze(route.reasons.map((reason) => String(reason)))
        : Object.freeze([]);

    return Object.freeze({
        routeKey,
        expectedProviderId: String(route.expectedProviderId || ''),
        operation: String(route.operation || ''),
        eligibleForCutoverReview: route.eligibleForCutoverReview === true,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        certifiedModelIds: Object.freeze(Array.isArray(route.certifiedModelIds)
            ? [...route.certifiedModelIds]
            : []),
        reasons,
    });
}

function buildCutoverReviewReport({
    assessment,
    generatedAt = Date.now(),
} = {}) {
    const input = requireAssessment(assessment);
    const timestamp = positiveTimestamp(generatedAt, 'generatedAt');

    const routes = Object.freeze(input.routes.map(normalizeRoute));
    const blockers = globalBlockers(input);
    const routeBlockerCount = routes.reduce(
        (count, route) => count + (route.eligibleForCutoverReview ? 0 : 1),
        0,
    );
    const eligibleRouteCount = routes.length - routeBlockerCount;

    const readyForReview = Boolean(
        input.eligibleForCutoverReview === true
        && blockers.length === 0
        && routeBlockerCount === 0
    );

    return Object.freeze({
        schemaVersion: CUTOVER_REVIEW_REPORT_SCHEMA_VERSION,
        generatedAt: timestamp,
        profileId: String(input.profileId || ''),
        requestedProfileId: String(input.requestedProfileId || ''),
        reviewStatus: readyForReview ? 'READY_FOR_REVIEW' : 'BLOCKED',
        readyForReview,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        globalBlockers: blockers,
        summary: Object.freeze({
            routeCount: routes.length,
            eligibleRouteCount,
            blockedRouteCount: routeBlockerCount,
            missingReleaseGateCount: Array.isArray(input.missingReleaseGates)
                ? input.missingReleaseGates.length
                : 0,
        }),
        releaseGates: Object.freeze({ ...(input.releaseGates || {}) }),
        routes,
    });
}

function iso(timestamp) {
    return Number.isFinite(Number(timestamp))
        ? new Date(Number(timestamp)).toISOString()
        : 'n/a';
}

function formatCutoverReviewText(report) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
        const error = new Error('cutover review report is required');
        error.code = 'INVALID_CUTOVER_REVIEW_INPUT';
        throw error;
    }

    const lines = [
        'ORBI Compute Router — Cutover Review Report',
        `Generated: ${iso(report.generatedAt)}`,
        `Status: ${report.reviewStatus || 'BLOCKED'}`,
        `Execution authority: ${report.executionAuthority || 'legacy-dispatcher-only'}`,
        `Cutover authorized: ${report.cutoverAuthorized === true ? 'YES' : 'NO'}`,
        `Routes: ${report.summary?.eligibleRouteCount || 0}/${report.summary?.routeCount || 0} eligible for review`,
        '',
        'Global blockers:',
    ];

    if (report.globalBlockers?.length) {
        for (const blocker of report.globalBlockers) lines.push(`- ${blocker}`);
    } else {
        lines.push('- none');
    }

    lines.push('', 'Release gates:');
    const gateEntries = Object.entries(report.releaseGates || {}).sort(([a], [b]) => a.localeCompare(b));
    if (!gateEntries.length) {
        lines.push('- none');
    } else {
        for (const [gate, value] of gateEntries) {
            lines.push(`- ${gate}: ${value === true ? 'PASS' : 'BLOCKED'}`);
        }
    }

    lines.push('', 'Route review:');
    const routes = Array.isArray(report.routes) ? report.routes : [];
    if (!routes.length) {
        lines.push('- none');
    } else {
        for (const route of routes) {
            lines.push(
                `- ${route.routeKey}: ${route.eligibleForCutoverReview ? 'ELIGIBLE' : 'BLOCKED'}`,
                `  models: ${route.certifiedModelIds?.length ? route.certifiedModelIds.join(', ') : 'none'}`,
                `  reasons: ${route.reasons?.length ? route.reasons.join(', ') : 'none'}`,
            );
        }
    }

    return lines.join('\n');
}

export {
    CUTOVER_REVIEW_REPORT_SCHEMA_VERSION,
    buildCutoverReviewReport,
    formatCutoverReviewText,
};
