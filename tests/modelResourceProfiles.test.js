const test = require('node:test');
const assert = require('node:assert/strict');
const { LOCAL_MODEL_CATALOG } = require('../electron/lib/modelCatalog');

async function profiles() {
    return import('../src/lib/computeRouter/modelResourceProfiles.mjs');
}

async function compatibility() {
    return import('../src/lib/computeRouter/localCompatibility.mjs');
}

function syntheticCertifiedProfile(overrides = {}) {
    return {
        schemaVersion: 1,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        resolution: { width: 1024, height: 1024 },
        status: 'certified',
        requirements: {
            minSystemRamMiB: 16384,
            minVramMiB: 8192,
        },
        evidence: {
            method: 'controlled-benchmark',
            sampleCount: 3,
            harnessVersion: 'synthetic-test-only',
            sourceCommit: 'a'.repeat(40),
            certifiedAt: '2026-09-16T00:00:00.000Z',
            safetyMarginPct: 20,
        },
        ...overrides,
    };
}

test('pending resource profile slots cover every local model default target for CPU and CUDA12', async () => {
    const { PENDING_MODEL_RESOURCE_PROFILE_SLOTS } = await profiles();
    const catalogIds = LOCAL_MODEL_CATALOG.map((model) => model.id).sort();
    const slotIds = [...new Set(PENDING_MODEL_RESOURCE_PROFILE_SLOTS.map((slot) => slot.modelId))].sort();

    assert.deepEqual(slotIds, catalogIds);
    assert.equal(PENDING_MODEL_RESOURCE_PROFILE_SLOTS.length, catalogIds.length * 2);

    for (const slot of PENDING_MODEL_RESOURCE_PROFILE_SLOTS) {
        assert.equal(slot.status, 'pending-benchmark');
        assert.equal(slot.requirements, null);
        assert.equal(slot.evidence, null);
        assert.ok(['cpu', 'cuda12'].includes(slot.backend));
    }
});

test('pending profile cannot resolve requirements', async () => {
    const { PENDING_MODEL_RESOURCE_PROFILE_SLOTS, resolveCertifiedResourceRequirements } = await profiles();
    const slot = PENDING_MODEL_RESOURCE_PROFILE_SLOTS.find((item) => item.modelId === 'z-image-turbo' && item.backend === 'cuda12');

    const resolved = resolveCertifiedResourceRequirements({
        profile: slot,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });

    assert.equal(resolved.status, 'RESOURCE_PROFILE_NOT_CERTIFIED');
    assert.equal(resolved.requirements, undefined);
});

test('synthetic certified profile resolves only for exact model backend and resolution', async () => {
    const { resolveCertifiedResourceRequirements } = await profiles();
    const profile = syntheticCertifiedProfile();

    const exact = resolveCertifiedResourceRequirements({
        profile,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });
    assert.equal(exact.status, 'RESOURCE_PROFILE_CERTIFIED');
    assert.deepEqual(exact.requirements, {
        minSystemRamMiB: 16384,
        minVramMiB: 8192,
    });

    for (const context of [
        { modelId: 'z-image-base', backend: 'cuda12', width: 1024, height: 1024 },
        { modelId: 'z-image-turbo', backend: 'cpu', width: 1024, height: 1024 },
        { modelId: 'z-image-turbo', backend: 'cuda12', width: 512, height: 512 },
    ]) {
        const mismatch = resolveCertifiedResourceRequirements({ profile, ...context });
        assert.equal(mismatch.status, 'RESOURCE_PROFILE_CONTEXT_MISMATCH');
        assert.equal(mismatch.requirements, undefined);
    }
});

