const DEFAULT_MIN_SAMPLES_PER_ROUTE = 10;
const DEFAULT_MIN_DISTINCT_MODELS = 1;
const DEFAULT_MAX_EVIDENCE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_FUTURE_SKEW_MS = 60 * 1000;

const VALID_PROVIDER_IDS = new Set(['sdcpp-device', 'wan2gp-lan', 'muapi-cloud']);
const VALID_PARITY = new Set(['match', 'blocked', 'mismatch']);
const VALID_OPERATIONS = new Set(['t2i', 'i2i', 't2v', 'i2v', 'v2v', 'lipsync', 'audio']);

function nonEmptyString(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        const error = new Error(`${label} must be a non-empty string`);
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }
    return value.trim();
}

function positiveInteger(value, label, fallback) {
    if (value == null) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) {
        const error = new Error(`${label} must be a positive integer`);
        error.code = 'INVALID_CERTIFICATION_TARGET';
        throw error;
    }
    return number;
}

function routeKey(providerId, operation) {
    return `${nonEmptyString(providerId, 'providerId')}:${nonEmptyString(operation, 'operation')}`;
}

function normalizeEvidence(report, observedAt = Date.now()) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
        const error = new Error('shadow report must be an object');
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }
    if (report.mode !== 'shadow-only') {
        const error = new Error('only shadow-only reports may enter parity certification');
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }

    const operation = nonEmptyString(report.operation, 'operation');
    if (!VALID_OPERATIONS.has(operation)) {
        const error = new Error(`unsupported operation: ${operation}`);
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }

    const expectedProviderId = nonEmptyString(report.expectedProviderId, 'expectedProviderId');
    if (!VALID_PROVIDER_IDS.has(expectedProviderId)) {
        const error = new Error(`unsupported expected provider: ${expectedProviderId}`);
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }
    const modelId = nonEmptyString(report.modelId, 'modelId');
    const parity = nonEmptyString(report.parity, 'parity');
    if (!VALID_PARITY.has(parity)) {
        const error = new Error(`unsupported parity state: ${parity}`);
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }

    const selectedProviderId = report.selectedProviderId == null
        ? null
        : nonEmptyString(report.selectedProviderId, 'selectedProviderId');
    if (selectedProviderId && !VALID_PROVIDER_IDS.has(selectedProviderId)) {
        const error = new Error(`unsupported selected provider: ${selectedProviderId}`);
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }

    const timestamp = Number(observedAt);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        const error = new Error('observedAt must be a positive finite timestamp');
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }

    if (parity === 'match' && selectedProviderId !== expectedProviderId) {
        const error = new Error('match evidence must select the expected provider');
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }
    if (parity === 'blocked' && selectedProviderId !== null) {
        const error = new Error('blocked evidence must not select a provider');
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }
    if (parity === 'mismatch' && (!selectedProviderId || selectedProviderId === expectedProviderId)) {
        const error = new Error('mismatch evidence must select a different provider');
        error.code = 'INVALID_PARITY_EVIDENCE';
        throw error;
    }

    return Object.freeze({
        routeKey: routeKey(expectedProviderId, operation),
        expectedProviderId,
        selectedProviderId,
        operation,
        modelId,
        parity,
        observedAt: timestamp,
    });
}

function normalizeTarget(target = {}) {
    const expectedProviderId = nonEmptyString(target.expectedProviderId, 'expectedProviderId');
    if (!VALID_PROVIDER_IDS.has(expectedProviderId)) {
        const error = new Error(`unsupported target provider: ${expectedProviderId}`);
        error.code = 'INVALID_CERTIFICATION_TARGET';
        throw error;
    }
    const operation = nonEmptyString(target.operation, 'operation');
    if (!VALID_OPERATIONS.has(operation)) {
        const error = new Error(`unsupported target operation: ${operation}`);
        error.code = 'INVALID_CERTIFICATION_TARGET';
        throw error;
    }

    return Object.freeze({
        routeKey: routeKey(expectedProviderId, operation),
        expectedProviderId,
        operation,
        minSamples: positiveInteger(
            target.minSamples,
            'minSamples',
            DEFAULT_MIN_SAMPLES_PER_ROUTE,
        ),
        minDistinctModels: positiveInteger(
            target.minDistinctModels,
            'minDistinctModels',
            DEFAULT_MIN_DISTINCT_MODELS,
        ),
    });
}

