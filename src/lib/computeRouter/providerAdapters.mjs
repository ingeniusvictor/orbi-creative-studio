import {
    t2iModels,
    t2vModels,
    i2iModels,
    i2vModels,
    v2vModels,
    lipsyncModels,
    audioModels,
} from '../models.js';
import { LOCAL_MODEL_CATALOG } from '../localModels.js';
import { createProviderDescriptor } from './contracts.mjs';

function arrayValues(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.trim()) : [];
}

function inputEnum(model, key) {
    return arrayValues(model?.inputs?.[key]?.enum);
}

function durationRange(model) {
    const input = model?.inputs?.duration;
    if (!input || typeof input !== 'object') return undefined;

    const enumValues = Array.isArray(input.enum)
        ? input.enum.map(Number).filter(Number.isFinite)
        : [];
    if (enumValues.length) return [Math.min(...enumValues), Math.max(...enumValues)];

    const min = Number(input.minValue);
    const max = Number(input.maxValue);
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min) {
        return [min, max];
    }

    const only = Number(input.default);
    if (Number.isFinite(only) && only > 0) return [only, only];
    return undefined;
}

function muapiCapability(model, operation, inputTypes, outputTypes) {
    return {
        modelId: model.id,
        operations: [operation],
        inputTypes,
        outputTypes,
        aspectRatios: inputEnum(model, 'aspect_ratio'),
        resolutions: inputEnum(model, 'resolution'),
        durationRange: durationRange(model),
        provenance: {
            catalog: 'muapi',
            endpoint: typeof model.endpoint === 'string' ? model.endpoint : model.id,
            vendor: model.provider || null,
            vendorName: model.provider_name || null,
        },
    };
}

function localCapability(model) {
    let operation;
    let inputTypes;
    let outputTypes;

    if (model.provider === 'sdcpp') {
        operation = 't2i';
        inputTypes = ['text'];
        outputTypes = ['image'];
    } else if (model.type === 'image') {
        operation = 't2i';
        inputTypes = ['text'];
        outputTypes = ['image'];
    } else if (model.type === 'video' && model.needsImage) {
        operation = 'i2v';
        inputTypes = ['text', 'image'];
        outputTypes = ['video'];
    } else if (model.type === 'video') {
        operation = 't2v';
        inputTypes = ['text'];
        outputTypes = ['video'];
    } else {
        throw new Error(`Unsupported local model capability shape: ${model.id}`);
    }

    return {
        modelId: model.id,
        operations: [operation],
        inputTypes,
        outputTypes,
        aspectRatios: arrayValues(model.aspectRatios),
        provenance: {
            catalog: 'localModels',
            provider: model.provider,
            family: model.family || model.type || null,
            filename: model.filename || null,
            sizeBytes: Number.isFinite(Number(model.sizeBytes)) ? Number(model.sizeBytes) : null,
        },
    };
}

const MUAPI_CAPABILITIES = Object.freeze([
    ...t2iModels.map((model) => muapiCapability(model, 't2i', ['text'], ['image'])),
    ...i2iModels.map((model) => muapiCapability(model, 'i2i', ['text', 'image'], ['image'])),
    ...t2vModels.map((model) => muapiCapability(model, 't2v', ['text'], ['video'])),
    ...i2vModels.map((model) => muapiCapability(model, 'i2v', ['text', 'image'], ['video'])),
    ...v2vModels.map((model) => muapiCapability(model, 'v2v', ['text', 'video'], ['video'])),
    ...lipsyncModels.map((model) => muapiCapability(model, 'lipsync', ['audio', model.category === 'image' ? 'image' : 'video'], ['video'])),
    ...audioModels.map((model) => muapiCapability(model, 'audio', ['text'], ['audio'])),
]);

const SDCPP_CAPABILITIES = Object.freeze(
    LOCAL_MODEL_CATALOG.filter((model) => model.provider === 'sdcpp').map(localCapability),
);

const WAN2GP_CAPABILITIES = Object.freeze(
    LOCAL_MODEL_CATALOG.filter((model) => model.provider === 'wan2gp').map(localCapability),
);

function metrics({ latencyMs, queueDepth } = {}) {
    return { latencyMs, queueDepth };
}

export function createMuapiProviderDescriptor({
    health = 'unknown',
    credentials = 'unknown',
    latencyMs,
    queueDepth,
} = {}) {
    return createProviderDescriptor({
        id: 'muapi-cloud',
        execution: 'cloud',
        trustBoundary: 'third-party',
        metering: 'credits',
        health,
        credentials,
        capabilities: MUAPI_CAPABILITIES,
        metrics: metrics({ latencyMs, queueDepth }),
    });
}

export function createSdCppProviderDescriptor({
    health = 'unknown',
    latencyMs,
    queueDepth,
    hardware,
} = {}) {
    const descriptor = createProviderDescriptor({
        id: 'sdcpp-device',
        execution: 'device',
        trustBoundary: 'same-device',
        metering: 'local-compute',
        health,
        credentials: 'not-required',
        capabilities: SDCPP_CAPABILITIES.map((capability) => ({
            ...capability,
            hardware: hardware && typeof hardware === 'object' ? { ...hardware } : undefined,
        })),
        metrics: metrics({ latencyMs, queueDepth }),
    });
    return descriptor;
}

export function createWan2gpProviderDescriptor({
    health = 'unknown',
    latencyMs,
    queueDepth,
} = {}) {
    return createProviderDescriptor({
        id: 'wan2gp-lan',
        execution: 'lan',
        trustBoundary: 'trusted-network',
        metering: 'local-compute',
        health,
        credentials: 'not-required',
        capabilities: WAN2GP_CAPABILITIES,
        metrics: metrics({ latencyMs, queueDepth }),
    });
}

export function createCurrentProviderDescriptors({
    muapi = {},
    sdcpp = {},
    wan2gp = {},
} = {}) {
    return Object.freeze([
        createSdCppProviderDescriptor(sdcpp),
        createWan2gpProviderDescriptor(wan2gp),
        createMuapiProviderDescriptor(muapi),
    ]);
}

export {
    MUAPI_CAPABILITIES,
    SDCPP_CAPABILITIES,
    WAN2GP_CAPABILITIES,
};
