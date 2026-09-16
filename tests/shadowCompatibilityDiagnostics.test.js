const test = require('node:test');
const assert = require('node:assert/strict');

async function modules() {
    const [session, certification, registry, diagnostics] = await Promise.all([
        import('../src/lib/computeRouter/benchmarkSessionEvidence.mjs'),
        import('../src/lib/computeRouter/resourceProfileCertification.mjs'),
        import('../src/lib/computeRouter/certifiedResourceProfileRegistry.mjs'),
        import('../src/lib/computeRouter/shadowCompatibilityDiagnostics.mjs'),
    ]);
    return { session, certification, registry, diagnostics };
}

function sample(runIndex) {
    return {
        schemaVersion: 1,
        protocolVersion: 'p1c5-v1',
        runIndex,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        resolution: { width: 1024, height: 1024 },
        harnessVersion: 'orbi-local-benchmark-harness-0.1.0',
        sourceCommit: 'a'.repeat(40),
        runtimeIdentity: 'sd.cpp-cuda12',
        runtimeVersion: 'runtime-v1',
        runtimeBinarySha256: 'b'.repeat(64),
        modelArtifactSha256: 'c'.repeat(64),
        measuredAt: `2026-09-16T03:00:0${runIndex}.000Z`,
        peakSystemRamMiB: [0, 8000, 8500, 8200][runIndex],
        peakVramMiB: [0, 6000, 6200, 6100][runIndex],
    };
}

function runEvidence(runIndex) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample: sample(runIndex),
        auxiliaryArtifacts: [
            { role: 'llm', sha256: 'd'.repeat(64) },
            { role: 'vae', sha256: 'e'.repeat(64) },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

async function buildRegistry() {
    const { session, certification, registry } = await modules();
    const sessionResult = session.buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });
    const certified = certification.certifyResourceProfile({
        sessionResult,
        decision: 'approve',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Approve exact evidence-derived requirements.',
    });
    return registry.createCertifiedResourceProfileRegistry({ certifications: [certified] }).registry;
}

function evaluationInput() {
    return {
        runtime: {
            exists: true,
            backend: 'cuda12',
            manifestPinned: true,
            installedIntegrityVerified: true,
        },
        model: {
            id: 'z-image-turbo',
            state: 'downloaded',
            requiresAuxiliary: true,
            auxiliaryStatus: { llm: 'downloaded', vae: 'downloaded' },
        },
        hardware: {
            platform: 'win32',
            arch: 'x64',
            totalMemoryMiB: 32768,
            nvidiaAvailable: true,
            nvidiaMaxVramMiB: 12288,
        },
        width: 1024,
        height: 1024,
    };
}

