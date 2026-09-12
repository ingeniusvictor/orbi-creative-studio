function finiteTimestamp(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        const error = new Error(`${label} must be a positive finite timestamp`);
        error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
        throw error;
    }
    return number;
}

function freezeArray(values) {
    return Object.freeze(values.map((value) => (
        value && typeof value === 'object' ? Object.freeze({ ...value }) : value
    )));
}

function summarizeEvidenceByRoute(evidence = []) {
    if (!Array.isArray(evidence)) {
        const error = new Error('evidence must be an array');
        error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
        throw error;
    }

    const routes = new Map();

    for (const item of evidence) {
        if (!item || typeof item !== 'object') {
            const error = new Error('evidence entries must be objects');
            error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
            throw error;
        }

        const routeKey = String(item.routeKey || '').trim();
        const expectedProviderId = String(item.expectedProviderId || '').trim();
        const operation = String(item.operation || '').trim();
        const modelId = String(item.modelId || '').trim();
        const parity = String(item.parity || '').trim();
        const observedAt = finiteTimestamp(item.observedAt, 'evidence.observedAt');

        if (!routeKey || !expectedProviderId || !operation || !modelId) {
            const error = new Error('evidence route identity is incomplete');
            error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
            throw error;
        }

        if (!['match', 'blocked', 'mismatch'].includes(parity)) {
            const error = new Error(`unsupported parity state: ${parity}`);
            error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
            throw error;
        }

        let route = routes.get(routeKey);
        if (!route) {
            route = {
                routeKey,
                expectedProviderId,
                operation,
                samples: 0,
                matches: 0,
                blocked: 0,
                mismatches: 0,
                modelIds: new Set(),
                firstObservedAt: observedAt,
                lastObservedAt: observedAt,
                latestParity: parity,
            };
            routes.set(routeKey, route);
        }

        if (
            route.expectedProviderId !== expectedProviderId
            || route.operation !== operation
        ) {
            const error = new Error(`route identity collision: ${routeKey}`);
            error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
            throw error;
        }

        route.samples += 1;
        route.modelIds.add(modelId);
        if (parity === 'match') route.matches += 1;
        else if (parity === 'blocked') route.blocked += 1;
        else route.mismatches += 1;

        if (observedAt < route.firstObservedAt) route.firstObservedAt = observedAt;
        if (observedAt >= route.lastObservedAt) {
            route.lastObservedAt = observedAt;
            route.latestParity = parity;
        }
    }

    return Object.freeze([...routes.values()]
        .sort((a, b) => a.routeKey.localeCompare(b.routeKey))
        .map((route) => Object.freeze({
            routeKey: route.routeKey,
            expectedProviderId: route.expectedProviderId,
            operation: route.operation,
            samples: route.samples,
            matches: route.matches,
            blocked: route.blocked,
            mismatches: route.mismatches,
            distinctModels: route.modelIds.size,
            modelIds: Object.freeze([...route.modelIds].sort()),
            firstObservedAt: route.firstObservedAt,
            lastObservedAt: route.lastObservedAt,
            latestParity: route.latestParity,
        })));
}

function diagnosticStatus(route) {
    if (route.certified === true) return 'certified';
    if (Number(route.mismatches) > 0) return 'mismatch';
    if (Number(route.blocked) > 0) return 'blocked';

    const reasons = Array.isArray(route.reasons) ? route.reasons : [];
    if (reasons.some((reason) => String(reason).startsWith('samples:'))) {
        return 'insufficient-samples';
    }
    if (reasons.some((reason) => String(reason).startsWith('models:'))) {
        return 'insufficient-model-coverage';
    }
    return 'not-certified';
}

