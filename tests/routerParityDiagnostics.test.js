const test = require('node:test');
const assert = require('node:assert/strict');

async function diagnostics() {
    return import('../src/lib/computeRouter/parityDiagnostics.mjs');
}

async function session() {
    return import('../src/lib/computeRouter/paritySession.mjs');
}

function evidence(overrides = {}) {
    return {
        routeKey: 'sdcpp-device:t2i',
        expectedProviderId: 'sdcpp-device',
        selectedProviderId: 'sdcpp-device',
        operation: 't2i',
        modelId: 'z-image-turbo',
        parity: 'match',
        observedAt: 1000,
        ...overrides,
    };
}

function certificationResult(overrides = {}) {
    return {
        schemaVersion: 1,
        certified: true,
        reason: 'PARITY_CERTIFIED',
        maxEvidenceAgeMs: 604800000,
        maxFutureSkewMs: 60000,
        routes: [{
            routeKey: 'sdcpp-device:t2i',
            expectedProviderId: 'sdcpp-device',
            operation: 't2i',
            minSamples: 2,
            minDistinctModels: 1,
            samples: 2,
            matches: 2,
            blocked: 0,
            mismatches: 0,
            distinctModels: 1,
            modelIds: ['z-image-turbo'],
            certified: true,
            reasons: [],
        }],
        ...overrides,
    };
}

class FakeEventTarget {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(type) === handler) {
            this.listeners.delete(type);
        }
    }

    emit(type, detail) {
        this.listeners.get(type)?.({ type, detail });
    }
}

function shadowReport(overrides = {}) {
    return {
        schemaVersion: 1,
        mode: 'shadow-only',
        operation: 't2i',
        modelId: 'z-image-turbo',
        expectedProviderId: 'sdcpp-device',
        selectedProviderId: 'sdcpp-device',
        parity: 'match',
        reason: 'SELECTED',
        rejected: [],
        ...overrides,
    };
}

test('diagnostic report summarizes observed routes and certification targets', async () => {
    const { buildParityDiagnosticReport } = await diagnostics();

    const report = buildParityDiagnosticReport({
        evidence: [
            evidence({ observedAt: 1000 }),
            evidence({ observedAt: 2000 }),
            evidence({
                routeKey: 'wan2gp-lan:t2v',
                expectedProviderId: 'wan2gp-lan',
                selectedProviderId: null,
                operation: 't2v',
                modelId: 'wan2gp:wan22-t2v',
                parity: 'blocked',
                observedAt: 1500,
            }),
        ],
        certification: certificationResult(),
        generatedAt: 3000,
    });

    assert.equal(report.schemaVersion, 1);
    assert.equal(report.generatedAt, 3000);
    assert.equal(report.certification.certified, true);
    assert.equal(report.totals.observedRoutes, 2);
    assert.equal(report.totals.samples, 3);
    assert.equal(report.totals.matches, 2);
    assert.equal(report.totals.blocked, 1);
    assert.equal(report.totals.mismatches, 0);

    assert.equal(report.targets.length, 1);
    assert.equal(report.targets[0].status, 'certified');
    assert.equal(report.targets[0].firstObservedAt, 1000);
    assert.equal(report.targets[0].lastObservedAt, 2000);
    assert.equal(report.targets[0].latestParity, 'match');

    assert.deepEqual(
        report.observedRoutes.map((route) => route.routeKey),
        ['sdcpp-device:t2i', 'wan2gp-lan:t2v'],
    );
});

test('diagnostic status prioritizes mismatches and blocked evidence over coverage gaps', async () => {
    const { buildParityDiagnosticReport } = await diagnostics();

    const report = buildParityDiagnosticReport({
        evidence: [
            evidence({
                selectedProviderId: 'muapi-cloud',
                parity: 'mismatch',
                observedAt: 1000,
            }),
        ],
        certification: certificationResult({
            certified: false,
            reason: 'PARITY_NOT_CERTIFIED',
            routes: [{
                routeKey: 'sdcpp-device:t2i',
                expectedProviderId: 'sdcpp-device',
                operation: 't2i',
                minSamples: 10,
                minDistinctModels: 2,
                samples: 1,
                matches: 0,
                blocked: 0,
                mismatches: 1,
                distinctModels: 1,
                modelIds: ['z-image-turbo'],
                certified: false,
                reasons: ['samples:1/10', 'models:1/2', 'mismatch:1', 'non-match-evidence'],
            }],
        }),
        generatedAt: 2000,
    });

    assert.equal(report.targets[0].status, 'mismatch');
    assert.deepEqual(report.targets[0].reasons, [
        'samples:1/10',
        'models:1/2',
        'mismatch:1',
        'non-match-evidence',
    ]);
});

