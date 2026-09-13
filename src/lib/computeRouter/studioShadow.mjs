import {
    createGenerationRequest,
    routeGenerationRequest,
} from './contracts.mjs';
import { composeCurrentProviderReadiness } from './providerReadiness.mjs';
import { getLocalModelById } from '../localModels.js';

const LEGACY_PROVIDER_IDS = Object.freeze({
    SDCPP: 'sdcpp-device',
    WAN2GP: 'wan2gp-lan',
    MUAPI: 'muapi-cloud',
});

function inferLegacyProviderId(modelId) {
    const localModel = getLocalModelById(modelId);
    if (localModel?.provider === 'sdcpp') return LEGACY_PROVIDER_IDS.SDCPP;
    if (localModel?.provider === 'wan2gp') return LEGACY_PROVIDER_IDS.WAN2GP;
    return LEGACY_PROVIDER_IDS.MUAPI;
}

function legacyPolicyForProvider(providerId) {
    if (providerId === LEGACY_PROVIDER_IDS.SDCPP) {
        return Object.freeze({
            privacy: 'device-only',
            cost: 'free-only',
            latency: 'interactive',
            allowFallback: false,
        });
    }

    if (providerId === LEGACY_PROVIDER_IDS.WAN2GP) {
        return Object.freeze({
            privacy: 'trusted-lan',
            cost: 'free-only',
            latency: 'interactive',
            allowFallback: false,
        });
    }

    return Object.freeze({
        privacy: 'cloud-ok',
        cost: 'metered-ok',
        latency: 'interactive',
        allowFallback: false,
    });
}

function normalizeOptionalDuration(value) {
    if (value == null || value === '') return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

function createStudioShadowRequest({
    operation,
    modelId,
    aspectRatio,
    resolution,
    durationSeconds,
} = {}) {
    if (typeof modelId !== 'string' || !modelId.trim()) {
        const error = new Error('Studio shadow routing requires an explicit modelId');
        error.code = 'INVALID_SHADOW_CONTEXT';
        throw error;
    }

    const normalizedModelId = modelId.trim();
    const expectedProviderId = inferLegacyProviderId(normalizedModelId);

    const request = createGenerationRequest({
        capability: operation,
        modelPreference: normalizedModelId,
        output: {
            aspectRatio,
            resolution,
            durationSeconds: normalizeOptionalDuration(durationSeconds),
        },
        policy: legacyPolicyForProvider(expectedProviderId),
    });

    return Object.freeze({
        expectedProviderId,
        request,
    });
}

function summarizeRejected(evaluations = []) {
    return Object.freeze(evaluations.map((evaluation) => Object.freeze({
        providerId: evaluation.provider.id,
        reasons: Object.freeze([...evaluation.reasons]),
    })));
}

function evaluateStudioShadowRoute({
    operation,
    modelId,
    aspectRatio,
    resolution,
    durationSeconds,
    readinessSnapshot,
} = {}) {
    const { expectedProviderId, request } = createStudioShadowRequest({
        operation,
        modelId,
        aspectRatio,
        resolution,
        durationSeconds,
    });

    const providers = composeCurrentProviderReadiness(readinessSnapshot || {});
    const decision = routeGenerationRequest(request, providers);
    const selectedProviderId = decision.selected?.provider?.id || null;

    let parity;
    if (!selectedProviderId) parity = 'blocked';
    else if (selectedProviderId === expectedProviderId) parity = 'match';
    else parity = 'mismatch';

    return Object.freeze({
        schemaVersion: 1,
        mode: 'shadow-only',
        operation: request.capability,
        modelId: request.modelPreference,
        expectedProviderId,
        selectedProviderId,
        parity,
        reason: decision.reason,
        rejected: summarizeRejected(decision.rejected),
    });
}

export {
    LEGACY_PROVIDER_IDS,
    createStudioShadowRequest,
    evaluateStudioShadowRoute,
    inferLegacyProviderId,
    legacyPolicyForProvider,
};