test('certification rejects weak or ambiguous evidence', async () => {
    const { resolveCertifiedResourceRequirements } = await profiles();

    const invalids = [
        syntheticCertifiedProfile({ evidence: { ...syntheticCertifiedProfile().evidence, sampleCount: 1 } }),
        syntheticCertifiedProfile({ evidence: { ...syntheticCertifiedProfile().evidence, method: 'file-size-estimate' } }),
        syntheticCertifiedProfile({ evidence: { ...syntheticCertifiedProfile().evidence, sourceCommit: 'not-a-commit' } }),
        syntheticCertifiedProfile({ requirements: { minSystemRamMiB: 0, minVramMiB: 8192 } }),
        { ...syntheticCertifiedProfile(), sizeGB: 3.86 },
    ];

    for (const profile of invalids) {
        const result = resolveCertifiedResourceRequirements({
            profile,
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 1024,
            height: 1024,
        });
        assert.equal(result.status, 'RESOURCE_PROFILE_INVALID');
        assert.equal(result.requirements, undefined);
    }
});

test('CPU profile forbids VRAM requirement and CUDA12 requires one', async () => {
    const { resolveCertifiedResourceRequirements } = await profiles();

    const cpuWithVram = syntheticCertifiedProfile({
        backend: 'cpu',
        requirements: { minSystemRamMiB: 8192, minVramMiB: 1024 },
    });
    assert.equal(resolveCertifiedResourceRequirements({
        profile: cpuWithVram,
        modelId: 'z-image-turbo',
        backend: 'cpu',
        width: 1024,
        height: 1024,
    }).status, 'RESOURCE_PROFILE_INVALID');

    const cudaWithoutVram = syntheticCertifiedProfile({
        requirements: { minSystemRamMiB: 8192 },
    });
    assert.equal(resolveCertifiedResourceRequirements({
        profile: cudaWithoutVram,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    }).status, 'RESOURCE_PROFILE_INVALID');
});

test('certified compatibility wrapper stays UNKNOWN with pending profile', async () => {
    const { PENDING_MODEL_RESOURCE_PROFILE_SLOTS } = await profiles();
    const { evaluateCertifiedLocalCompatibility } = await compatibility();
    const slot = PENDING_MODEL_RESOURCE_PROFILE_SLOTS.find((item) => item.modelId === 'z-image-turbo' && item.backend === 'cuda12');

    const result = evaluateCertifiedLocalCompatibility({
        runtime: {
            exists: true,
            backend: 'cuda12',
            manifestPinned: true,
            installedIntegrityVerified: true,
        },
        model: {
            id: 'z-image-turbo',
            state: 'downloaded',
            requiresAuxiliary: false,
        },
        hardware: {
            platform: 'win32',
            arch: 'x64',
            totalMemoryMiB: 32768,
            nvidiaAvailable: true,
            nvidiaMaxVramMiB: 12288,
        },
        resourceProfile: slot,
        width: 1024,
        height: 1024,
    });

    assert.equal(result.status, 'COMPATIBILITY_UNKNOWN');
    assert.equal(result.routingEligible, false);
    assert.equal(result.resourceProfile.certified, false);
    assert.ok(result.reasons.includes('RESOURCE_PROFILE_NOT_CERTIFIED'));
});

test('synthetic certified profile can satisfy diagnostic wrapper without enabling routing', async () => {
    const { evaluateCertifiedLocalCompatibility } = await compatibility();
    const result = evaluateCertifiedLocalCompatibility({
        runtime: {
            exists: true,
            backend: 'cuda12',
            manifestPinned: true,
            installedIntegrityVerified: true,
        },
        model: {
            id: 'z-image-turbo',
            state: 'downloaded',
            requiresAuxiliary: false,
        },
        hardware: {
            platform: 'win32',
            arch: 'x64',
            totalMemoryMiB: 32768,
            nvidiaAvailable: true,
            nvidiaMaxVramMiB: 12288,
        },
        resourceProfile: syntheticCertifiedProfile(),
        width: 1024,
        height: 1024,
    });

    assert.equal(result.status, 'COMPATIBILITY_CANDIDATE');
    assert.equal(result.resourceProfile.certified, true);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
});
