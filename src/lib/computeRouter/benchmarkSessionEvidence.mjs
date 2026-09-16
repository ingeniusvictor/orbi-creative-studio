import {
    buildResourceCertificationCandidate,
    validateControlledBenchmarkSample,
} from './controlledBenchmark.mjs';

export const BENCHMARK_SESSION_STATUS = Object.freeze({
    READY_FOR_REVIEW: 'BENCHMARK_SESSION_READY_FOR_REVIEW',
    INVALID: 'BENCHMARK_SESSION_INVALID',
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const AUXILIARY_REQUIRED_MODELS = new Map([
    ['z-image-turbo', Object.freeze(['llm', 'vae'])],
    ['z-image-base', Object.freeze(['llm', 'vae'])],
]);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function invalid(reason) {
    return Object.freeze({
        status: BENCHMARK_SESSION_STATUS.INVALID,
        reason,
        evidenceBundle: null,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function normalizeAuxiliaryArtifacts(runEvidence) {
    if (!Array.isArray(runEvidence.auxiliaryArtifacts)) return null;
    const artifacts = [];
    const roles = new Set();

    for (const artifact of runEvidence.auxiliaryArtifacts) {
        if (!isPlainObject(artifact) || !hasExactKeys(artifact, ['role', 'sha256'])) return null;
        if (typeof artifact.role !== 'string' || !artifact.role.trim()) return null;
        if (typeof artifact.sha256 !== 'string' || !SHA256_PATTERN.test(artifact.sha256)) return null;
        if (roles.has(artifact.role)) return null;
        roles.add(artifact.role);
        artifacts.push(Object.freeze({ role: artifact.role, sha256: artifact.sha256 }));
    }

    return artifacts.sort((left, right) => left.role.localeCompare(right.role));
}

function validateRunEnvelope(runEvidence) {
    if (!isPlainObject(runEvidence)) return Object.freeze({ ok: false, reason: 'RUN_EVIDENCE_NOT_OBJECT' });
    const keys = [
        'schemaVersion',
        'evidenceType',
        'sample',
        'auxiliaryArtifacts',
        'benchmarkOnly',
        'productionProfilePromoted',
        'routingEligible',
        'cutoverAuthorized',
        'executionAuthority',
    ];
    if (!hasExactKeys(runEvidence, keys)) return Object.freeze({ ok: false, reason: 'RUN_EVIDENCE_SCHEMA_INVALID' });
    if (runEvidence.schemaVersion !== 1) return Object.freeze({ ok: false, reason: 'RUN_EVIDENCE_SCHEMA_VERSION_INVALID' });
    if (runEvidence.evidenceType !== 'p1c7-benchmark-run-evidence') {
        return Object.freeze({ ok: false, reason: 'RUN_EVIDENCE_TYPE_INVALID' });
    }
    if (runEvidence.benchmarkOnly !== true
        || runEvidence.productionProfilePromoted !== false
        || runEvidence.routingEligible !== false
        || runEvidence.cutoverAuthorized !== false
        || runEvidence.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'RUN_EVIDENCE_AUTHORITY_INVALID' });
    }

    const sampleValidation = validateControlledBenchmarkSample(runEvidence.sample);
    if (!sampleValidation.ok) return Object.freeze({ ok: false, reason: sampleValidation.reason });

    const auxiliaryArtifacts = normalizeAuxiliaryArtifacts(runEvidence);
    if (!auxiliaryArtifacts) return Object.freeze({ ok: false, reason: 'RUN_AUXILIARY_EVIDENCE_INVALID' });

    const requiredRoles = AUXILIARY_REQUIRED_MODELS.get(runEvidence.sample.modelId) || [];
    const actualRoles = auxiliaryArtifacts.map((artifact) => artifact.role);
    if (requiredRoles.length !== actualRoles.length
        || requiredRoles.some((role) => !actualRoles.includes(role))) {
        return Object.freeze({ ok: false, reason: 'RUN_AUXILIARY_EVIDENCE_INCOMPLETE' });
    }
    if (requiredRoles.length === 0 && auxiliaryArtifacts.length !== 0) {
        return Object.freeze({ ok: false, reason: 'RUN_AUXILIARY_EVIDENCE_UNEXPECTED' });
    }

    return Object.freeze({ ok: true, reason: null, auxiliaryArtifacts: Object.freeze(auxiliaryArtifacts) });
}

function sameAuxiliaryArtifacts(left, right) {
    if (left.length !== right.length) return false;
    return left.every((artifact, index) => (
        artifact.role === right[index].role && artifact.sha256 === right[index].sha256
    ));
}

export function buildBenchmarkSessionEvidence({
    runEvidence,
    safetyMarginPct,
    reviewedAt,
} = {}) {
    if (!Array.isArray(runEvidence) || runEvidence.length < 3) {
        return invalid('SESSION_RUN_COUNT_INSUFFICIENT');
    }
    if (!validIsoTimestamp(reviewedAt)) return invalid('SESSION_REVIEWED_AT_INVALID');

    const normalizedAuxiliary = [];
    for (const run of runEvidence) {
        const validation = validateRunEnvelope(run);
        if (!validation.ok) return invalid(validation.reason);
        normalizedAuxiliary.push(validation.auxiliaryArtifacts);
    }

    const firstAuxiliary = normalizedAuxiliary[0];
    if (normalizedAuxiliary.some((artifacts) => !sameAuxiliaryArtifacts(firstAuxiliary, artifacts))) {
        return invalid('SESSION_AUXILIARY_CONTEXT_MISMATCH');
    }

    const candidateResult = buildResourceCertificationCandidate({
        samples: runEvidence.map((run) => run.sample),
        safetyMarginPct,
        evaluatedAt: reviewedAt,
    });
    if (candidateResult.status !== 'BENCHMARK_CANDIDATE_READY_FOR_REVIEW') {
        return invalid(candidateResult.reason || 'SESSION_CANDIDATE_INVALID');
    }

    const candidate = candidateResult.certificationCandidate;
    const bundle = Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-session-evidence',
        status: 'review-only',
        modelId: candidate.modelId,
        backend: candidate.backend,
        resolution: candidate.resolution,
        benchmarkContext: candidate.benchmarkContext,
        auxiliaryArtifacts: Object.freeze(firstAuxiliary.map((artifact) => Object.freeze({ ...artifact }))),
        runCount: runEvidence.length,
        runIndexes: Object.freeze(runEvidence.map((run) => run.sample.runIndex).sort((a, b) => a - b)),
        candidate,
        reviewedAt,
        requiresHumanCertification: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });

    return Object.freeze({
        status: BENCHMARK_SESSION_STATUS.READY_FOR_REVIEW,
        reason: null,
        evidenceBundle: bundle,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export { AUXILIARY_REQUIRED_MODELS, validateRunEnvelope };