test('diagnostic status distinguishes blocked and insufficient coverage', async () => {
    const { diagnosticStatus } = await diagnostics();

    assert.equal(diagnosticStatus({
        certified: false,
        blocked: 1,
        mismatches: 0,
        reasons: ['blocked:1'],
    }), 'blocked');

    assert.equal(diagnosticStatus({
        certified: false,
        blocked: 0,
        mismatches: 0,
        reasons: ['samples:2/10'],
    }), 'insufficient-samples');

    assert.equal(diagnosticStatus({
        certified: false,
        blocked: 0,
        mismatches: 0,
        reasons: ['models:1/2'],
    }), 'insufficient-model-coverage');
});

test('text report is deterministic and human-readable without private payload fields', async () => {
    const {
        buildParityDiagnosticReport,
        formatParityDiagnosticText,
    } = await diagnostics();

    const report = buildParityDiagnosticReport({
        evidence: [
            evidence({
                observedAt: Date.parse('2026-09-12T17:00:00.000Z'),
                prompt: 'private prompt',
                apiKey: 'secret',
            }),
            evidence({
                observedAt: Date.parse('2026-09-12T17:05:00.000Z'),
                modelId: 'z-image-base',
                prompt: 'private prompt 2',
            }),
        ],
        certification: certificationResult({
            routes: [{
                routeKey: 'sdcpp-device:t2i',
                expectedProviderId: 'sdcpp-device',
                operation: 't2i',
                minSamples: 2,
                minDistinctModels: 2,
                samples: 2,
                matches: 2,
                blocked: 0,
                mismatches: 0,
                distinctModels: 2,
                modelIds: ['z-image-base', 'z-image-turbo'],
                certified: true,
                reasons: [],
            }],
        }),
        generatedAt: Date.parse('2026-09-12T17:10:00.000Z'),
    });

    const text = formatParityDiagnosticText(report);
    assert.ok(text.includes('ORBI Compute Router — Parity Diagnostic Report'));
    assert.ok(text.includes('Certification targets: CERTIFIED (PARITY_CERTIFIED)'));
    assert.ok(text.includes('sdcpp-device:t2i: CERTIFIED'));
    assert.ok(text.includes('samples 2/2; models 2/2'));
    assert.ok(text.includes('z-image-base, z-image-turbo'));
    assert.equal(text.includes('private prompt'), false);
    assert.equal(text.includes('secret'), false);
});

test('report keeps observed but untargeted routes visible without implying certification', async () => {
    const { buildParityDiagnosticReport } = await diagnostics();

    const report = buildParityDiagnosticReport({
        evidence: [
            evidence(),
            evidence({
                routeKey: 'muapi-cloud:i2i',
                expectedProviderId: 'muapi-cloud',
                selectedProviderId: 'muapi-cloud',
                operation: 'i2i',
                modelId: 'cloud-model',
                observedAt: 1500,
            }),
        ],
        certification: certificationResult(),
        generatedAt: 2000,
    });

    assert.equal(report.targets.length, 1);
    assert.equal(report.observedRoutes.length, 2);
    assert.ok(report.observedRoutes.some((route) => route.routeKey === 'muapi-cloud:i2i'));
});

test('route identity collisions fail closed', async () => {
    const { summarizeEvidenceByRoute } = await diagnostics();

    assert.throws(
        () => summarizeEvidenceByRoute([
            evidence(),
            evidence({
                expectedProviderId: 'muapi-cloud',
                operation: 'i2i',
                observedAt: 2000,
            }),
        ]),
        (error) => error.code === 'INVALID_PARITY_DIAGNOSTIC_INPUT',
    );
});

test('session diagnostic report reads only the in-memory P1B.10 ledger', async () => {
    const {
        buildStudioParityDiagnosticReport,
        clearStudioParitySessionEvidence,
        formatStudioParityDiagnosticReport,
        startStudioParitySessionCollector,
        stopStudioParitySessionCollector,
    } = await session();

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();

    const target = new FakeEventTarget();
    startStudioParitySessionCollector({ eventTarget: target });
    target.emit('orbi:compute-router-shadow', shadowReport());
    target.emit('orbi:compute-router-shadow', shadowReport());

    const targets = [{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 2,
    }];

    const report = buildStudioParityDiagnosticReport(targets, { generatedAt: 5000 });
    assert.equal(report.certification.certified, true);
    assert.equal(report.totals.samples, 2);

    const text = formatStudioParityDiagnosticReport(targets, { generatedAt: 5000 });
    assert.ok(text.includes('Certification targets: CERTIFIED'));
    assert.ok(text.includes('sdcpp-device:t2i'));

    stopStudioParitySessionCollector();
    clearStudioParitySessionEvidence();
});
