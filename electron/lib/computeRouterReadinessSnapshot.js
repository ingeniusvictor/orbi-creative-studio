'use strict';

function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function freezeObject(value) {
    return Object.freeze(value);
}

function sanitizeHardwareSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return undefined;

    const rawGpus = Array.isArray(snapshot.accelerators?.nvidia?.gpus)
        ? snapshot.accelerators.nvidia.gpus
        : [];
    const gpus = rawGpus
        .map((gpu) => finiteNumber(gpu?.memoryTotalMiB))
        .filter((value) => value !== undefined)
        .map((memoryTotalMiB) => freezeObject({ memoryTotalMiB }));

    return freezeObject({
        platform: typeof snapshot.platform === 'string' ? snapshot.platform : undefined,
        arch: typeof snapshot.arch === 'string' ? snapshot.arch : undefined,
        cpu: freezeObject({
            model: typeof snapshot.cpu?.model === 'string' ? snapshot.cpu.model : undefined,
            logicalCores: finiteNumber(snapshot.cpu?.logicalCores),
        }),
        memory: freezeObject({
            totalMiB: finiteNumber(snapshot.memory?.totalMiB),
            freeMiB: finiteNumber(snapshot.memory?.freeMiB),
        }),
        accelerators: freezeObject({
            nvidia: freezeObject({
                available: snapshot.accelerators?.nvidia?.available === true,
                gpus: Object.freeze(gpus),
            }),
            cudaToolkit: freezeObject({
                available: snapshot.accelerators?.cudaToolkit?.available === true,
                version: typeof snapshot.accelerators?.cudaToolkit?.version === 'string'
                    ? snapshot.accelerators.cudaToolkit.version
                    : undefined,
            }),
            vulkan: freezeObject({
                available: snapshot.accelerators?.vulkan?.available === true,
            }),
            rocm: freezeObject({
                available: snapshot.accelerators?.rocm?.available === true,
            }),
        }),
    });
}

function sanitizeSdCppSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return freezeObject({});

    const result = {};
    if (snapshot.binaryStatus && typeof snapshot.binaryStatus === 'object') {
        result.binaryStatus = freezeObject({
            exists: snapshot.binaryStatus.exists === true,
        });
    }

    if (Array.isArray(snapshot.models)) {
        result.models = Object.freeze(snapshot.models
            .filter((model) => typeof model?.id === 'string' && model.id)
            .map((model) => freezeObject({
                id: model.id,
                provider: 'sdcpp',
                state: typeof model.state === 'string' ? model.state : undefined,
                ...(model.requiresAuxiliary === true ? {
                    requiresAuxiliary: true,
                    auxiliaryStatus: freezeObject({
                        llm: typeof model.auxiliaryStatus?.llm === 'string'
                            ? model.auxiliaryStatus.llm
                            : undefined,
                        vae: typeof model.auxiliaryStatus?.vae === 'string'
                            ? model.auxiliaryStatus.vae
                            : undefined,
                    }),
                } : {}),
            })));
    }

    return freezeObject(result);
}

function sanitizeWan2gpSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return freezeObject({});

    const result = {};
    if (snapshot.config && typeof snapshot.config === 'object') {
        result.config = freezeObject({
            url: typeof snapshot.config.url === 'string' && snapshot.config.url.trim()
                ? 'configured'
                : '',
        });
    }

    if (snapshot.probe && typeof snapshot.probe === 'object') {
        result.probe = freezeObject({
            ok: snapshot.probe.ok === true,
        });
    }

    if (Array.isArray(snapshot.models)) {
        result.models = Object.freeze(snapshot.models
            .filter((model) => typeof model?.id === 'string' && model.id)
            .map((model) => freezeObject({
                id: model.id,
                provider: 'wan2gp',
                ready: model.ready === true,
            })));
    }

    return freezeObject(result);
}

function sanitizeCredentialReadiness(readiness) {
    if (!readiness || typeof readiness !== 'object') return undefined;

    return freezeObject({
        available: readiness.available === true,
        secure: readiness.secure === true,
        hasSecret: readiness.hasSecret === true,
        storeState: readiness.storeState === 'corrupt' ? 'corrupt' : 'ready',
    });
}

function sanitizeTransportHealth(health) {
    if (!health || typeof health !== 'object' || typeof health.ok !== 'boolean') {
        return undefined;
    }
    return freezeObject({ ok: health.ok });
}

function buildReadinessSnapshot({
    sdcpp,
    wan2gp,
    hardware,
    credentialReadiness,
    transportHealth,
} = {}) {
    const safeSdCpp = { ...sanitizeSdCppSnapshot(sdcpp) };
    const safeHardware = sanitizeHardwareSnapshot(hardware);
    if (safeHardware) safeSdCpp.hardwareSnapshot = safeHardware;

    const safeCredential = sanitizeCredentialReadiness(credentialReadiness);
    const safeTransportHealth = sanitizeTransportHealth(transportHealth);
    const muapi = {};
    if (safeCredential) muapi.credentialReadiness = safeCredential;
    if (safeTransportHealth) muapi.transportHealth = safeTransportHealth;

    return freezeObject({
        sdcpp: freezeObject(safeSdCpp),
        wan2gp: sanitizeWan2gpSnapshot(wan2gp),
        muapi: freezeObject(muapi),
    });
}

module.exports = {
    buildReadinessSnapshot,
    sanitizeCredentialReadiness,
    sanitizeHardwareSnapshot,
    sanitizeSdCppSnapshot,
    sanitizeTransportHealth,
    sanitizeWan2gpSnapshot,
};
