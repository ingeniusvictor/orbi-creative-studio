import {
    createGenerationRequest,
    routeGenerationRequest,
} from './contracts.mjs';
import {
    MUAPI_CAPABILITIES,
    SDCPP_CAPABILITIES,
    WAN2GP_CAPABILITIES,
} from './providerAdapters.mjs';

const LEGACY_PROVIDER_CAPABILITIES = Object.freeze([
    Object.freeze({
        providerId: 'sdcpp-device',
        capabilities: SDCPP_CAPABILITIES,
    }),
    Object.freeze({
        providerId: 'wan2gp-lan',
        capabilities: WAN2GP_CAPABILITIES,
    }),
    Object.freeze({
        providerId: 'muapi-cloud',
        capabilities: MUAPI_CAPABILITIES,
    }),
]);

function shadowError(code, message, details) {
    const error = new Error(message);
    error.code = code;
    if (details) error.details = details;
    return error;
}

function nonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeOutput(input = {}) {
    const output = input.output && typeof input.output === 'object'
        ? input.output
        : {};

    return {
        aspectRatio: nonEmptyString(
            output.aspectRatio
            ?? input.aspectRatio
            ?? input.aspect_ratio
        ),
        resolution: nonEmptyString(
            output.resolution
            ?? input.resolution
        ),
        durationSeconds: output.durationSeconds
            ?? input.durationSeconds
            ?? input.duration,
    };
}

function normalizePolicy(input = {}) {
    const provided = input.policy && typeof input.policy === 'object'
        ? input.policy
        : {};

    return {
        privacy: provided.privacy || 'cloud-ok',
        cost: provided.cost || 'metered-ok',
        latency: provided.latency || 'interactive',
        // Shadow parity is intentionally exact-model. A later phase may choose
        // to relax this, but this adapter must not imply automatic fallback.
        allowFallback: false,
    };
}

function modelRouteCandidates(modelId, capability) {
    const candidates = [];

    for (const owner of LEGACY_PROVIDER_CAPABILITIES) {
        for (const descriptor of owner.capabilities) {
            if (descriptor.modelId !== modelId) continue;

            const operations = Array.isArray(descriptor.operations)
                ? descriptor.operations
                : [];
            if (capability && !operations.includes(capability)) continue;

            for (const operation of operations) {
                if (!capability || operation === capability) {
                    candidates.push(Object.freeze({
                        providerId: owner.providerId,
                        modelId,
                        capability: operation,
                    }));
                }
            }
        }
    }

    return candidates;
}

export function resolveLegacyModelRoute({
    modelId,
    capability,
} = {}) {
    const normalizedModelId = nonEmptyString(modelId);
    if (!normalizedModelId) {
        throw shadowError('STUDIO_MODEL_REQUIRED', 'A Studio model id is required for shadow routing');
    }

    const normalizedCapability = nonEmptyString(capability);
    const candidates = modelRouteCandidates(normalizedModelId, normalizedCapability);

    if (!candidates.length) {
        throw shadowError(
            'STUDIO_MODEL_ROUTE_UNKNOWN',
            `No current ORBI provider owns model "${normalizedModelId}"`,
            { modelId: normalizedModelId, capability: normalizedCapability }
        );
    }

    const uniqueRoutes = new Map(
        candidates.map((candidate) => [
            `${candidate.providerId}:${candidate.capability}`,
            candidate,
        ])
    );

    if (uniqueRoutes.size !== 1) {
        throw shadowError(
            'STUDIO_MODEL_ROUTE_AMBIGUOUS',
            `Model "${normalizedModelId}" maps to multiple current execution routes`,
            {
                modelId: normalizedModelId,
                capability: normalizedCapability,
                routes: [...uniqueRoutes.values()],
            }
        );
    }

    return [...uniqueRoutes.values()][0];
}

export function createStudioShadowIntent(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw shadowError('STUDIO_INTENT_INVALID', 'Studio shadow input must be an object');
    }

    const modelId = nonEmptyString(input.modelId ?? input.model);
    const legacyRoute = resolveLegacyModelRoute({
        modelId,
        capability: input.capability,
    });

    const request = createGenerationRequest({
        capability: legacyRoute.capability,
        modelPreference: legacyRoute.modelId,
        prompt: input.prompt,
        inputs: Array.isArray(input.inputs) ? input.inputs : [],
        output: normalizeOutput(input),
        policy: normalizePolicy(input),
    });

    return Object.freeze({
        mode: 'shadow-only',
        legacyProviderId: legacyRoute.providerId,
        request,
    });
}

function compactCandidate(candidate) {
    return Object.freeze({
        providerId: candidate.provider.id,
        score: candidate.score,
        modelIds: Object.freeze(
            candidate.matchingCapabilities.map((capability) => capability.modelId)
        ),
    });
}

function compactRejected(rejected) {
    return Object.freeze({
        providerId: rejected.provider.id,
        reasons: Object.freeze([...rejected.reasons]),
    });
}

export function shadowRouteStudioRequest(input, providerDescriptors = []) {
    const intent = createStudioShadowIntent(input);
    const decision = routeGenerationRequest(intent.request, providerDescriptors);
    const selectedProviderId = decision.selected?.provider?.id || null;

    let parity = 'no-route';
    if (selectedProviderId) {
        parity = selectedProviderId === intent.legacyProviderId
            ? 'match'
            : 'divergence';
    }

    return Object.freeze({
        mode: 'shadow-only',
        executed: false,
        legacyProviderId: intent.legacyProviderId,
        selectedProviderId,
        parity,
        reason: decision.reason,
        request: decision.request,
        candidates: Object.freeze(decision.candidates.map(compactCandidate)),
        rejected: Object.freeze(decision.rejected.map(compactRejected)),
    });
}

export {
    LEGACY_PROVIDER_CAPABILITIES,
};
