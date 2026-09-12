'use strict';

function safeError(error) {
    return {
        code: typeof error?.code === 'string' ? error.code : 'READINESS_CAPTURE_FAILED',
        message: typeof error?.message === 'string' ? error.message.slice(0, 500) : 'Readiness capture failed',
    };
}

function sanitizeBinaryStatus(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        exists: value.exists === true,
        runtime: value.runtime && typeof value.runtime === 'object'
            ? {
                backend: value.runtime.backend || null,
                release: value.runtime.release || null,
                upstreamCommit: value.runtime.upstreamCommit || null,
                assetName: value.runtime.assetName || null,
                sha256: value.runtime.sha256 || null,
            }
            : null,
    };
}

function sanitizeSdModels(models) {
    if (!Array.isArray(models)) return null;
    return models.map((model) => ({
        id: model?.id || null,
        provider: model?.provider || 'sdcpp',
        state: model?.state || 'unknown',
        requiresAuxiliary: model?.requiresAuxiliary === true,
        auxiliaryStatus: model?.requiresAuxiliary && model?.auxiliaryStatus
            ? { ...model.auxiliaryStatus }
            : undefined,
    }));
}

function sanitizeWanModels(models) {
    if (!Array.isArray(models)) return null;
    return models.map((model) => ({
        id: model?.id || null,
        provider: model?.provider || 'wan2gp',
        ready: model?.ready === true,
        unavailableReason: typeof model?.unavailableReason === 'string'
            ? model.unavailableReason.slice(0, 300)
            : undefined,
    }));
}

async function collectReadinessSnapshot({
    store,
    probeHardware,
    getBinaryStatus,
    listSdModels,
    readWanConfig,
    probeWan,
    listWanModelsFromProbe,
} = {}) {
    if (!store || typeof store.getReadiness !== 'function') {
        throw new TypeError('Provider secret store with getReadiness is required');
    }

    const errors = [];
    const capture = async (label, fn) => {
        try {
            return await fn();
        } catch (error) {
            errors.push({ source: label, ...safeError(error) });
            return null;
        }
    };

    const [hardware, binaryRaw, sdModelsRaw, credentialReadiness] = await Promise.all([
        capture('hardware', () => probeHardware()),
        capture('sdcpp-binary', () => getBinaryStatus()),
        capture('sdcpp-models', () => listSdModels()),
        capture('muapi-credential', () => store.getReadiness('muapi', 'apiKey')),
    ]);

    const wanConfig = await capture('wan2gp-config', () => readWanConfig());
    let wanProbe = null;
    let wanModels = null;

    const wanUrl = typeof wanConfig?.url === 'string' ? wanConfig.url.trim() : '';
    if (wanUrl) {
        wanProbe = await capture('wan2gp-probe', () => probeWan(wanUrl));
        if (wanProbe) {
            wanModels = await capture(
                'wan2gp-models',
                () => listWanModelsFromProbe(wanUrl, wanProbe),
            );
        }
    }

    return Object.freeze({
        schemaVersion: 1,
        hardware: hardware || null,
        sdcpp: Object.freeze({
            binaryStatus: sanitizeBinaryStatus(binaryRaw),
            models: sanitizeSdModels(sdModelsRaw),
        }),
        wan2gp: Object.freeze({
            config: wanConfig && typeof wanConfig === 'object'
                ? { url: typeof wanConfig.url === 'string' ? wanConfig.url : '' }
                : null,
            probe: wanProbe && typeof wanProbe === 'object'
                ? {
                    ok: wanProbe.ok === true,
                    version: wanProbe.version || null,
                    matchedModels: Number.isFinite(Number(wanProbe.matchedModels))
                        ? Number(wanProbe.matchedModels)
                        : undefined,
                    totalModels: Number.isFinite(Number(wanProbe.totalModels))
                        ? Number(wanProbe.totalModels)
                        : undefined,
                    error: typeof wanProbe.error === 'string' ? wanProbe.error.slice(0, 300) : undefined,
                }
                : null,
            models: sanitizeWanModels(wanModels),
        }),
        muapi: Object.freeze({
            credentialReadiness: credentialReadiness && typeof credentialReadiness === 'object'
                ? {
                    available: credentialReadiness.available === true,
                    secure: credentialReadiness.secure === true,
                    hasSecret: credentialReadiness.hasSecret === true,
                    storeState: credentialReadiness.storeState || 'unknown',
                }
                : null,
            transportHealth: null,
        }),
        errors: Object.freeze(errors),
    });
}

module.exports = {
    collectReadinessSnapshot,
    sanitizeBinaryStatus,
    sanitizeSdModels,
    sanitizeWanModels,
};
