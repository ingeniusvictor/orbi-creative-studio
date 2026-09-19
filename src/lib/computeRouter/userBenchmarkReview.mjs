import {
    buildBenchmarkSessionEvidence,
    BENCHMARK_SESSION_STATUS,
} from './benchmarkSessionEvidence.mjs';
import {
    readUserBenchmarkSessionEvidence,
    validateTarget,
} from './userBenchmarkSession.mjs';
import { validateReviewableSession } from './resourceProfileCertification.mjs';

export const USER_BENCHMARK_REVIEW_STATUS = Object.freeze({
    EMPTY: 'USER_BENCHMARK_REVIEW_EMPTY',
    READY: 'USER_BENCHMARK_REVIEW_READY',
    REJECTED: 'USER_BENCHMARK_REVIEW_REJECTED',
});

const reviews = new Map();

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validSafetyMarginPct(value) {
    return Number.isFinite(value) && value >= 0 && value <= 100;
}

function authorityFields() {
    return Object.freeze({
        reviewOnly: true,
        requiresHumanCertification: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason, target = null) {
    return Object.freeze({
        status: USER_BENCHMARK_REVIEW_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function empty(target) {
    return Object.freeze({
        status: USER_BENCHMARK_REVIEW_STATUS.EMPTY,
        reason: null,
        context: Object.freeze({ ...target }),
        summary: null,
        ...authorityFields(),
    });
}

function cloneRequirements(requirements, backend) {
    return Object.freeze({
        minSystemRamMiB: requirements.minSystemRamMiB,
        ...(backend === 'cuda12' ? { minVramMiB: requirements.minVramMiB } : {}),
    });
}

function buildSummary(sessionResult) {
    const { evidenceBundle } = sessionResult;
    const candidate = evidenceBundle.candidate;
    return Object.freeze({
        modelId: evidenceBundle.modelId,
        backend: evidenceBundle.backend,
        resolution: Object.freeze({ ...evidenceBundle.resolution }),
        runCount: evidenceBundle.runCount,
        runIndexes: Object.freeze([...evidenceBundle.runIndexes]),
        reviewedAt: evidenceBundle.reviewedAt,
        safetyMarginPct: candidate.recommendation.safetyMarginPct,
        requirements: cloneRequirements(candidate.recommendation.requirements, candidate.backend),
        observedPeakSystemRamMiB: candidate.observations.maxSystemRamMiB,
        ...(candidate.backend === 'cuda12'
            ? { observedPeakVramMiB: candidate.observations.maxVramMiB }
            : {}),
        requiresHumanCertification: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneSessionResult(sessionResult) {
    const bundle = sessionResult.evidenceBundle;
    const candidate = bundle.candidate;
    return Object.freeze({
        status: sessionResult.status,
        reason: null,
        evidenceBundle: Object.freeze({
            ...bundle,
            resolution: Object.freeze({ ...bundle.resolution }),
            benchmarkContext: Object.freeze({ ...bundle.benchmarkContext }),
            auxiliaryArtifacts: Object.freeze(bundle.auxiliaryArtifacts.map((item) => Object.freeze({ ...item }))),
            runIndexes: Object.freeze([...bundle.runIndexes]),
            candidate: Object.freeze({
                ...candidate,
                resolution: Object.freeze({ ...candidate.resolution }),
                benchmarkContext: Object.freeze({ ...candidate.benchmarkContext }),
                observations: Object.freeze({ ...candidate.observations }),
                recommendation: Object.freeze({
                    ...candidate.recommendation,
                    requirements: Object.freeze({ ...candidate.recommendation.requirements }),
                }),
            }),
        }),
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export function createUserBenchmarkReview({
    readEvidence = readUserBenchmarkSessionEvidence,
    buildSessionEvidence = buildBenchmarkSessionEvidence,
    now = () => new Date(),
    store = reviews,
} = {}) {
    if (typeof readEvidence !== 'function') throw new TypeError('benchmark evidence reader must be a function');
    if (typeof buildSessionEvidence !== 'function') throw new TypeError('benchmark session builder must be a function');
    if (typeof now !== 'function') throw new TypeError('clock must be a function');
    if (!(store instanceof Map)) throw new TypeError('review store must be a Map');

    const prepare = ({ target, safetyMarginPct } = {}) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;

        if (!validSafetyMarginPct(safetyMarginPct)) {
            return rejected('USER_BENCHMARK_REVIEW_MARGIN_INVALID', normalizedTarget);
        }

        let evidence;
        try {
            evidence = readEvidence(normalizedTarget);
        } catch {
            return rejected('USER_BENCHMARK_REVIEW_EVIDENCE_UNAVAILABLE', normalizedTarget);
        }
        if (!Array.isArray(evidence) || evidence.length !== 3) {
            return rejected('USER_BENCHMARK_REVIEW_SAMPLE_COUNT_INVALID', normalizedTarget);
        }

        let reviewedAt;
        try {
            reviewedAt = now().toISOString();
        } catch {
            return rejected('USER_BENCHMARK_REVIEW_TIMESTAMP_INVALID', normalizedTarget);
        }
        if (!validIsoTimestamp(reviewedAt)) {
            return rejected('USER_BENCHMARK_REVIEW_TIMESTAMP_INVALID', normalizedTarget);
        }

        let sessionResult;
        try {
            sessionResult = buildSessionEvidence({
                runEvidence: evidence,
                safetyMarginPct,
                reviewedAt,
            });
        } catch {
            return rejected('USER_BENCHMARK_REVIEW_BUILD_FAILED', normalizedTarget);
        }

        if (!sessionResult
            || sessionResult.status !== BENCHMARK_SESSION_STATUS.READY_FOR_REVIEW
            || sessionResult.reason !== null
            || sessionResult.productionProfilePromoted !== false
            || sessionResult.routingEligible !== false
            || sessionResult.cutoverAuthorized !== false
            || sessionResult.executionAuthority !== 'legacy-dispatcher-only') {
            return rejected('USER_BENCHMARK_REVIEW_SESSION_INVALID', normalizedTarget);
        }

        const reviewValidation = validateReviewableSession(sessionResult);
        if (!reviewValidation.ok) {
            return rejected('USER_BENCHMARK_REVIEW_P1C8_CONTRACT_INVALID', normalizedTarget);
        }

        const detached = cloneSessionResult(sessionResult);
        const summary = buildSummary(detached);
        store.set(targetKey(normalizedTarget), detached);

        return Object.freeze({
            status: USER_BENCHMARK_REVIEW_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary,
            ...authorityFields(),
        });
    };

    const getSummary = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return rejected(targetValidation.reason);
        const normalizedTarget = targetValidation.target;
        const sessionResult = store.get(targetKey(normalizedTarget));
        if (!sessionResult) return empty(normalizedTarget);

        return Object.freeze({
            status: USER_BENCHMARK_REVIEW_STATUS.READY,
            reason: null,
            context: normalizedTarget,
            summary: buildSummary(sessionResult),
            ...authorityFields(),
        });
    };

    const readSession = (target) => {
        const targetValidation = validateTarget(target);
        if (!targetValidation.ok) return null;
        const sessionResult = store.get(targetKey(targetValidation.target));
        return sessionResult ? cloneSessionResult(sessionResult) : null;
    };

    return Object.freeze({
        prepare,
        getSummary,
        readSession,
        ...authorityFields(),
    });
}

const defaultReview = createUserBenchmarkReview();

export function prepareUserBenchmarkReview(input) {
    return defaultReview.prepare(input);
}

export function getUserBenchmarkReviewSummary(target) {
    return defaultReview.getSummary(target);
}

export function readUserBenchmarkReviewSession(target) {
    return defaultReview.readSession(target);
}

export {
    buildSummary,
    cloneSessionResult,
    targetKey,
    validSafetyMarginPct,
};
