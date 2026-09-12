import {
    composeCurrentProviderReadiness,
} from './providerReadiness.mjs';
import {
    shadowRouteStudioRequest,
} from './studioShadowRouting.mjs';

function shadowClientError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function unavailable(reason = 'SHADOW_EVALUATION_UNAVAILABLE') {
    return Object.freeze({
        mode: 'shadow-only',
        executed: false,
        status: 'unavailable',
        parity: 'unavailable',
        reason,
        legacyProviderId: null,
        selectedProviderId: null,
    });
}

function defaultReadinessReader(globalObject) {
    return async () => {
        const bridge = globalObject?.orbiComputeRouter;
        if (!bridge
            || bridge.isElectron !== true
            || typeof bridge.getReadinessSnapshot !== 'function') {
            throw shadowClientError(
                'READINESS_BRIDGE_UNAVAILABLE',
                'Compute Router readiness bridge is unavailable'
            );
        }

        const snapshot = await bridge.getReadinessSnapshot();
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
            throw shadowClientError(
                'READINESS_SNAPSHOT_INVALID',
                'Compute Router readiness snapshot is invalid'
            );
        }
        return snapshot;
    };
}

export function createComputeRouterShadowClient({
    readSnapshot,
    globalObject = globalThis,
} = {}) {
    const reader = typeof readSnapshot === 'function'
        ? readSnapshot
        : defaultReadinessReader(globalObject);

    async function evaluateStudioRequest(studioInput) {
        const snapshot = await reader();
        const providers = composeCurrentProviderReadiness(snapshot);
        return shadowRouteStudioRequest(studioInput, providers);
    }

    async function observeStudioRequest(studioInput) {
        try {
            return await evaluateStudioRequest(studioInput);
        } catch {
            // Shadow observation must never become a dependency of the legacy
            // generation path. Internal error details are intentionally omitted.
            return unavailable();
        }
    }

    return Object.freeze({
        mode: 'shadow-only',
        evaluateStudioRequest,
        observeStudioRequest,
    });
}

export const computeRouterShadowClient = createComputeRouterShadowClient();
