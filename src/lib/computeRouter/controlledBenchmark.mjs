export const CONTROLLED_BENCHMARK_PROTOCOL_VERSION = 'p1c5-v1';

export const BENCHMARK_CANDIDATE_STATUS = Object.freeze({
    READY_FOR_REVIEW: 'BENCHMARK_CANDIDATE_READY_FOR_REVIEW',
    INVALID: 'BENCHMARK_CANDIDATE_INVALID',
});

const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
    const keys = Object.keys(value).sort();
    const wanted = [...expected].sort();
    return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function positiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function validateControlledBenchmarkSample(sample) {
    if (!isPlainObject(sample)) return Object.freeze({ ok: false, reason: 'SAMPLE_NOT_OBJECT' });

    const keys = [
        'schemaVersion',
        'protocolVersion',
        'runIndex',
        'modelId',
        'backend',
        'resolution',
        'harnessVersion',
        'sourceCommit',
        'runtimeIdentity',
        'runtimeVersion',
        'runtimeBinarySha256',
        'modelArtifactSha256',
        'measuredAt',
        'peakSystemRamMiB',
        'peakVramMiB',
    ];
    if (!hasExactKeys(sample, keys)) return Object.freeze({ ok: false, reason: 'SAMPLE_SCHEMA_INVALID' });
    if (sample.schemaVersion !== 1) return Object.freeze({ ok: false, reason: 'SAMPLE_SCHEMA_VERSION_INVALID' });
    if (sample.protocolVersion !== CONTROLLED_BENCHMARK_PROTOCOL_VERSION) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_PROTOCOL_VERSION_INVALID' });
    }
    if (!positiveInteger(sample.runIndex)) return Object.freeze({ ok: false, reason: 'SAMPLE_RUN_INDEX_INVALID' });
    if (typeof sample.modelId !== 'string' || !sample.modelId.trim()) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_MODEL_ID_INVALID' });
    }
    if (!CERTIFIABLE_BACKENDS.has(sample.backend)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_BACKEND_INVALID' });
    }
    if (!isPlainObject(sample.resolution)
        || !hasExactKeys(sample.resolution, ['width', 'height'])
        || !positiveInteger(sample.resolution.width)
        || !positiveInteger(sample.resolution.height)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_RESOLUTION_INVALID' });
    }
    if (typeof sample.harnessVersion !== 'string' || !sample.harnessVersion.trim()) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_HARNESS_VERSION_INVALID' });
    }
    if (typeof sample.sourceCommit !== 'string' || !COMMIT_PATTERN.test(sample.sourceCommit)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_SOURCE_COMMIT_INVALID' });
    }
    if (typeof sample.runtimeIdentity !== 'string' || !sample.runtimeIdentity.trim()) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_RUNTIME_IDENTITY_INVALID' });
    }
    if (typeof sample.runtimeVersion !== 'string' || !sample.runtimeVersion.trim()) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_RUNTIME_VERSION_INVALID' });
    }
    if (typeof sample.runtimeBinarySha256 !== 'string' || !SHA256_PATTERN.test(sample.runtimeBinarySha256)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_RUNTIME_HASH_INVALID' });
    }
    if (typeof sample.modelArtifactSha256 !== 'string' || !SHA256_PATTERN.test(sample.modelArtifactSha256)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_MODEL_HASH_INVALID' });
    }
    if (!validIsoTimestamp(sample.measuredAt)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_TIMESTAMP_INVALID' });
    }
    if (!positiveFinite(sample.peakSystemRamMiB)) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_SYSTEM_RAM_INVALID' });
    }
    if (sample.backend === 'cuda12') {
        if (!positiveFinite(sample.peakVramMiB)) {
            return Object.freeze({ ok: false, reason: 'SAMPLE_VRAM_INVALID' });
        }
    } else if (sample.peakVramMiB !== null) {
        return Object.freeze({ ok: false, reason: 'SAMPLE_CPU_VRAM_MUST_BE_NULL' });
    }

    return Object.freeze({ ok: true, reason: null });
}

