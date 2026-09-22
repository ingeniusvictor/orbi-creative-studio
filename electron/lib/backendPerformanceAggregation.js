'use strict';

const crypto = require('node:crypto');

const PERFORMANCE_EVIDENCE_TYPE = 'p1c57-backend-performance-observation';
const AGGREGATE_EVIDENCE_TYPE = 'p1c58-backend-performance-aggregate';
const COMPARISON_EVIDENCE_TYPE = 'p1c58-backend-performance-comparison';

function finitePositive(value) {
    return Number.isFinite(value) && value > 0;
}

function stableAuxiliaryIdentity(value) {
    if (!Array.isArray(value)) return '[]';
    return JSON.stringify(
        value
            .map((artifact) => ({
                role: artifact?.role,
                sha256: artifact?.sha256,
            }))
            .sort((a, b) => String(a.role).localeCompare(String(b.role))),
    );
}

function contextIdentity(observation) {
    return JSON.stringify({
        protocolVersion: observation.protocolVersion,
        modelId: observation.modelId,
        resolution: observation.resolution,
        harnessVersion: observation.harnessVersion,
        sourceCommit: observation.sourceCommit,
        runtimeIdentity: observation.runtimeIdentity,
        runtimeVersion: observation.runtimeVersion,
        runtimeBinarySha256: observation.runtimeBinarySha256,
        modelArtifactSha256: observation.modelArtifactSha256,
        auxiliaryArtifacts: stableAuxiliaryIdentity(observation.auxiliaryArtifacts),
    });
}

