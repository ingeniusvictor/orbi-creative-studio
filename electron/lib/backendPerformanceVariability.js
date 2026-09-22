'use strict';

const AGGREGATE_TYPE = 'p1c58-backend-performance-aggregate';
const VARIABILITY_TYPE = 'p1c60-backend-performance-variability';

function positive(value) {
    return Number.isFinite(value) && value > 0;
}

function buildBackendPerformanceVariability(aggregate) {
    if (!aggregate
        || aggregate.schemaVersion !== 1
        || aggregate.evidenceType !== AGGREGATE_TYPE
        || !['cpu', 'cuda12'].includes(aggregate.backend)
        || aggregate.benchmarkOnly !== true
        || aggregate.routingEligible !== false
        || aggregate.cutoverAuthorized !== false
        || !aggregate.stats
        || !Number.isInteger(aggregate.stats.runs)
        || aggregate.stats.runs < 3
        || !positive(aggregate.stats.minMs)
        || !positive(aggregate.stats.medianMs)
        || !positive(aggregate.stats.p90Ms)
        || !positive(aggregate.stats.maxMs)
        || !positive(aggregate.stats.meanMs)) {
        throw new TypeError('valid P1C58 aggregate with at least 3 runs is required');
    }

    const median = aggregate.stats.medianMs;
    const rangeMs = aggregate.stats.maxMs - aggregate.stats.minMs;
    const p90OverMedian = aggregate.stats.p90Ms / median;
    const maxOverMedian = aggregate.stats.maxMs / median;
    const rangePctOfMedian = (rangeMs / median) * 100;
    const meanMedianDeltaPct = (Math.abs(aggregate.stats.meanMs - median) / median) * 100;

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: VARIABILITY_TYPE,
        modelId: aggregate.modelId,
        backend: aggregate.backend,
        resolution: Object.freeze({ ...aggregate.resolution }),
        aggregateIdentitySha256: aggregate.aggregateIdentitySha256,
        runs: aggregate.stats.runs,
        medianMs: median,
        p90Ms: aggregate.stats.p90Ms,
        maxMs: aggregate.stats.maxMs,
        minMs: aggregate.stats.minMs,
        rangeMs,
        p90OverMedian,
        maxOverMedian,
        rangePctOfMedian,
        meanMedianDeltaPct,
        descriptiveOnly: true,
        stabilityThresholdApplied: false,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function compareBackendVariability({ cpu, cuda12 } = {}) {
    for (const [name, value, backend] of [
        ['cpu', cpu, 'cpu'],
        ['cuda12', cuda12, 'cuda12'],
    ]) {
        if (!value
            || value.schemaVersion !== 1
            || value.evidenceType !== VARIABILITY_TYPE
            || value.backend !== backend
            || value.descriptiveOnly !== true
            || value.stabilityThresholdApplied !== false
            || value.routingEligible !== false) {
            throw new TypeError(`${name} variability evidence is invalid`);
        }
    }

    if (cpu.modelId !== cuda12.modelId
        || cpu.resolution?.width !== cuda12.resolution?.width
        || cpu.resolution?.height !== cuda12.resolution?.height) {
        throw new TypeError('CPU and CUDA variability evidence must share model and resolution');
    }

    const lowerRangeBackend = cpu.rangePctOfMedian < cuda12.rangePctOfMedian
        ? 'cpu'
        : cpu.rangePctOfMedian > cuda12.rangePctOfMedian
            ? 'cuda12'
            : 'tie';

    const lowerP90TailBackend = cpu.p90OverMedian < cuda12.p90OverMedian
        ? 'cpu'
        : cpu.p90OverMedian > cuda12.p90OverMedian
            ? 'cuda12'
            : 'tie';

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c60-backend-variability-comparison',
        modelId: cpu.modelId,
        resolution: Object.freeze({ ...cpu.resolution }),
        cpu: Object.freeze({
            rangePctOfMedian: cpu.rangePctOfMedian,
            p90OverMedian: cpu.p90OverMedian,
            maxOverMedian: cpu.maxOverMedian,
        }),
        cuda12: Object.freeze({
            rangePctOfMedian: cuda12.rangePctOfMedian,
            p90OverMedian: cuda12.p90OverMedian,
            maxOverMedian: cuda12.maxOverMedian,
        }),
        lowerRangeBackend,
        lowerP90TailBackend,
        descriptiveOnly: true,
        stabilityThresholdApplied: false,
        requiresHumanInterpretation: true,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    buildBackendPerformanceVariability,
    compareBackendVariability,
};
