const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function compatibility() {
    return import('../src/lib/computeRouter/localCompatibility.mjs');
}

function baseHardware(overrides = {}) {
    return {
        platform: 'win32',
        arch: 'x64',
        totalMemoryMiB: 32768,
        freeMemoryMiB: 16000,
        nvidiaAvailable: true,
        nvidiaMaxVramMiB: 12288,
        cudaToolkitAvailable: true,
        cudaToolkitVersion: '12.4',
        vulkanAvailable: true,
        rocmAvailable: false,
        ...overrides,
    };
}

function baseRuntime(overrides = {}) {
    return {
        exists: true,
        backend: 'cpu',
        manifestPinned: true,
        installedIntegrityVerified: true,
        ...overrides,
    };
}

function baseModel(overrides = {}) {
    return {
        id: 'z-image-turbo',
        state: 'downloaded',
        requiresAuxiliary: false,
        ...overrides,
    };
}

test('fully evidenced CPU path becomes a non-routing compatibility candidate', async () => {
    const { evaluateLocalCompatibility } = await compatibility();
    const result = evaluateLocalCompatibility({
        runtime: baseRuntime(),
        model: baseModel(),
        hardware: baseHardware(),
        requirements: { minSystemRamMiB: 16384 },
    });

    assert.equal(result.status, 'COMPATIBILITY_CANDIDATE');
    assert.equal(result.compatibilityCandidate, true);
    assert.equal(result.routingEligible, false);
    assert.deepEqual(result.reasons, []);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');
});

test('CUDA path requires observed NVIDIA GPU and sufficient explicit VRAM', async () => {
    const { evaluateLocalCompatibility } = await compatibility();

    const noGpu = evaluateLocalCompatibility({
        runtime: baseRuntime({ backend: 'cuda12' }),
        model: baseModel(),
        hardware: baseHardware({ nvidiaAvailable: false, nvidiaMaxVramMiB: undefined }),
        requirements: { minSystemRamMiB: 16384, minVramMiB: 8192 },
    });
    assert.equal(noGpu.status, 'COMPATIBILITY_BLOCKED');
    assert.ok(noGpu.reasons.includes('NVIDIA_GPU_UNAVAILABLE'));

    const lowVram = evaluateLocalCompatibility({
        runtime: baseRuntime({ backend: 'cuda12' }),
        model: baseModel(),
        hardware: baseHardware({ nvidiaMaxVramMiB: 4096 }),
        requirements: { minSystemRamMiB: 16384, minVramMiB: 8192 },
    });
    assert.equal(lowVram.status, 'COMPATIBILITY_BLOCKED');
    assert.ok(lowVram.reasons.includes('INSUFFICIENT_VRAM'));

    const ready = evaluateLocalCompatibility({
        runtime: baseRuntime({ backend: 'cuda12' }),
        model: baseModel(),
        hardware: baseHardware({ nvidiaMaxVramMiB: 12288 }),
        requirements: { minSystemRamMiB: 16384, minVramMiB: 8192 },
    });
    assert.equal(ready.status, 'COMPATIBILITY_CANDIDATE');
});

test('missing runtime or model evidence fails closed', async () => {
    const { evaluateLocalCompatibility } = await compatibility();

    const runtimeMissing = evaluateLocalCompatibility({
        runtime: baseRuntime({ exists: false }),
        model: baseModel(),
        hardware: baseHardware(),
        requirements: { minSystemRamMiB: 16384 },
    });
    assert.equal(runtimeMissing.status, 'COMPATIBILITY_BLOCKED');
    assert.ok(runtimeMissing.reasons.includes('RUNTIME_MISSING'));

    const modelMissing = evaluateLocalCompatibility({
        runtime: baseRuntime(),
        model: baseModel({ state: 'not-downloaded' }),
        hardware: baseHardware(),
        requirements: { minSystemRamMiB: 16384 },
    });
    assert.equal(modelMissing.status, 'COMPATIBILITY_BLOCKED');
    assert.ok(modelMissing.reasons.includes('MODEL_NOT_INSTALLED'));
});

test('required auxiliary assets must be present', async () => {
    const { evaluateLocalCompatibility } = await compatibility();
    const result = evaluateLocalCompatibility({
        runtime: baseRuntime(),
        model: baseModel({
            requiresAuxiliary: true,
            auxiliaryStatus: { llm: 'downloaded', vae: 'not-downloaded' },
        }),
        hardware: baseHardware(),
        requirements: { minSystemRamMiB: 16384 },
    });

    assert.equal(result.status, 'COMPATIBILITY_BLOCKED');
    assert.ok(result.reasons.includes('MODEL_AUXILIARY_ASSETS_MISSING'));
});

test('missing installed integrity or resource profile remains unknown rather than ready', async () => {
    const { evaluateLocalCompatibility } = await compatibility();

    const integrityUnknown = evaluateLocalCompatibility({
        runtime: baseRuntime({ installedIntegrityVerified: false }),
        model: baseModel(),
        hardware: baseHardware(),
        requirements: { minSystemRamMiB: 16384 },
    });
    assert.equal(integrityUnknown.status, 'COMPATIBILITY_UNKNOWN');
    assert.ok(integrityUnknown.reasons.includes('INSTALLED_RUNTIME_INTEGRITY_UNVERIFIED'));

    const requirementsUnknown = evaluateLocalCompatibility({
        runtime: baseRuntime(),
        model: baseModel(),
        hardware: baseHardware(),
    });
    assert.equal(requirementsUnknown.status, 'COMPATIBILITY_UNKNOWN');
    assert.ok(requirementsUnknown.reasons.includes('SYSTEM_RAM_REQUIREMENT_UNSPECIFIED'));
});

test('Metal stays unknown until capability is measured directly', async () => {
    const { evaluateLocalCompatibility } = await compatibility();
    const result = evaluateLocalCompatibility({
        runtime: baseRuntime({ backend: 'metal' }),
        model: baseModel(),
        hardware: baseHardware({
            platform: 'darwin',
            arch: 'arm64',
            nvidiaAvailable: false,
            nvidiaMaxVramMiB: undefined,
            vulkanAvailable: false,
        }),
        requirements: { minSystemRamMiB: 16384, minVramMiB: 4096 },
    });

    assert.equal(result.status, 'COMPATIBILITY_UNKNOWN');
    assert.ok(result.reasons.includes('METAL_CAPABILITY_NOT_PROBED'));
    assert.ok(result.reasons.includes('VRAM_EVIDENCE_NOT_AVAILABLE_FOR_BACKEND'));
});

test('P1C2 compatibility evaluator remains pure diagnostic logic', () => {
    const source = fs.readFileSync('src/lib/computeRouter/localCompatibility.mjs', 'utf8');

    for (const token of [
        "from 'node:fs'",
        "from 'node:child_process'",
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localStorage',
        'sessionStorage',
        'routeGenerationRequest(',
        'localAI.generate',
        'muapi.generate',
    ]) {
        assert.equal(source.includes(token), false, `unexpected side effect token: ${token}`);
    }

    assert.ok(source.includes('routingEligible: false'));
    assert.ok(source.includes('cutoverAuthorized: false'));
    assert.ok(source.includes("'legacy-dispatcher-only'"));
});
