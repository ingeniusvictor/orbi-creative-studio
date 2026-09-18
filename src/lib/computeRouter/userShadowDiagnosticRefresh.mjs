import { DEFAULT_PROFILE_TARGETS } from './modelResourceProfiles.mjs';
import {
    createCertifiedResourceProfileRegistry,
    REGISTRY_STATUS,
} from './certifiedResourceProfileRegistry.mjs';
import {
    runShadowCompatibilityDiagnostic,
    SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS,
} from './shadowDiagnosticOrchestrator.mjs';

export const USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS = Object.freeze({
    UPDATED: 'USER_SHADOW_DIAGNOSTIC_REFRESH_UPDATED',
    UNCHANGED: 'USER_SHADOW_DIAGNOSTIC_REFRESH_UNCHANGED',
    REJECTED: 'USER_SHADOW_DIAGNOSTIC_REFRESH_REJECTED',
});

const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);

function defaultGetBridge() {
    if (typeof window === 'undefined') return null;
    return window.orbiComputeRouter || null;
}

function response({
    status,
    reason = null,
    context = null,
    compatibilityStatus = null,
} = {}) {
    return Object.freeze({
        status,
        reason,
        context,
        compatibilityStatus,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function resolveDiagnosticContext(snapshot) {
    if (!snapshot
        || typeof snapshot !== 'object'
        || snapshot.schemaVersion !== 1
        || !snapshot.sdcpp
        || typeof snapshot.sdcpp !== 'object') {
        return Object.freeze({ ok: false, reason: 'REFRESH_READINESS_SNAPSHOT_INVALID' });
    }

    const runtime = snapshot.sdcpp.binaryStatus?.runtime;
    const backend = runtime?.backend;
    if (!CERTIFIABLE_BACKENDS.has(backend)) {
        return Object.freeze({ ok: false, reason: 'REFRESH_RUNTIME_BACKEND_UNAVAILABLE' });
    }

    if (!Array.isArray(snapshot.sdcpp.models)) {
        return Object.freeze({ ok: false, reason: 'REFRESH_MODEL_SET_INVALID' });
    }

    const candidates = [];
    for (const model of snapshot.sdcpp.models) {
        if (!model
            || typeof model !== 'object'
            || model.state !== 'downloaded'
            || (model.provider !== undefined && model.provider !== 'sdcpp')) {
            continue;
        }

        const target = DEFAULT_PROFILE_TARGETS.find((entry) => entry.modelId === model.id);
        if (!target) continue;

        if (candidates.some((candidate) => candidate.modelId === model.id)) {
            return Object.freeze({ ok: false, reason: 'REFRESH_MODEL_CONTEXT_DUPLICATE' });
        }

        candidates.push(Object.freeze({
            modelId: model.id,
            backend,
            width: target.width,
            height: target.height,
        }));
    }

    if (candidates.length === 0) {
        return Object.freeze({ ok: false, reason: 'REFRESH_NO_DIAGNOSTIC_MODEL' });
    }
    if (candidates.length > 1) {
        return Object.freeze({ ok: false, reason: 'REFRESH_DIAGNOSTIC_CONTEXT_AMBIGUOUS' });
    }

    return Object.freeze({ ok: true, reason: null, context: candidates[0] });
}

export function createUserShadowDiagnosticRefresh({
    getBridge = defaultGetBridge,
    runDiagnostic = runShadowCompatibilityDiagnostic,
    createRegistry = () => createCertifiedResourceProfileRegistry({ certifications: [] }),
} = {}) {
    if (typeof getBridge !== 'function') throw new TypeError('readiness bridge resolver must be a function');
    if (typeof runDiagnostic !== 'function') throw new TypeError('shadow diagnostic runner must be a function');
    if (typeof createRegistry !== 'function') throw new TypeError('registry factory must be a function');

    const refresh = async () => {
        let bridge;
        try {
            bridge = getBridge();
        } catch {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_BRIDGE_RESOLUTION_FAILED',
            });
        }

        if (!bridge
            || bridge.isElectron !== true
            || typeof bridge.getReadinessSnapshot !== 'function') {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_BRIDGE_UNAVAILABLE',
            });
        }

        let readiness;
        try {
            readiness = await bridge.getReadinessSnapshot();
        } catch {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_READINESS_FAILED',
            });
        }

        const resolved = resolveDiagnosticContext(readiness);
        if (!resolved.ok) {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: resolved.reason,
            });
        }

        let registryResult;
        try {
            registryResult = createRegistry();
        } catch {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_REGISTRY_FAILED',
                context: resolved.context,
            });
        }

        if (!registryResult
            || registryResult.status !== REGISTRY_STATUS.READY
            || !registryResult.registry
            || registryResult.routingEligible !== false
            || registryResult.cutoverAuthorized !== false
            || registryResult.executionAuthority !== 'legacy-dispatcher-only') {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_REGISTRY_INVALID',
                context: resolved.context,
            });
        }

        let diagnostic;
        try {
            diagnostic = await runDiagnostic({
                registry: registryResult.registry,
                ...resolved.context,
            });
        } catch {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_DIAGNOSTIC_FAILED',
                context: resolved.context,
            });
        }

        const authorityValid = diagnostic
            && diagnostic.diagnosticOnly === true
            && diagnostic.routingEligible === false
            && diagnostic.cutoverAuthorized === false
            && diagnostic.executionAuthority === 'legacy-dispatcher-only';

        if (!authorityValid) {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
                reason: 'REFRESH_DIAGNOSTIC_AUTHORITY_INVALID',
                context: resolved.context,
            });
        }

        if (diagnostic.status === SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.PUBLISHED) {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.UPDATED,
                context: resolved.context,
                compatibilityStatus: diagnostic.compatibilityStatus,
            });
        }

        if (diagnostic.status === SHADOW_DIAGNOSTIC_ORCHESTRATOR_STATUS.UNCHANGED) {
            return response({
                status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.UNCHANGED,
                context: resolved.context,
                compatibilityStatus: diagnostic.compatibilityStatus,
            });
        }

        return response({
            status: USER_SHADOW_DIAGNOSTIC_REFRESH_STATUS.REJECTED,
            reason: 'REFRESH_DIAGNOSTIC_REJECTED',
            context: resolved.context,
            compatibilityStatus: diagnostic.compatibilityStatus || null,
        });
    };

    return Object.freeze({
        refresh,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

const defaultRefresh = createUserShadowDiagnosticRefresh();

export async function runUserShadowDiagnosticRefresh() {
    return defaultRefresh.refresh();
}

export {
    CERTIFIABLE_BACKENDS,
    defaultGetBridge,
    resolveDiagnosticContext,
};