test('P1C10 builds a frozen sanitized snapshot from exact registry shadow context', async () => {
    const { diagnostics } = await modules();
    const registry = await buildRegistry();
    const input = evaluationInput();
    const shadowEvaluation = registry.evaluateShadowCompatibility(input);
    const result = diagnostics.createShadowCompatibilityDiagnostics({
        shadowEvaluation,
        requestedContext: {
            modelId: input.model.id,
            backend: input.runtime.backend,
            width: input.width,
            height: input.height,
        },
        capturedAt: '2026-09-16T06:00:00.000Z',
    });

    assert.equal(result.status, 'SHADOW_COMPATIBILITY_DIAGNOSTICS_READY');
    assert.equal(result.snapshot.registry.match, true);
    assert.equal(result.snapshot.registry.certifiedProfile, true);
    assert.equal(result.snapshot.compatibility.status, 'COMPATIBILITY_CANDIDATE');
    assert.equal(result.snapshot.compatibility.candidate, true);
    assert.deepEqual(result.snapshot.context, {
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.deepEqual(result.snapshot.resources.systemRam, {
        state: 'sufficient',
        requiredMiB: 10200,
        observedMiB: 32768,
    });
    assert.deepEqual(result.snapshot.resources.vram, {
        state: 'sufficient',
        requiredMiB: 7440,
        observedMiB: 12288,
    });
    assert.equal(result.snapshot.boundaries.routingEligible, false);
    assert.equal(result.snapshot.boundaries.cutoverAuthorized, false);
    assert.equal(result.snapshot.boundaries.executionAuthority, 'legacy-dispatcher-only');
    assert.equal(Object.isFrozen(result.snapshot), true);
    assert.equal(Object.isFrozen(result.snapshot.resources.systemRam), true);
});

test('P1C10 rejects requested context that does not exactly match the shadow evaluation', async () => {
    const { diagnostics } = await modules();
    const registry = await buildRegistry();
    const input = evaluationInput();
    const shadowEvaluation = registry.evaluateShadowCompatibility(input);

    const result = diagnostics.createShadowCompatibilityDiagnostics({
        shadowEvaluation,
        requestedContext: {
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 512,
            height: 512,
        },
        capturedAt: '2026-09-16T06:00:00.000Z',
    });
    assert.equal(result.status, 'SHADOW_COMPATIBILITY_DIAGNOSTICS_INVALID');
    assert.equal(result.reason, 'DIAGNOSTIC_CONTEXT_MISMATCH');
});

test('P1C10 rejects arbitrary reason strings instead of reflecting them', async () => {
    const { diagnostics } = await modules();
    const registry = await buildRegistry();
    const input = evaluationInput();
    const shadowEvaluation = registry.evaluateShadowCompatibility(input);
    const forged = {
        ...shadowEvaluation,
        compatibility: {
            ...shadowEvaluation.compatibility,
            reasons: ['<script>alert(1)</script>'],
        },
    };

    const result = diagnostics.createShadowCompatibilityDiagnostics({
        shadowEvaluation: forged,
        requestedContext: shadowEvaluation.context,
        capturedAt: '2026-09-16T06:00:00.000Z',
    });
    assert.equal(result.reason, 'DIAGNOSTIC_REASON_SET_INVALID');
    assert.equal(result.snapshot, null);
});

test('P1C10 rejects forged routing or cutover authority', async () => {
    const { diagnostics } = await modules();
    const registry = await buildRegistry();
    const input = evaluationInput();
    const shadowEvaluation = registry.evaluateShadowCompatibility(input);

    const result = diagnostics.createShadowCompatibilityDiagnostics({
        shadowEvaluation: { ...shadowEvaluation, routingEligible: true },
        requestedContext: shadowEvaluation.context,
        capturedAt: '2026-09-16T06:00:00.000Z',
    });
    assert.equal(result.reason, 'DIAGNOSTIC_SHADOW_AUTHORITY_INVALID');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
});

test('P1C10 reports missing certified context as sanitized unknown without leaking certification evidence', async () => {
    const { registry, diagnostics } = await modules();
    const empty = registry.createCertifiedResourceProfileRegistry({ certifications: [] }).registry;
    const input = evaluationInput();
    const shadowEvaluation = empty.evaluateShadowCompatibility(input);

    const result = diagnostics.createShadowCompatibilityDiagnostics({
        shadowEvaluation,
        requestedContext: shadowEvaluation.context,
        capturedAt: '2026-09-16T06:00:00.000Z',
    });

    assert.equal(result.status, 'SHADOW_COMPATIBILITY_DIAGNOSTICS_READY');
    assert.equal(result.snapshot.registry.match, false);
    assert.equal(result.snapshot.registry.certifiedProfile, false);
    assert.equal(result.snapshot.registry.profileStatus, 'RESOURCE_PROFILE_NOT_FOUND');
    assert.equal(result.snapshot.compatibility.status, 'COMPATIBILITY_UNKNOWN');
    assert.equal(result.snapshot.compatibility.reasons.includes('RESOURCE_PROFILE_NOT_PROVIDED'), true);

    const serialized = JSON.stringify(result.snapshot);
    assert.equal(serialized.includes('reviewer-001'), false);
    assert.equal(serialized.includes('ORBI Technical Reviewer'), false);
    assert.equal(serialized.includes('dddddddddddd'), false);
    assert.equal(serialized.includes('eeeeeeeeeeee'), false);
});

test('P1C10 fails closed on inconsistent detail states', async () => {
    const { diagnostics } = await modules();
    const registry = await buildRegistry();
    const input = evaluationInput();
    const shadowEvaluation = registry.evaluateShadowCompatibility(input);
    const forged = {
        ...shadowEvaluation,
        compatibility: {
            ...shadowEvaluation.compatibility,
            backendHardware: { ...shadowEvaluation.compatibility.backendHardware, state: 'super-fast' },
        },
    };
    const result = diagnostics.createShadowCompatibilityDiagnostics({
        shadowEvaluation: forged,
        requestedContext: shadowEvaluation.context,
        capturedAt: '2026-09-16T06:00:00.000Z',
    });
    assert.equal(result.reason, 'DIAGNOSTIC_DETAIL_SET_INVALID');
});
