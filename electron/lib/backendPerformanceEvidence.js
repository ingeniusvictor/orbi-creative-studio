'use strict';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

function positiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}

function validResolution(value) {
    return Boolean(value)
        && Number.isInteger(value.width)
        && value.width > 0
        && Number.isInteger(value.height)
        && value.height > 0;
}

function normalizeAuxiliaryArtifacts(value) {
    if (!Array.isArray(value)) throw new TypeError('performance auxiliaryArtifacts must be an array');

    return Object.freeze(value.map((artifact) => {
        if (!artifact
            || typeof artifact.role !== 'string'
            || !artifact.role.trim()
            || typeof artifact.sha256 !== 'string'
            || !SHA256_PATTERN.test(artifact.sha256)) {
            throw new TypeError('performance auxiliary artifact is invalid');
        }
        return Object.freeze({
            role: artifact.role,
            sha256: artifact.sha256,
        });
    }));
}

function buildBackendPerformanceEvidence({ sample, auxiliaryArtifacts, durationMs } = {}) {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
        throw new TypeError('controlled benchmark sample is required');
    }
    if (sample.schemaVersion !== 1
        || sample.protocolVersion !== 'p1c5-v1'
        || !Number.isInteger(sample.runIndex)
        || sample.runIndex <= 0
        || typeof sample.modelId !== 'string'
        || !sample.modelId.trim()
        || !['cpu', 'cuda12'].includes(sample.backend)
        || !validResolution(sample.resolution)
        || typeof sample.harnessVersion !== 'string'
        || !sample.harnessVersion.trim()
        || typeof sample.sourceCommit !== 'string'
        || !COMMIT_PATTERN.test(sample.sourceCommit)
        || typeof sample.runtimeIdentity !== 'string'
        || !sample.runtimeIdentity.trim()
        || typeof sample.runtimeVersion !== 'string'
        || !sample.runtimeVersion.trim()
        || typeof sample.runtimeBinarySha256 !== 'string'
        || !SHA256_PATTERN.test(sample.runtimeBinarySha256)
        || typeof sample.modelArtifactSha256 !== 'string'
        || !SHA256_PATTERN.test(sample.modelArtifactSha256)
        || typeof sample.measuredAt !== 'string'
        || !Number.isFinite(Date.parse(sample.measuredAt))) {
        throw new TypeError('controlled benchmark sample context is invalid');
    }
    if (!positiveFinite(durationMs)) {
        throw new TypeError('performance durationMs must be a positive finite number');
    }

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c57-backend-performance-observation',
        protocolVersion: sample.protocolVersion,
        runIndex: sample.runIndex,
        modelId: sample.modelId,
        backend: sample.backend,
        resolution: Object.freeze({
            width: sample.resolution.width,
            height: sample.resolution.height,
        }),
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        auxiliaryArtifacts: normalizeAuxiliaryArtifacts(auxiliaryArtifacts),
        measuredAt: sample.measuredAt,
        durationMs,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function performanceEvidenceMatchesSample(evidence, sample) {
    return Boolean(
        evidence
        && sample
        && evidence.schemaVersion === 1
        && evidence.evidenceType === 'p1c57-backend-performance-observation'
        && evidence.protocolVersion === sample.protocolVersion
        && evidence.runIndex === sample.runIndex
        && evidence.modelId === sample.modelId
        && evidence.backend === sample.backend
        && evidence.resolution?.width === sample.resolution?.width
        && evidence.resolution?.height === sample.resolution?.height
        && evidence.harnessVersion === sample.harnessVersion
        && evidence.sourceCommit === sample.sourceCommit
        && evidence.runtimeIdentity === sample.runtimeIdentity
        && evidence.runtimeVersion === sample.runtimeVersion
        && evidence.runtimeBinarySha256 === sample.runtimeBinarySha256
        && evidence.modelArtifactSha256 === sample.modelArtifactSha256
        && evidence.measuredAt === sample.measuredAt
        && positiveFinite(evidence.durationMs)
        && evidence.benchmarkOnly === true
        && evidence.productionProfilePromoted === false
        && evidence.routingEligible === false
        && evidence.cutoverAuthorized === false
        && evidence.executionAuthority === 'legacy-dispatcher-only'
    );
}

module.exports = {
    buildBackendPerformanceEvidence,
    performanceEvidenceMatchesSample,
};
