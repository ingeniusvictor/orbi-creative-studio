const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildPerformanceResourceReviewCandidate,
    formatPerformanceResourceReviewMarkdown,
} = require('../electron/lib/performanceResourceReview');

const comparison = Object.freeze({
    schemaVersion: 1,
    evidenceType: 'p1c58-backend-performance-comparison',
    modelId: 'z-image-turbo',
    resolution: Object.freeze({ width: 1024, height: 1024 }),
    harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
    sourceCommit: 'a'.repeat(40),
    modelArtifactSha256: 'b'.repeat(64),
    cpuAggregateIdentitySha256: 'c'.repeat(64),
    cudaAggregateIdentitySha256: 'd'.repeat(64),
    cpuMedianMs: 1000,
    cudaMedianMs: 200,
    speedupVsCpu: 5,
    percentDurationReduction: 80,
    fasterBackend: 'cuda12',
    benchmarkOnly: true,
    productionProfilePromoted: false,
    routingEligible: false,
    cutoverAuthorized: false,
    executionAuthority: 'legacy-dispatcher-only',
});

function profile(backend) {
    return Object.freeze({
        schemaVersion: 1,
        modelId: 'z-image-turbo',
        backend,
        resolution: Object.freeze({ width: 1024, height: 1024 }),
        status: 'certified',
        requirements: Object.freeze(
            backend === 'cuda12'
                ? { minSystemRamMiB: 12000, minVramMiB: 6000 }
                : { minSystemRamMiB: 16000 },
        ),
        evidence: Object.freeze({
            method: 'controlled-benchmark',
            sampleCount: 3,
            harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
            sourceCommit: 'a'.repeat(40),
            certifiedAt: '2026-09-22T00:00:00.000Z',
            safetyMarginPct: 15,
        }),
    });
}

test('P1C59 combines performance with human-certified resource requirements', () => {
    const candidate = buildPerformanceResourceReviewCandidate({
        comparison,
        cpuCertifiedProfile: profile('cpu'),
        cudaCertifiedProfile: profile('cuda12'),
    });

    assert.equal(candidate.valid, true);
    assert.equal(candidate.status, 'PERFORMANCE_RESOURCE_REVIEW_READY');
    assert.equal(candidate.performance.measuredFasterBackend, 'cuda12');
    assert.equal(candidate.performance.speedupVsCpu, 5);
    assert.equal(candidate.resources.cpu.minSystemRamMiB, 16000);
    assert.equal(candidate.resources.cuda12.minSystemRamMiB, 12000);
    assert.equal(candidate.resources.cuda12.minVramMiB, 6000);
    assert.equal(candidate.requiresHumanRoutingReview, true);
    assert.equal(candidate.routingEligible, false);
    assert.equal(candidate.cutoverAuthorized, false);
});

test('P1C59 refuses uncertified or mismatched resource profiles', () => {
    const badCpu = {
        ...profile('cpu'),
        status: 'benchmark-candidate',
    };
    const badCuda = {
        ...profile('cuda12'),
        resolution: { width: 768, height: 768 },
    };

    const candidate = buildPerformanceResourceReviewCandidate({
        comparison,
        cpuCertifiedProfile: badCpu,
        cudaCertifiedProfile: badCuda,
    });

    assert.equal(candidate.valid, false);
    assert.equal(candidate.routingEligible, false);
    assert.ok(candidate.errors.length >= 1);
});

test('P1C59 refuses a performance comparison for another model/resolution', () => {
    const candidate = buildPerformanceResourceReviewCandidate({
        comparison: {
            ...comparison,
            modelId: 'other-model',
        },
        cpuCertifiedProfile: profile('cpu'),
        cudaCertifiedProfile: profile('cuda12'),
    });

    assert.equal(candidate.valid, false);
    assert.match(candidate.reason, /performance comparison/i);
});

test('P1C59 markdown remains explicitly review-only', () => {
    const candidate = buildPerformanceResourceReviewCandidate({
        comparison,
        cpuCertifiedProfile: profile('cpu'),
        cudaCertifiedProfile: profile('cuda12'),
    });
    const markdown = formatPerformanceResourceReviewMarkdown(candidate);

    assert.match(markdown, /Measured faster backend: \*\*cuda12\*\*/);
    assert.match(markdown, /Routing eligible: \*\*NO\*\*/);
    assert.match(markdown, /Human routing review: \*\*REQUIRED\*\*/);
    assert.match(markdown, /5\.00×/);
});
