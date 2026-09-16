export const LOCAL_COMPATIBILITY_EXECUTION_AUTHORITY = 'legacy-dispatcher-only';

export const LOCAL_COMPATIBILITY_STATUS = Object.freeze({
    CANDIDATE: 'COMPATIBILITY_CANDIDATE',
    BLOCKED: 'COMPATIBILITY_BLOCKED',
    UNKNOWN: 'COMPATIBILITY_UNKNOWN',
});

const SUPPORTED_BACKENDS = new Set(['cpu', 'cuda12', 'vulkan', 'rocm', 'metal']);

function finitePositiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function stringValue(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function auxiliaryReady(model) {
    if (!model?.requiresAuxiliary) return true;
    const values = Object.values(model.auxiliaryStatus || {});
    return values.length > 0 && values.every((state) => state === 'downloaded');
}

function evaluateBackendHardware(backend, hardware) {
    if (!hardware || typeof hardware !== 'object') {
        return Object.freeze({
            state: 'unknown',
            reasons: Object.freeze(['HARDWARE_EVIDENCE_MISSING']),
        });
    }

    if (backend === 'cpu') {
        const platform = stringValue(hardware.platform);
        const arch = stringValue(hardware.arch);
        return Object.freeze({
            state: platform && arch ? 'supported' : 'unknown',
            reasons: Object.freeze(platform && arch ? [] : ['CPU_PLATFORM_EVIDENCE_INCOMPLETE']),
        });
    }

    if (backend === 'cuda12') {
        if (hardware.nvidiaAvailable === true) {
            return Object.freeze({ state: 'supported', reasons: Object.freeze([]) });
        }
        if (hardware.nvidiaAvailable === false) {
            return Object.freeze({ state: 'blocked', reasons: Object.freeze(['NVIDIA_GPU_UNAVAILABLE']) });
        }
        return Object.freeze({ state: 'unknown', reasons: Object.freeze(['NVIDIA_GPU_EVIDENCE_MISSING']) });
    }

    if (backend === 'vulkan') {
        if (hardware.vulkanAvailable === true) {
            return Object.freeze({ state: 'supported', reasons: Object.freeze([]) });
        }
        if (hardware.vulkanAvailable === false) {
            return Object.freeze({ state: 'blocked', reasons: Object.freeze(['VULKAN_UNAVAILABLE']) });
        }
        return Object.freeze({ state: 'unknown', reasons: Object.freeze(['VULKAN_EVIDENCE_MISSING']) });
    }

    if (backend === 'rocm') {
        if (hardware.rocmAvailable === true) {
            return Object.freeze({ state: 'supported', reasons: Object.freeze([]) });
        }
        if (hardware.rocmAvailable === false) {
            return Object.freeze({ state: 'blocked', reasons: Object.freeze(['ROCM_UNAVAILABLE']) });
        }
        return Object.freeze({ state: 'unknown', reasons: Object.freeze(['ROCM_EVIDENCE_MISSING']) });
    }

    if (backend === 'metal') {
        const platformMatch = hardware.platform === 'darwin' && hardware.arch === 'arm64';
        return Object.freeze({
            state: 'unknown',
            reasons: Object.freeze([
                platformMatch ? 'METAL_CAPABILITY_NOT_PROBED' : 'METAL_PLATFORM_MISMATCH',
            ]),
        });
    }

    return Object.freeze({
        state: 'unknown',
        reasons: Object.freeze(['RUNTIME_BACKEND_UNSUPPORTED']),
    });
}

function evaluateResources({ backend, hardware, requirements }) {
    const minSystemRamMiB = finitePositiveNumber(requirements?.minSystemRamMiB);
    const minVramMiB = finitePositiveNumber(requirements?.minVramMiB);
    const totalMemoryMiB = finitePositiveNumber(hardware?.totalMemoryMiB);
    const nvidiaMaxVramMiB = finitePositiveNumber(hardware?.nvidiaMaxVramMiB);
    const reasons = [];

    let systemRam = 'unknown';
    if (minSystemRamMiB === undefined) {
        reasons.push('SYSTEM_RAM_REQUIREMENT_UNSPECIFIED');
    } else if (totalMemoryMiB === undefined) {
        reasons.push('SYSTEM_RAM_EVIDENCE_MISSING');
    } else if (totalMemoryMiB < minSystemRamMiB) {
        systemRam = 'insufficient';
        reasons.push('INSUFFICIENT_SYSTEM_RAM');
    } else {
        systemRam = 'sufficient';
    }

    let vram = 'not-applicable';
    if (backend !== 'cpu') {
        vram = 'unknown';
        if (minVramMiB === undefined) {
            reasons.push('VRAM_REQUIREMENT_UNSPECIFIED');
        } else if (backend !== 'cuda12') {
            reasons.push('VRAM_EVIDENCE_NOT_AVAILABLE_FOR_BACKEND');
        } else if (nvidiaMaxVramMiB === undefined) {
            reasons.push('NVIDIA_VRAM_EVIDENCE_MISSING');
        } else if (nvidiaMaxVramMiB < minVramMiB) {
            vram = 'insufficient';
            reasons.push('INSUFFICIENT_VRAM');
        } else {
            vram = 'sufficient';
        }
    }

    return Object.freeze({
        systemRam,
        vram,
        minSystemRamMiB,
        minVramMiB,
        observedSystemRamMiB: totalMemoryMiB,
        observedVramMiB: backend === 'cuda12' ? nvidiaMaxVramMiB : undefined,
        reasons: Object.freeze(reasons),
    });
}

export function evaluateLocalCompatibility({
    runtime,
    model,
    hardware,
    requirements,
} = {}) {
    const reasons = [];
    const runtimeExists = runtime?.exists === true;
    const backend = stringValue(runtime?.backend);
    const manifestPinned = runtime?.manifestPinned === true;
    const installedIntegrityVerified = runtime?.installedIntegrityVerified === true;
    const modelId = stringValue(model?.id);
    const modelInstalled = model?.state === 'downloaded';
    const modelAuxiliaryReady = auxiliaryReady(model);

    if (!runtimeExists) {
        reasons.push(runtime?.exists === false ? 'RUNTIME_MISSING' : 'RUNTIME_EVIDENCE_MISSING');
    }

    if (!backend || !SUPPORTED_BACKENDS.has(backend)) {
        reasons.push(backend ? 'RUNTIME_BACKEND_UNSUPPORTED' : 'RUNTIME_BACKEND_MISSING');
    }

    if (!manifestPinned) {
        reasons.push('RUNTIME_MANIFEST_NOT_PINNED');
    }

    if (!installedIntegrityVerified) {
        reasons.push('INSTALLED_RUNTIME_INTEGRITY_UNVERIFIED');
    }

    if (!modelId) {
        reasons.push('MODEL_ID_MISSING');
    }

    if (!modelInstalled) {
        reasons.push(model?.state ? 'MODEL_NOT_INSTALLED' : 'MODEL_EVIDENCE_MISSING');
    }

    if (!modelAuxiliaryReady) {
        reasons.push('MODEL_AUXILIARY_ASSETS_MISSING');
    }

    const backendHardware = evaluateBackendHardware(backend, hardware);
    reasons.push(...backendHardware.reasons);

    const resourceFit = evaluateResources({ backend, hardware, requirements });
    reasons.push(...resourceFit.reasons);

    const blockedReasons = new Set([
        'RUNTIME_MISSING',
        'MODEL_NOT_INSTALLED',
        'MODEL_AUXILIARY_ASSETS_MISSING',
        'NVIDIA_GPU_UNAVAILABLE',
        'VULKAN_UNAVAILABLE',
        'ROCM_UNAVAILABLE',
        'METAL_PLATFORM_MISMATCH',
        'INSUFFICIENT_SYSTEM_RAM',
        'INSUFFICIENT_VRAM',
    ]);

    const uniqueReasons = Object.freeze([...new Set(reasons)]);
    const blocked = uniqueReasons.some((reason) => blockedReasons.has(reason));

    const evidenceComplete = (
        runtimeExists
        && Boolean(backend)
        && SUPPORTED_BACKENDS.has(backend)
        && manifestPinned
        && installedIntegrityVerified
        && Boolean(modelId)
        && modelInstalled
        && modelAuxiliaryReady
        && backendHardware.state === 'supported'
        && resourceFit.systemRam === 'sufficient'
        && (backend === 'cpu' || resourceFit.vram === 'sufficient')
    );

    const status = blocked
        ? LOCAL_COMPATIBILITY_STATUS.BLOCKED
        : (evidenceComplete ? LOCAL_COMPATIBILITY_STATUS.CANDIDATE : LOCAL_COMPATIBILITY_STATUS.UNKNOWN);

    return Object.freeze({
        schemaVersion: 1,
        status,
        compatibilityCandidate: status === LOCAL_COMPATIBILITY_STATUS.CANDIDATE,
        routingEligible: false,
        runtime: Object.freeze({
            exists: runtimeExists,
            backend,
            manifestPinned,
            installedIntegrityVerified,
        }),
        model: Object.freeze({
            id: modelId,
            installed: modelInstalled,
            auxiliaryReady: modelAuxiliaryReady,
        }),
        backendHardware,
        resourceFit,
        reasons: uniqueReasons,
        cutoverAuthorized: false,
        executionAuthority: LOCAL_COMPATIBILITY_EXECUTION_AUTHORITY,
    });
}