function summarizeRoute(evidence) {
    const models = new Set();
    let matches = 0;
    let blocked = 0;
    let mismatches = 0;

    for (const item of evidence) {
        models.add(item.modelId);
        if (item.parity === 'match') matches += 1;
        else if (item.parity === 'blocked') blocked += 1;
        else if (item.parity === 'mismatch') mismatches += 1;
    }

    return Object.freeze({
        samples: evidence.length,
        matches,
        blocked,
        mismatches,
        distinctModels: models.size,
        modelIds: Object.freeze([...models].sort()),
    });
}

function evaluateTarget(target, evidence) {
    const routeEvidence = evidence.filter((item) => item.routeKey === target.routeKey);
    const summary = summarizeRoute(routeEvidence);
    const reasons = [];

    if (summary.samples < target.minSamples) {
        reasons.push(`samples:${summary.samples}/${target.minSamples}`);
    }
    if (summary.distinctModels < target.minDistinctModels) {
        reasons.push(`models:${summary.distinctModels}/${target.minDistinctModels}`);
    }
    if (summary.blocked > 0) reasons.push(`blocked:${summary.blocked}`);
    if (summary.mismatches > 0) reasons.push(`mismatch:${summary.mismatches}`);
    if (summary.matches !== summary.samples) reasons.push('non-match-evidence');

    return Object.freeze({
        ...target,
        ...summary,
        certified: reasons.length === 0,
        reasons: Object.freeze(reasons),
    });
}

function createParityCertificationLedger({
    maxEvidenceAgeMs = DEFAULT_MAX_EVIDENCE_AGE_MS,
    maxFutureSkewMs = DEFAULT_MAX_FUTURE_SKEW_MS,
    now = Date.now,
} = {}) {
    const maxAge = Number(maxEvidenceAgeMs);
    if (!Number.isFinite(maxAge) || maxAge <= 0) {
        throw new TypeError('maxEvidenceAgeMs must be a positive finite number');
    }
    const futureSkew = Number(maxFutureSkewMs);
    if (!Number.isFinite(futureSkew) || futureSkew < 0) {
        throw new TypeError('maxFutureSkewMs must be a non-negative finite number');
    }
    if (typeof now !== 'function') {
        throw new TypeError('now must be a function');
    }

    const entries = [];

    function prune(referenceNow = now()) {
        const cutoff = referenceNow - maxAge;
        let write = 0;
        for (let read = 0; read < entries.length; read += 1) {
            if (entries[read].observedAt >= cutoff) {
                entries[write] = entries[read];
                write += 1;
            }
        }
        entries.length = write;
    }

    function record(report, { observedAt = now() } = {}) {
        const referenceNow = now();
        const evidence = normalizeEvidence(report, observedAt);
        if (evidence.observedAt > referenceNow + futureSkew) {
            const error = new Error('parity evidence timestamp is too far in the future');
            error.code = 'INVALID_PARITY_EVIDENCE';
            throw error;
        }
        entries.push(evidence);
        prune(referenceNow);
        return evidence;
    }

    function evaluate(targets = []) {
        if (!Array.isArray(targets) || targets.length === 0) {
            return Object.freeze({
                schemaVersion: 1,
                certified: false,
                reason: 'NO_CERTIFICATION_TARGETS',
                maxEvidenceAgeMs: maxAge,
                maxFutureSkewMs: futureSkew,
                routes: Object.freeze([]),
            });
        }

        prune(now());
        const normalizedTargets = targets.map(normalizeTarget);
        const seen = new Set();
        for (const target of normalizedTargets) {
            if (seen.has(target.routeKey)) {
                const error = new Error(`duplicate certification target: ${target.routeKey}`);
                error.code = 'INVALID_CERTIFICATION_TARGET';
                throw error;
            }
            seen.add(target.routeKey);
        }

        const routes = normalizedTargets.map((target) => evaluateTarget(target, entries));
        return Object.freeze({
            schemaVersion: 1,
            certified: routes.every((route) => route.certified),
            reason: routes.every((route) => route.certified)
                ? 'PARITY_CERTIFIED'
                : 'PARITY_NOT_CERTIFIED',
            maxEvidenceAgeMs: maxAge,
                maxFutureSkewMs: futureSkew,
            routes: Object.freeze(routes),
        });
    }

    function snapshot() {
        prune(now());
        return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
    }

    function clear() {
        entries.length = 0;
    }

    return Object.freeze({
        record,
        evaluate,
        snapshot,
        clear,
    });
}

export {
    DEFAULT_MAX_EVIDENCE_AGE_MS,
    DEFAULT_MAX_FUTURE_SKEW_MS,
    DEFAULT_MIN_DISTINCT_MODELS,
    DEFAULT_MIN_SAMPLES_PER_ROUTE,
    createParityCertificationLedger,
    normalizeEvidence,
    normalizeTarget,
    routeKey,
};
