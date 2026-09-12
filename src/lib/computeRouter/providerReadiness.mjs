import { createProviderDescriptor } from './contracts.mjs';
import {
    createMuapiProviderDescriptor,
    createSdCppProviderDescriptor,
    createWan2gpProviderDescriptor,
} from './providerAdapters.mjs';

function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

function cloneProviderWith(provider, overrides = {}) {
    return createProviderDescriptor({
        id: provider.id,
        execution: provider.execution,
        trustBoundary: provider.trustBoundary,
        metering: provider.metering,
        health: overrides.health || provider.health,
        credentials: overrides.credentials || provider.credentials,
        capabilities: overrides.capabilities || provider.capabilities,
        metrics: overrides.metrics || provider.metrics,
    });
}

function filterProviderCapabilities(provider, modelIds) {
    const ids = new Set(normalizeArray(modelIds).filter((id) => typeof id === 'string' && id));
    if (!ids.size) return provider;

    const capabilities = provider.capabilities.filter((capability) => ids.has(capability.modelId));
    if (!capabilities.length) return provider;
    return cloneProviderWith(provider, { capabilities });
}

function auxiliaryReady(model) {
    if (!model?.requiresAuxiliary) return true;
    const values = Object.values(model.auxiliaryStatus || {});
    return values.length > 0 && values.every((state) => state === 'downloaded');
}

export function getReadySdCppModelIds(models) {
    return normalizeArray(models)
        .filter((model) => model?.provider !== 'wan2gp')
        .filter((model) => model?.state === 'downloaded')
        .filter(auxiliaryReady)
        .map((model) => model.id)
        .filter((id) => typeof id === 'string' && id);
}

export function getReadyWan2gpModelIds(models) {
    return normalizeArray(models)
        .filter((model) => model?.provider === 'wan2gp' || String(model?.id || '').startsWith('wan2gp:'))
        .filter((model) => model?.ready === true)
        .map((model) => model.id)
        .filter((id) => typeof id === 'string' && id);
}

export function sanitizeHardwareSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return undefined;

    const nvidiaGpus = normalizeArray(snapshot.accelerators?.nvidia?.gpus);
    const vramValues = nvidiaGpus
        .map((gpu) => Number(gpu?.memoryTotalMiB))
        .filter(Number.isFinite);

    return Object.freeze({
        platform: typeof snapshot.platform === 'string' ? snapshot.platform : undefined,
        arch: typeof snapshot.arch === 'string' ? snapshot.arch : undefined,
        cpuModel: typeof snapshot.cpu?.model === 'string' ? snapshot.cpu.model : undefined,
        logicalCores: Number.isFinite(Number(snapshot.cpu?.logicalCores)) ? Number(snapshot.cpu.logicalCores) : undefined,
        totalMemoryMiB: Number.isFinite(Number(snapshot.memory?.totalMiB)) ? Number(snapshot.memory.totalMiB) : undefined,
        freeMemoryMiB: Number.isFinite(Number(snapshot.memory?.freeMiB)) ? Number(snapshot.memory.freeMiB) : undefined,
        nvidiaAvailable: snapshot.accelerators?.nvidia?.available === true,
        nvidiaMaxVramMiB: vramValues.length ? Math.max(...vramValues) : undefined,
        cudaToolkitAvailable: snapshot.accelerators?.cudaToolkit?.available === true,
        cudaToolkitVersion: typeof snapshot.accelerators?.cudaToolkit?.version === 'string'
            ? snapshot.accelerators.cudaToolkit.version
            : undefined,
        vulkanAvailable: snapshot.accelerators?.vulkan?.available === true,
        rocmAvailable: snapshot.accelerators?.rocm?.available === true,
    });
}

export function composeSdCppReadiness({
    binaryStatus,
    models,
    hardwareSnapshot,
    latencyMs,
    queueDepth,
} = {}) {
    const hardware = sanitizeHardwareSnapshot(hardwareSnapshot);

    if (!binaryStatus) {
        return createSdCppProviderDescriptor({
            health: 'unknown',
            latencyMs,
            queueDepth,
            hardware,
        });
    }

    if (binaryStatus.exists !== true) {
        return createSdCppProviderDescriptor({
            health: 'misconfigured',
            latencyMs,
            queueDepth,
            hardware,
        });
    }

    if (!Array.isArray(models)) {
        return createSdCppProviderDescriptor({
            health: 'unknown',
            latencyMs,
            queueDepth,
            hardware,
        });
    }

    const readyModelIds = getReadySdCppModelIds(models);
    if (!readyModelIds.length) {
        return createSdCppProviderDescriptor({
            health: 'misconfigured',
            latencyMs,
            queueDepth,
            hardware,
        });
    }

    const provider = createSdCppProviderDescriptor({
        health: 'ready',
        latencyMs,
        queueDepth,
        hardware,
    });
    return filterProviderCapabilities(provider, readyModelIds);
}

export function composeWan2gpReadiness({
    config,
    probe,
    models,
    latencyMs,
    queueDepth,
} = {}) {
    const configured = typeof config?.url === 'string' && Boolean(config.url.trim());

    if (!config) {
        return createWan2gpProviderDescriptor({ health: 'unknown', latencyMs, queueDepth });
    }

    if (!configured) {
        return createWan2gpProviderDescriptor({ health: 'misconfigured', latencyMs, queueDepth });
    }

    if (!probe) {
        return createWan2gpProviderDescriptor({ health: 'unknown', latencyMs, queueDepth });
    }

    if (probe.ok !== true) {
        return createWan2gpProviderDescriptor({ health: 'offline', latencyMs, queueDepth });
    }

    if (!Array.isArray(models)) {
        return createWan2gpProviderDescriptor({ health: 'unknown', latencyMs, queueDepth });
    }

    const readyModelIds = getReadyWan2gpModelIds(models);
    if (!readyModelIds.length) {
        return createWan2gpProviderDescriptor({ health: 'misconfigured', latencyMs, queueDepth });
    }

    const provider = createWan2gpProviderDescriptor({
        health: 'ready',
        latencyMs,
        queueDepth,
    });
    return filterProviderCapabilities(provider, readyModelIds);
}

function secureMuapiCredentialAvailable(readiness) {
    return Boolean(
        readiness
        && readiness.available === true
        && readiness.secure === true
        && readiness.hasSecret === true
        && readiness.storeState !== 'corrupt'
    );
}

function mapTransportHealth(transportHealth) {
    if (transportHealth === true || transportHealth?.ok === true) return 'ready';
    if (transportHealth === false || transportHealth?.ok === false) return 'offline';
    return 'unknown';
}

export function composeMuapiReadiness({
    credentialReadiness,
    transportHealth,
    latencyMs,
    queueDepth,
} = {}) {
    const credentials = credentialReadiness
        ? (secureMuapiCredentialAvailable(credentialReadiness) ? 'available' : 'missing')
        : 'unknown';

    return createMuapiProviderDescriptor({
        health: mapTransportHealth(transportHealth),
        credentials,
        latencyMs,
        queueDepth,
    });
}

export function composeCurrentProviderReadiness({
    sdcpp = {},
    wan2gp = {},
    muapi = {},
} = {}) {
    return Object.freeze([
        composeSdCppReadiness(sdcpp),
        composeWan2gpReadiness(wan2gp),
        composeMuapiReadiness(muapi),
    ]);
}
