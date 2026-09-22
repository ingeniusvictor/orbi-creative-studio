const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildBackendPerformanceAggregate,
    buildBackendPerformanceComparison,
} = require('../electron/lib/backendPerformanceAggregation');

function observation({ backend, runIndex, durationMs, runtimeBinarySha256 }) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c57-backend-performance-observation',
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: 'z-image-turbo',
        backend,
        resolution: { width: 1024, height: 1024 },
        harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
        sourceCommit: 'a'.repeat(40),
        runtimeIdentity: `sd.cpp-${backend}`,
        runtimeVersion: 'runtime-v1',
        runtimeBinarySha256,
        modelArtifactSha256: 'c'.repeat(64),
        auxiliaryArtifacts: [
            { role: 'llm', sha256: 'd'.repeat(64) },
            { role: 'vae', sha256: 'e'.repeat(64) },
        ],
        measuredAt: `2026-09-22T00:0${runIndex}:00.000Z`,
        durationMs,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

test('P1C58 aggregates repeated same-context durations using robust summary statistics', () => {
    const aggregate = buildBackendPerformanceAggregate({
        backend: 'cpu',
        observations: [
            observation({ backend: 'cpu', runIndex: 1, durationMs: 1000, runtimeBinarySha256: '1'.repeat(64) }),
            observation({ backend: 'cpu', runIndex: 2, durationMs: 1100, runtimeBinarySha256: '1'.repeat(64) }),
            observation({ backend: 'cpu', runIndex: 3, durationMs: 900, runtimeBinarySha256: '1'.repeat(64) }),
        ],
    });

    assert.equal(aggregate.evidenceType, 'p1c58-backend-performance-aggregate');
    assert.equal(aggregate.stats.runs, 3);
    assert.equal(aggregate.stats.minMs, 900);
    assert.equal(aggregate.stats.medianMs, 1000);
    assert.equal(aggregate.stats.maxMs, 1100);
    assert.match(aggregate.aggregateIdentitySha256, /^[a-f0-9]{64}$/);
    assert.equal(aggregate.routingEligible, false);
});

test('P1C58 rejects mixed context or duplicate run indexes', () => {
    const base = [
        observation({ backend: 'cpu', runIndex: 1, durationMs: 1000, runtimeBinarySha256: '1'.repeat(64) }),
        observation({ backend: 'cpu', runIndex: 2, durationMs: 1100, runtimeBinarySha256: '1'.repeat(64) }),
        observation({ backend: 'cpu', runIndex: 3, durationMs: 900, runtimeBinarySha256: '1'.repeat(64) }),
    ];

    assert.throws(() => buildBackendPerformanceAggregate({
        backend: 'cpu',
        observations: [
            base[0],
            { ...base[1], modelArtifactSha256: 'f'.repeat(64) },
            base[2],
        ],
    }), /exact benchmark context/);

    assert.throws(() => buildBackendPerformanceAggregate({
        backend: 'cpu',
        observations: [
            base[0],
            { ...base[1], runIndex: 1 },
            base[2],
        ],
    }), /unique runIndex/);
});

test('P1C58 requires multiple runs before aggregate evidence exists', () => {
    assert.throws(() => buildBackendPerformanceAggregate({
        backend: 'cuda12',
        observations: [
            observation({ backend: 'cuda12', runIndex: 1, durationMs: 200, runtimeBinarySha256: '2'.repeat(64) }),
            observation({ backend: 'cuda12', runIndex: 2, durationMs: 210, runtimeBinarySha256: '2'.repeat(64) }),
        ],
    }), /at least 3/);
});

test('P1C58 compares CPU and CUDA medians without authorizing routing', () => {
    const cpu = buildBackendPerformanceAggregate({
        backend: 'cpu',
        observations: [
            observation({ backend: 'cpu', runIndex: 1, durationMs: 1000, runtimeBinarySha256: '1'.repeat(64) }),
            observation({ backend: 'cpu', runIndex: 2, durationMs: 1100, runtimeBinarySha256: '1'.repeat(64) }),
            observation({ backend: 'cpu', runIndex: 3, durationMs: 900, runtimeBinarySha256: '1'.repeat(64) }),
        ],
    });

    const cuda = buildBackendPerformanceAggregate({
        backend: 'cuda12',
        observations: [
            observation({ backend: 'cuda12', runIndex: 4, durationMs: 200, runtimeBinarySha256: '2'.repeat(64) }),
            observation({ backend: 'cuda12', runIndex: 5, durationMs: 220, runtimeBinarySha256: '2'.repeat(64) }),
            observation({ backend: 'cuda12', runIndex: 6, durationMs: 180, runtimeBinarySha256: '2'.repeat(64) }),
        ],
    });

    const comparison = buildBackendPerformanceComparison({
        cpuAggregate: cpu,
        cudaAggregate: cuda,
    });

    assert.equal(comparison.evidenceType, 'p1c58-backend-performance-comparison');
    assert.equal(comparison.cpuMedianMs, 1000);
    assert.equal(comparison.cudaMedianMs, 200);
    assert.equal(comparison.speedupVsCpu, 5);
    assert.equal(comparison.percentDurationReduction, 80);
    assert.equal(comparison.fasterBackend, 'cuda12');
    assert.equal(comparison.routingEligible, false);
    assert.equal(comparison.cutoverAuthorized, false);
});

test('P1C58 refuses to compare different model/resolution/harness contexts', () => {
    const cpu = buildBackendPerformanceAggregate({
        backend: 'cpu',
        observations: [1, 2, 3].map((runIndex) =>
            observation({ backend: 'cpu', runIndex, durationMs: 1000, runtimeBinarySha256: '1'.repeat(64) })),
    });

    const cudaObservations = [4, 5, 6].map((runIndex) =>
        observation({ backend: 'cuda12', runIndex, durationMs: 200, runtimeBinarySha256: '2'.repeat(64) }));
    cudaObservations[1] = {
        ...cudaObservations[1],
        resolution: { width: 768, height: 768 },
    };

    assert.throws(
        () => buildBackendPerformanceAggregate({
            backend: 'cuda12',
            observations: cudaObservations,
        }),
        /exact benchmark context/,
    );
});
