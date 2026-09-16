const test = require('node:test');
const assert = require('node:assert/strict');

async function modules() {
    const [session, certification, registry] = await Promise.all([
        import('../src/lib/computeRouter/benchmarkSessionEvidence.mjs'),
        import('../src/lib/computeRouter/resourceProfileCertification.mjs'),
        import('../src/lib/computeRouter/certifiedResourceProfileRegistry.mjs'),
    ]);
    return { session, certification, registry };
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

async function certificationResult() {
    const { session, certification } = await modules();
    const sessionResult = session.buildBenchmarkSessionEvidence({
        runEvidence: [runEvidence(1), runEvidence(2), runEvidence(3)],
        safetyMarginPct: 20,
        reviewedAt: '2026-09-16T04:00:00.000Z',
    });
    return certification.certifyResourceProfile({
        sessionResult,
        decision: 'approve',
        reviewer: { id: 'reviewer-001', displayName: 'ORBI Technical Reviewer' },
        certifiedAt: '2026-09-16T05:00:00.000Z',
        reviewNote: 'Approve exact evidence-derived requirements.',
    });
}

test('P1C9 accepts valid P1C8 certification and exposes exact immutable lookup', async () => {
    const { registry } = await modules();
    const certified = await certificationResult();
    const result = registry.createCertifiedResourceProfileRegistry({ certifications: [certified] });

    assert.equal(result.status, 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_READY');
    assert.equal(result.registry.size, 1);
    assert.equal(result.registry.mode, 'immutable-shadow-registry');
    const entry = result.registry.get({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.ok(entry);
    assert.deepEqual(entry.profile.requirements, { minSystemRamMiB: 10200, minVramMiB: 7440 });
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.profile), true);
    assert.equal(Object.isFrozen(entry.profile.requirements), true);
});

test('registry snapshots inputs so later caller mutation cannot change registered evidence', async () => {
    const { registry } = await modules();
    const certified = await certificationResult();
    const mutable = JSON.parse(JSON.stringify(certified));
    const result = registry.createCertifiedResourceProfileRegistry({ certifications: [mutable] });

    mutable.certifiedProfile.requirements.minSystemRamMiB = 1;
    mutable.certificationRecord.reviewer.displayName = 'Mutated';

    const entry = result.registry.get({
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.equal(entry.profile.requirements.minSystemRamMiB, 10200);
    assert.equal(entry.certificationRecord.reviewer.displayName, 'ORBI Technical Reviewer');
});

test('registry rejects duplicate certified profile contexts', async () => {
    const { registry } = await modules();
    const certified = await certificationResult();
    const result = registry.createCertifiedResourceProfileRegistry({ certifications: [certified, certified] });

    assert.equal(result.status, 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_INVALID');
    assert.equal(result.reason, 'REGISTRY_DUPLICATE_PROFILE_CONTEXT');
});

test('registry rejects forged certification authority or mismatched requirements', async () => {
    const { registry } = await modules();
    const certified = await certificationResult();

    const forged = { ...certified, routingEligible: true };
    assert.equal(
        registry.createCertifiedResourceProfileRegistry({ certifications: [forged] }).reason,
        'REGISTRY_CERTIFICATION_AUTHORITY_INVALID',
    );

    const mismatch = JSON.parse(JSON.stringify(certified));
    mismatch.certificationRecord.approvedRequirements.minSystemRamMiB = 1;
    assert.equal(
        registry.createCertifiedResourceProfileRegistry({ certifications: [mismatch] }).reason,
        'REGISTRY_CERTIFIED_REQUIREMENTS_MISMATCH',
    );
});

test('registry-backed compatibility uses certified requirements in shadow mode only', async () => {
    const { registry } = await modules();
    const certified = await certificationResult();
    const result = registry.createCertifiedResourceProfileRegistry({ certifications: [certified] });

    const shadow = result.registry.evaluateShadowCompatibility({
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
    });

    assert.equal(shadow.mode, 'shadow-diagnostic-only');
    assert.equal(shadow.registryMatch, true);
    assert.equal(shadow.compatibility.status, 'COMPATIBILITY_CANDIDATE');
    assert.equal(shadow.compatibility.resourceProfile.certified, true);
    assert.equal(shadow.routingEligible, false);
    assert.equal(shadow.compatibility.routingEligible, false);
    assert.equal(shadow.cutoverAuthorized, false);
    assert.equal(shadow.executionAuthority, 'legacy-dispatcher-only');
});

test('missing registry context stays unknown and never gains routing authority', async () => {
    const { registry } = await modules();
    const result = registry.createCertifiedResourceProfileRegistry({ certifications: [] });
    const shadow = result.registry.evaluateShadowCompatibility({
        runtime: {
            exists: true,
            backend: 'cuda12',
            manifestPinned: true,
            installedIntegrityVerified: true,
        },
        model: { id: 'z-image-turbo', state: 'downloaded', requiresAuxiliary: false },
        hardware: { nvidiaAvailable: true, totalMemoryMiB: 32768, nvidiaMaxVramMiB: 12288 },
        width: 1024,
        height: 1024,
    });

    assert.equal(shadow.registryMatch, false);
    assert.equal(shadow.compatibility.status, 'COMPATIBILITY_UNKNOWN');
    assert.equal(shadow.routingEligible, false);
});