function buildParityDiagnosticReport({
    evidence = [],
    certification,
    generatedAt = Date.now(),
} = {}) {
    const timestamp = finiteTimestamp(generatedAt, 'generatedAt');
    if (!certification || typeof certification !== 'object' || Array.isArray(certification)) {
        const error = new Error('certification result is required');
        error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
        throw error;
    }

    const observedRoutes = summarizeEvidenceByRoute(evidence);
    const observedByKey = new Map(observedRoutes.map((route) => [route.routeKey, route]));
    const certificationRoutes = Array.isArray(certification.routes) ? certification.routes : [];

    const targets = certificationRoutes.map((route) => {
        const observed = observedByKey.get(route.routeKey);
        const reasons = Array.isArray(route.reasons)
            ? Object.freeze(route.reasons.map((reason) => String(reason)))
            : Object.freeze([]);

        const diagnostic = Object.freeze({
            routeKey: String(route.routeKey || ''),
            expectedProviderId: String(route.expectedProviderId || ''),
            operation: String(route.operation || ''),
            minSamples: Number(route.minSamples) || 0,
            minDistinctModels: Number(route.minDistinctModels) || 0,
            samples: Number(route.samples) || 0,
            matches: Number(route.matches) || 0,
            blocked: Number(route.blocked) || 0,
            mismatches: Number(route.mismatches) || 0,
            distinctModels: Number(route.distinctModels) || 0,
            modelIds: Object.freeze(Array.isArray(route.modelIds) ? [...route.modelIds] : []),
            firstObservedAt: observed?.firstObservedAt,
            lastObservedAt: observed?.lastObservedAt,
            latestParity: observed?.latestParity,
            certified: route.certified === true,
            reasons,
        });

        return Object.freeze({
            ...diagnostic,
            status: diagnosticStatus(diagnostic),
        });
    });

    const totals = observedRoutes.reduce((summary, route) => {
        summary.samples += route.samples;
        summary.matches += route.matches;
        summary.blocked += route.blocked;
        summary.mismatches += route.mismatches;
        return summary;
    }, {
        samples: 0,
        matches: 0,
        blocked: 0,
        mismatches: 0,
    });

    return Object.freeze({
        schemaVersion: 1,
        generatedAt: timestamp,
        certification: Object.freeze({
            certified: certification.certified === true,
            reason: String(certification.reason || 'UNKNOWN'),
            maxEvidenceAgeMs: Number(certification.maxEvidenceAgeMs) || undefined,
            maxFutureSkewMs: Number(certification.maxFutureSkewMs) || undefined,
            targetCount: targets.length,
        }),
        totals: Object.freeze({
            observedRoutes: observedRoutes.length,
            samples: totals.samples,
            matches: totals.matches,
            blocked: totals.blocked,
            mismatches: totals.mismatches,
        }),
        targets: Object.freeze(targets),
        observedRoutes,
    });
}

function iso(timestamp) {
    return Number.isFinite(Number(timestamp))
        ? new Date(Number(timestamp)).toISOString()
        : 'n/a';
}

function formatParityDiagnosticText(report) {
    if (!report || typeof report !== 'object') {
        const error = new Error('diagnostic report is required');
        error.code = 'INVALID_PARITY_DIAGNOSTIC_INPUT';
        throw error;
    }

    const lines = [
        'ORBI Compute Router — Parity Diagnostic Report',
        `Generated: ${iso(report.generatedAt)}`,
        `Certification: ${report.certification?.certified ? 'CERTIFIED' : 'NOT CERTIFIED'} (${report.certification?.reason || 'UNKNOWN'})`,
        `Observed: ${report.totals?.samples || 0} samples across ${report.totals?.observedRoutes || 0} routes`,
        `Parity totals: ${report.totals?.matches || 0} match / ${report.totals?.blocked || 0} blocked / ${report.totals?.mismatches || 0} mismatch`,
        '',
        'Certification targets:',
    ];

    const targets = Array.isArray(report.targets) ? report.targets : [];
    if (!targets.length) {
        lines.push('- none');
    } else {
        for (const route of targets) {
            lines.push(
                `- ${route.routeKey}: ${String(route.status || 'unknown').toUpperCase()}`,
                `  samples ${route.samples}/${route.minSamples}; models ${route.distinctModels}/${route.minDistinctModels}; match ${route.matches}; blocked ${route.blocked}; mismatch ${route.mismatches}`,
                `  latest ${route.latestParity || 'n/a'} at ${iso(route.lastObservedAt)}`,
                `  models: ${route.modelIds?.length ? route.modelIds.join(', ') : 'none'}`,
                `  reasons: ${route.reasons?.length ? route.reasons.join(', ') : 'none'}`,
            );
        }
    }

    lines.push('', 'Observed routes:');
    const observedRoutes = Array.isArray(report.observedRoutes) ? report.observedRoutes : [];
    if (!observedRoutes.length) {
        lines.push('- none');
    } else {
        for (const route of observedRoutes) {
            lines.push(
                `- ${route.routeKey}: samples ${route.samples}; match ${route.matches}; blocked ${route.blocked}; mismatch ${route.mismatches}; models ${route.distinctModels}`,
                `  window: ${iso(route.firstObservedAt)} → ${iso(route.lastObservedAt)}; latest: ${route.latestParity}`,
            );
        }
    }

    return lines.join('\n');
}

export {
    buildParityDiagnosticReport,
    diagnosticStatus,
    formatParityDiagnosticText,
    summarizeEvidenceByRoute,
};
