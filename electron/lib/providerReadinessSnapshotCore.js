'use strict';

function cloneAuxiliaryStatus(value) {
    if (!value || typeof value !== 'object') return undefined;
    const result = {};
    for (const key of ['llm', 'vae']) {
        if (typeof value[key] === 'string') result[key] = value[key];
    }
    return Object.keys(result).length ? Object.freeze(result) : undefined;
}

function sanitizeSdCppEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object') {
        return Object.freeze({});
    }

    const binaryStatus = evidence.binaryStatus && typeof evidence.binaryStatus === 'object'
        ? Object.freeze({ exists: evidence.binaryStatus.exists === true })
        : undefined;

    const models = Array.isArray(evidence.models)
        ? Object.freeze(evidence.models
            .filter((model) => model && typeof model.id === 'string' && model.id)
            .map((model) => Object.freeze({
                id: model.id,
                provider: 'sdcpp',
                state: typeof model.state === 'string' ? model.state : 'unknown',
                requiresAuxiliary: model.requiresAuxiliary === true,
                ...(cloneAuxiliaryStatus(model.auxiliaryStatus)
                    ? { auxiliaryStatus: cloneAuxiliaryStatus(model.auxiliaryStatus) }
                    : {}),
            })))
        : undefined;

    return Object.freeze({
        ...(binaryStatus ? { binaryStatus } : {}),
        ...(models ? { models } : {}),
    });
}

function sanitizeWan2gpEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object') {
        return Object.freeze({});
    }

    const config = evidence.config && typeof evidence.config === 'object'
        ? Object.freeze({ configured: evidence.config.configured === true })
        : undefined;

    const probe = evidence.probe && typeof evidence.probe === 'object'
        ? Object.freeze({ ok: evidence.probe.ok === true })
        : undefined;

    const models = Array.isArray(evidence.models)
        ? Object.freeze(evidence.models
            .filter((model) => model && typeof model.id === 'string' && model.id)
            .map((model) => Object.freeze({
                id: model.id,
                provider: 'wan2gp',
                ready: model.ready === true,
            })))
        : undefined;

    return Object.freeze({
        ...(config ? { config } : {}),
        ...(probe ? { probe } : {}),
        ...(models ? { models } : {}),
    });
}

function sanitizeCredentialReadiness(readiness) {
    if (!readiness || typeof readiness !== 'object') return undefined;
    return Object.freeze({
        available: readiness.available === true,
        secure: readiness.secure === true,
        hasSecret: readiness.hasSecret === true,
        storeState: readiness.storeState === 'corrupt' ? 'corrupt' : 'ready',
    });
}

function canProbeMuapiHealth(readiness) {
    return Boolean(
        readiness
        && readiness.available === true
        && readiness.secure === true
        && readiness.hasSecret === true
        && readiness.storeState !== 'corrupt'
    );
}

function sanitizeTransportHealth(health) {
    if (!health || typeof health !== 'object') return undefined;
    const status = Number(health.status);
    return Object.freeze({
        ok: health.ok === true,
        status: Number.isInteger(status) && status >= 0 ? status : 0,
    });
}

function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function sanitizeHardwareSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return undefined;

    const gpuMemory = Array.isArray(snapshot.accelerators?.nvidia?.gpus)
        ? snapshot.accelerators.nvidia.gpus
            .map((gpu) => finiteNumber(gpu?.memoryTotalMiB))
            .filter((value) => value !== undefined)
        : [];

    return Object.freeze({
        platform: typeof snapshot.platform === 'string' ? snapshot.platform : undefined,
        arch: typeof snapshot.arch === 'string' ? snapshot.arch : undefined,
        cpu: Object.freeze({
            model: typeof snapshot.cpu?.model === 'string' ? snapshot.cpu.model : undefined,
            logicalCores: finiteNumber(snapshot.cpu?.logicalCores),
        }),
        memory: Object.freeze({
            totalMiB: finiteNumber(snapshot.memory?.totalMiB),
            freeMiB: finiteNumber(snapshot.memory?.freeMiB),
        }),
        accelerators: Object.freeze({
            nvidia: Object.freeze({
                available: snapshot.accelerators?.nvidia?.available === true,
                gpus: Object.freeze(gpuMemory.map((memoryTotalMiB) => Object.freeze({ memoryTotalMiB }))),
            }),
            cudaToolkit: Object.freeze({
                available: snapshot.accelerators?.cudaToolkit?.available === true,
                version: typeof snapshot.accelerators?.cudaToolkit?.version === 'string'
                    ? snapshot.accelerators.cudaToolkit.version
                    : undefined,
            }),
            vulkan: Object.freeze({
                available: snapshot.accelerators?.vulkan?.available === true,
            }),
            rocm: Object.freeze({
                available: snapshot.accelerators?.rocm?.available === true,
            }),
        }),
    });
}

function buildProviderReadinessSnapshot({
    sdcppEvidence,
    wan2gpEvidence,
    muapiCredentialReadiness,
    muapiTransportHealth,
    hardwareSnapshot,
} = {}) {
    const sdcpp = sanitizeSdCppEvidence(sdcppEvidence);
    const hardware = sanitizeHardwareSnapshot(hardwareSnapshot);
    const credentials = sanitizeCredentialReadiness(muapiCredentialReadiness);
    const transportHealth = sanitizeTransportHealth(muapiTransportHealth);

    return Object.freeze({
        schemaVersion: 1,
        sdcpp: Object.freeze({
            ...sdcpp,
            ...(hardware ? { hardwareSnapshot: hardware } : {}),
        }),
        wan2gp: sanitizeWan2gpEvidence(wan2gpEvidence),
        muapi: Object.freeze({
            ...(credentials ? { credentialReadiness: credentials } : {}),
            ...(transportHealth ? { transportHealth } : {}),
        }),
    });
}

module.exports = {
    buildProviderReadinessSnapshot,
    canProbeMuapiHealth,
    sanitizeCredentialReadiness,
    sanitizeHardwareSnapshot,
    sanitizeSdCppEvidence,
    sanitizeTransportHealth,
    sanitizeWan2gpEvidence,
};
