const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildBackendPerformanceVariability,
    compareBackendVariability,
} = require('../electron/lib/backendPerformanceVariability');

function aggregate(backend, stats) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c58-backend-performance-aggregate',
        modelId: 'z-image-turbo',
        backend,
        resolution: { width: 1024, height: 1024 },
        aggregateIdentitySha256: (backend === 'cpu' ? 'a' : 'b').repeat(64),
        stats,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

test('P1C60 derives variability without inventing a stability threshold', () => {
    const evidence = buildBackendPerformanceVariability(aggregate('cuda12', {
        runs: 3,
        minMs: 180,
        medianMs: 200,
        p90Ms: 216,
        maxMs: 220,
        meanMs: 200,
    }));

    assert.equal(evidence.rangeMs, 40);
    assert.equal(evidence.rangePctOfMedian, 20);
    assert.equal(evidence.p90OverMedian, 1.08);
    assert.equal(evidence.maxOverMedian, 1.1);
    assert.equal(evidence.meanMedianDeltaPct, 0);
    assert.equal(evidence.stabilityThresholdApplied, false);
    assert.equal(evidence.routingEligible, false);
});

test('P1C60 requires at least three aggregate runs', () => {
    assert.throws(() => buildBackendPerformanceVariability(aggregate('cpu', {
        runs: 2,
        minMs: 900,
        medianMs: 1000,
        p90Ms: 1090,
        maxMs: 1100,
        meanMs: 1000,
    })), /at least 3 runs/);
});

test('P1C60 compares relative variability descriptively', () => {
    const cpu = buildBackendPerformanceVariability(aggregate('cpu', {
        runs: 3,
        minMs: 900,
        medianMs: 1000,
        p90Ms: 1080,
        maxMs: 1100,
        meanMs: 1000,
    }));
    const cuda12 = buildBackendPerformanceVariability(aggregate('cuda12', {
        runs: 3,
        minMs: 160,
        medianMs: 200,
        p90Ms: 232,
        maxMs: 240,
        meanMs: 200,
    }));

    const comparison = compareBackendVariability({ cpu, cuda12 });

    assert.equal(comparison.lowerRangeBackend, 'cpu');
    assert.equal(comparison.lowerP90TailBackend, 'cpu');
    assert.equal(comparison.requiresHumanInterpretation, true);
    assert.equal(comparison.routingEligible, false);
});

test('P1C60 refuses cross-model variability comparisons', () => {
    const cpu = buildBackendPerformanceVariability(aggregate('cpu', {
        runs: 3,
        minMs: 900,
        medianMs: 1000,
        p90Ms: 1080,
        maxMs: 1100,
        meanMs: 1000,
    }));
    const cuda12 = {
        ...buildBackendPerformanceVariability(aggregate('cuda12', {
            runs: 3,
            minMs: 180,
            medianMs: 200,
            p90Ms: 216,
            maxMs: 220,
            meanMs: 200,
        })),
        modelId: 'other-model',
    };

    assert.throws(() => compareBackendVariability({ cpu, cuda12 }), /share model and resolution/);
});