function sameContext(left, right) {
    return left.modelId === right.modelId
        && left.backend === right.backend
        && left.resolution.width === right.resolution.width
        && left.resolution.height === right.resolution.height
        && left.harnessVersion === right.harnessVersion
        && left.sourceCommit === right.sourceCommit
        && left.runtimeIdentity === right.runtimeIdentity
        && left.runtimeVersion === right.runtimeVersion
        && left.runtimeBinarySha256 === right.runtimeBinarySha256
        && left.modelArtifactSha256 === right.modelArtifactSha256;
}

function invalid(reason) {
    return Object.freeze({
        status: BENCHMARK_CANDIDATE_STATUS.INVALID,
        reason,
        certificationCandidate: null,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export function buildResourceCertificationCandidate({
    samples,
    safetyMarginPct,
    evaluatedAt,
} = {}) {
    if (!Array.isArray(samples) || samples.length < 3) {
        return invalid('BENCHMARK_SAMPLE_COUNT_INSUFFICIENT');
    }
    if (!Number.isFinite(safetyMarginPct) || safetyMarginPct < 0 || safetyMarginPct > 100) {
        return invalid('BENCHMARK_SAFETY_MARGIN_INVALID');
    }
    if (!validIsoTimestamp(evaluatedAt)) {
        return invalid('BENCHMARK_EVALUATED_AT_INVALID');
    }

    for (const sample of samples) {
        const validation = validateControlledBenchmarkSample(sample);
        if (!validation.ok) return invalid(validation.reason);
    }

    const first = samples[0];
    if (samples.some((sample) => !sameContext(sample, first))) {
        return invalid('BENCHMARK_CONTEXT_MISMATCH');
    }

    const runIndexes = new Set(samples.map((sample) => sample.runIndex));
    if (runIndexes.size !== samples.length) {
        return invalid('BENCHMARK_DUPLICATE_RUN_INDEX');
    }

    const measuredTimes = samples.map((sample) => Date.parse(sample.measuredAt));
    const maxSystemRamMiB = Math.max(...samples.map((sample) => sample.peakSystemRamMiB));
    const maxVramMiB = first.backend === 'cuda12'
        ? Math.max(...samples.map((sample) => sample.peakVramMiB))
        : null;
    const factor = 1 + (safetyMarginPct / 100);

    const recommendedRequirements = Object.freeze({
        minSystemRamMiB: Math.ceil(maxSystemRamMiB * factor),
        ...(first.backend === 'cuda12'
            ? { minVramMiB: Math.ceil(maxVramMiB * factor) }
            : {}),
    });

    const certificationCandidate = Object.freeze({
        schemaVersion: 1,
        protocolVersion: CONTROLLED_BENCHMARK_PROTOCOL_VERSION,
        status: 'benchmark-candidate',
        modelId: first.modelId,
        backend: first.backend,
        resolution: Object.freeze({
            width: first.resolution.width,
            height: first.resolution.height,
        }),
        benchmarkContext: Object.freeze({
            harnessVersion: first.harnessVersion,
            sourceCommit: first.sourceCommit,
            runtimeIdentity: first.runtimeIdentity,
            runtimeVersion: first.runtimeVersion,
            runtimeBinarySha256: first.runtimeBinarySha256,
            modelArtifactSha256: first.modelArtifactSha256,
        }),
        observations: Object.freeze({
            sampleCount: samples.length,
            firstMeasuredAt: new Date(Math.min(...measuredTimes)).toISOString(),
            lastMeasuredAt: new Date(Math.max(...measuredTimes)).toISOString(),
            maxSystemRamMiB,
            ...(first.backend === 'cuda12' ? { maxVramMiB } : {}),
        }),
        recommendation: Object.freeze({
            safetyMarginPct,
            requirements: recommendedRequirements,
        }),
        evaluatedAt,
        requiresHumanCertification: true,
        productionProfilePromoted: false,
    });

    return Object.freeze({
        status: BENCHMARK_CANDIDATE_STATUS.READY_FOR_REVIEW,
        reason: null,
        certificationCandidate,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export { CERTIFIABLE_BACKENDS };