function percentile(sorted, q) {
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    const index = (sorted.length - 1) * q;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function summarizeDurations(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    const mean = total / sorted.length;

    return Object.freeze({
        runs: sorted.length,
        minMs: sorted[0],
        medianMs: percentile(sorted, 0.5),
        p90Ms: percentile(sorted, 0.9),
        maxMs: sorted[sorted.length - 1],
        meanMs: mean,
    });
}

function validateObservation(observation) {
    return Boolean(
        observation
        && observation.schemaVersion === 1
        && observation.evidenceType === PERFORMANCE_EVIDENCE_TYPE
        && ['cpu', 'cuda12'].includes(observation.backend)
        && Number.isInteger(observation.runIndex)
        && observation.runIndex > 0
        && finitePositive(observation.durationMs)
        && observation.benchmarkOnly === true
        && observation.productionProfilePromoted === false
        && observation.routingEligible === false
        && observation.cutoverAuthorized === false
        && observation.executionAuthority === 'legacy-dispatcher-only'
    );
}

function buildBackendPerformanceAggregate({
    observations,
    backend,
    minimumRuns = 3,
} = {}) {
    if (!Array.isArray(observations) || observations.length === 0) {
        throw new TypeError('performance observations are required');
    }
    if (!['cpu', 'cuda12'].includes(backend)) {
        throw new TypeError('aggregate backend must be cpu or cuda12');
    }
    if (!Number.isInteger(minimumRuns) || minimumRuns < 2) {
        throw new TypeError('minimumRuns must be an integer >= 2');
    }

    const selected = observations.filter((observation) => observation?.backend === backend);
    if (selected.length < minimumRuns) {
        throw new TypeError(`at least ${minimumRuns} ${backend} observations are required`);
    }
    if (selected.some((observation) => !validateObservation(observation))) {
        throw new TypeError('performance observation is invalid');
    }

    const identities = new Set(selected.map(contextIdentity));
    if (identities.size !== 1) {
        throw new TypeError('performance observations must share one exact benchmark context');
    }

    const runIndexes = selected.map((observation) => observation.runIndex);
    if (new Set(runIndexes).size !== runIndexes.length) {
        throw new TypeError('performance observations must use unique runIndex values');
    }

    const reference = selected[0];
    const stats = summarizeDurations(selected.map((observation) => observation.durationMs));
    const aggregateIdentitySha256 = crypto
        .createHash('sha256')
        .update(JSON.stringify({
            context: contextIdentity(reference),
            backend,
            runs: [...runIndexes].sort((a, b) => a - b),
            durations: selected
                .map((observation) => ({
                    runIndex: observation.runIndex,
                    durationMs: observation.durationMs,
                }))
                .sort((a, b) => a.runIndex - b.runIndex),
        }), 'utf8')
        .digest('hex');

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: AGGREGATE_EVIDENCE_TYPE,
        protocolVersion: reference.protocolVersion,
        modelId: reference.modelId,
        backend,
        resolution: Object.freeze({
            width: reference.resolution.width,
            height: reference.resolution.height,
        }),
        harnessVersion: reference.harnessVersion,
        sourceCommit: reference.sourceCommit,
        runtimeIdentity: reference.runtimeIdentity,
        runtimeVersion: reference.runtimeVersion,
        runtimeBinarySha256: reference.runtimeBinarySha256,
        modelArtifactSha256: reference.modelArtifactSha256,
        auxiliaryArtifacts: Object.freeze(
            (reference.auxiliaryArtifacts || []).map((artifact) => Object.freeze({
                role: artifact.role,
                sha256: artifact.sha256,
            })),
        ),
        runIndexes: Object.freeze([...runIndexes].sort((a, b) => a - b)),
        stats,
        aggregateIdentitySha256,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sameComparisonContext(left, right) {
    if (!left || !right) return false;
    const comparableLeft = {
        protocolVersion: left.protocolVersion,
        modelId: left.modelId,
        resolution: left.resolution,
        harnessVersion: left.harnessVersion,
        sourceCommit: left.sourceCommit,
        modelArtifactSha256: left.modelArtifactSha256,
        auxiliaryArtifacts: stableAuxiliaryIdentity(left.auxiliaryArtifacts),
    };
    const comparableRight = {
        protocolVersion: right.protocolVersion,
        modelId: right.modelId,
        resolution: right.resolution,
        harnessVersion: right.harnessVersion,
        sourceCommit: right.sourceCommit,
        modelArtifactSha256: right.modelArtifactSha256,
        auxiliaryArtifacts: stableAuxiliaryIdentity(right.auxiliaryArtifacts),
    };
    return JSON.stringify(comparableLeft) === JSON.stringify(comparableRight);
}

function buildBackendPerformanceComparison({ cpuAggregate, cudaAggregate } = {}) {
    for (const [name, aggregate] of [
        ['cpuAggregate', cpuAggregate],
        ['cudaAggregate', cudaAggregate],
    ]) {
        if (!aggregate
            || aggregate.schemaVersion !== 1
            || aggregate.evidenceType !== AGGREGATE_EVIDENCE_TYPE
            || aggregate.benchmarkOnly !== true
            || aggregate.routingEligible !== false
            || !finitePositive(aggregate.stats?.medianMs)) {
            throw new TypeError(`${name} is invalid`);
        }
    }

    if (cpuAggregate.backend !== 'cpu') {
        throw new TypeError('cpuAggregate must use cpu backend');
    }
    if (cudaAggregate.backend !== 'cuda12') {
        throw new TypeError('cudaAggregate must use cuda12 backend');
    }
    if (!sameComparisonContext(cpuAggregate, cudaAggregate)) {
        throw new TypeError('CPU and CUDA aggregates must share one comparable benchmark context');
    }

    const speedupVsCpu = cpuAggregate.stats.medianMs / cudaAggregate.stats.medianMs;
    const percentDurationReduction = (1 - (cudaAggregate.stats.medianMs / cpuAggregate.stats.medianMs)) * 100;

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: COMPARISON_EVIDENCE_TYPE,
        modelId: cpuAggregate.modelId,
        resolution: Object.freeze({
            width: cpuAggregate.resolution.width,
            height: cpuAggregate.resolution.height,
        }),
        harnessVersion: cpuAggregate.harnessVersion,
        sourceCommit: cpuAggregate.sourceCommit,
        modelArtifactSha256: cpuAggregate.modelArtifactSha256,
        cpuAggregateIdentitySha256: cpuAggregate.aggregateIdentitySha256,
        cudaAggregateIdentitySha256: cudaAggregate.aggregateIdentitySha256,
        cpuMedianMs: cpuAggregate.stats.medianMs,
        cudaMedianMs: cudaAggregate.stats.medianMs,
        speedupVsCpu,
        percentDurationReduction,
        fasterBackend: speedupVsCpu > 1 ? 'cuda12' : speedupVsCpu < 1 ? 'cpu' : 'tie',
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    AGGREGATE_EVIDENCE_TYPE,
    COMPARISON_EVIDENCE_TYPE,
    buildBackendPerformanceAggregate,
    buildBackendPerformanceComparison,
    sameComparisonContext,
    summarizeDurations,
};
