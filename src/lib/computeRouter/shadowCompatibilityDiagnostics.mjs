export const SHADOW_DIAGNOSTICS_STATUS = Object.freeze({
    READY: 'SHADOW_COMPATIBILITY_DIAGNOSTICS_READY',
    INVALID: 'SHADOW_COMPATIBILITY_DIAGNOSTICS_INVALID',
});

const ALLOWED_COMPATIBILITY_STATUSES = new Set([
    'COMPATIBILITY_CANDIDATE',
    'COMPATIBILITY_BLOCKED',
    'COMPATIBILITY_UNKNOWN',
]);

const ALLOWED_REASON_CODES = new Set([
    'HARDWARE_EVIDENCE_MISSING',
    'CPU_PLATFORM_EVIDENCE_INCOMPLETE',
    'NVIDIA_GPU_UNAVAILABLE',
    'NVIDIA_GPU_EVIDENCE_MISSING',
    'VULKAN_UNAVAILABLE',
    'VULKAN_EVIDENCE_MISSING',
    'ROCM_UNAVAILABLE',
    'ROCM_EVIDENCE_MISSING',
    'METAL_CAPABILITY_NOT_PROBED',
    'METAL_PLATFORM_MISMATCH',
    'RUNTIME_BACKEND_UNSUPPORTED',
    'SYSTEM_RAM_REQUIREMENT_UNSPECIFIED',
    'SYSTEM_RAM_EVIDENCE_MISSING',
    'INSUFFICIENT_SYSTEM_RAM',
    'VRAM_REQUIREMENT_UNSPECIFIED',
    'VRAM_EVIDENCE_NOT_AVAILABLE_FOR_BACKEND',
    'NVIDIA_VRAM_EVIDENCE_MISSING',
    'INSUFFICIENT_VRAM',
    'RUNTIME_MISSING',
    'RUNTIME_EVIDENCE_MISSING',
    'RUNTIME_BACKEND_MISSING',
    'RUNTIME_MANIFEST_NOT_PINNED',
    'INSTALLED_RUNTIME_INTEGRITY_UNVERIFIED',
    'MODEL_ID_MISSING',
    'MODEL_NOT_INSTALLED',
    'MODEL_EVIDENCE_MISSING',
    'MODEL_AUXILIARY_ASSETS_MISSING',
    'RESOURCE_PROFILE_NOT_PROVIDED',
    'RESOURCE_PROFILE_NOT_CERTIFIED',
    'RESOURCE_PROFILE_CONTEXT_MISMATCH',
]);

const ALLOWED_PROFILE_STATUSES = new Set([
    'RESOURCE_PROFILE_CERTIFIED',
    'RESOURCE_PROFILE_NOT_FOUND',
    'RESOURCE_PROFILE_NOT_CERTIFIED',
    'RESOURCE_PROFILE_INVALID',
    'RESOURCE_PROFILE_CONTEXT_MISMATCH',
]);

const ALLOWED_BACKEND_STATES = new Set(['supported', 'blocked', 'unknown']);
const ALLOWED_SYSTEM_RAM_STATES = new Set(['sufficient', 'insufficient', 'unknown']);
const ALLOWED_VRAM_STATES = new Set(['sufficient', 'insufficient', 'unknown', 'not-applicable']);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finitePositiveOrNull(value) {
    return Number.isFinite(value) && value > 0 ? value : null;
}

function validOptionalPositive(value) {
    return value === undefined || value === null || (Number.isFinite(value) && value > 0);
}

function safeString(value, maxLength = 120) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    if (!/^[a-zA-Z0-9._:+@/ -]+$/.test(trimmed)) return null;
    return trimmed;
}

function invalid(reason) {
    return Object.freeze({
        status: SHADOW_DIAGNOSTICS_STATUS.INVALID,
        reason,
        snapshot: null,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sanitizeReasons(reasons) {
    if (!Array.isArray(reasons)) return null;
    const sanitized = [];
    for (const reason of reasons) {
        if (typeof reason !== 'string' || !ALLOWED_REASON_CODES.has(reason)) {
            return null;
        }
        if (!sanitized.includes(reason)) sanitized.push(reason);
    }
    return Object.freeze(sanitized);
}

export function createShadowCompatibilityDiagnostics({
    shadowEvaluation,
    requestedContext,
    capturedAt,
} = {}) {
    if (!isPlainObject(shadowEvaluation)) return invalid('DIAGNOSTIC_SHADOW_EVALUATION_INVALID');
    if (shadowEvaluation.mode !== 'shadow-diagnostic-only'
        || typeof shadowEvaluation.registryMatch !== 'boolean'
        || shadowEvaluation.routingEligible !== false
        || shadowEvaluation.cutoverAuthorized !== false
        || shadowEvaluation.executionAuthority !== 'legacy-dispatcher-only') {
        return invalid('DIAGNOSTIC_SHADOW_AUTHORITY_INVALID');
    }

    if (!isPlainObject(requestedContext) || !isPlainObject(shadowEvaluation.context)) {
        return invalid('DIAGNOSTIC_CONTEXT_INVALID');
    }
    const modelId = safeString(requestedContext.modelId);
    const backend = safeString(requestedContext.backend);
    const width = requestedContext.width;
    const height = requestedContext.height;
    if (!modelId || !backend || !Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        return invalid('DIAGNOSTIC_CONTEXT_INVALID');
    }
    if (shadowEvaluation.context.modelId !== modelId
        || shadowEvaluation.context.backend !== backend
        || shadowEvaluation.context.width !== width
        || shadowEvaluation.context.height !== height) {
        return invalid('DIAGNOSTIC_CONTEXT_MISMATCH');
    }

    const compatibility = shadowEvaluation.compatibility;
    if (!isPlainObject(compatibility)
        || compatibility.schemaVersion !== 1
        || !ALLOWED_COMPATIBILITY_STATUSES.has(compatibility.status)
        || compatibility.compatibilityCandidate !== (compatibility.status === 'COMPATIBILITY_CANDIDATE')
        || compatibility.routingEligible !== false
        || compatibility.cutoverAuthorized !== false
        || compatibility.executionAuthority !== 'legacy-dispatcher-only'
        || compatibility.model?.id !== modelId
        || compatibility.runtime?.backend !== backend) {
        return invalid('DIAGNOSTIC_COMPATIBILITY_INVALID');
    }

    if (typeof capturedAt !== 'string' || !capturedAt.trim()) return invalid('DIAGNOSTIC_TIMESTAMP_INVALID');
    const parsedTime = Date.parse(capturedAt);
    if (!Number.isFinite(parsedTime) || new Date(parsedTime).toISOString() !== capturedAt) {
        return invalid('DIAGNOSTIC_TIMESTAMP_INVALID');
    }

    const reasons = sanitizeReasons(compatibility.reasons);
    if (!reasons) return invalid('DIAGNOSTIC_REASON_SET_INVALID');

    const resourceFit = compatibility.resourceFit;
    const resourceProfile = compatibility.resourceProfile;
    const backendHardware = compatibility.backendHardware;
    if (!isPlainObject(resourceFit)
        || !isPlainObject(resourceProfile)
        || !isPlainObject(backendHardware)
        || !ALLOWED_PROFILE_STATUSES.has(resourceProfile.status)
        || typeof resourceProfile.certified !== 'boolean'
        || resourceProfile.certified !== (resourceProfile.status === 'RESOURCE_PROFILE_CERTIFIED')
        || shadowEvaluation.registryMatch !== resourceProfile.certified
        || !ALLOWED_BACKEND_STATES.has(backendHardware.state)
        || !ALLOWED_SYSTEM_RAM_STATES.has(resourceFit.systemRam)
        || !ALLOWED_VRAM_STATES.has(resourceFit.vram)
        || !validOptionalPositive(resourceFit.minSystemRamMiB)
        || !validOptionalPositive(resourceFit.observedSystemRamMiB)
        || !validOptionalPositive(resourceFit.minVramMiB)
        || !validOptionalPositive(resourceFit.observedVramMiB)) {
        return invalid('DIAGNOSTIC_DETAIL_SET_INVALID');
    }

    const snapshot = Object.freeze({
        schemaVersion: 1,
        snapshotType: 'p1c10-shadow-compatibility-diagnostics',
        capturedAt,
        mode: 'shadow-diagnostic-only',
        context: Object.freeze({ modelId, backend, width, height }),
        registry: Object.freeze({
            match: shadowEvaluation.registryMatch,
            certifiedProfile: resourceProfile.certified,
            profileStatus: resourceProfile.status,
        }),
        compatibility: Object.freeze({
            status: compatibility.status,
            candidate: compatibility.compatibilityCandidate,
            reasons,
        }),
        hardware: Object.freeze({
            backendState: backendHardware.state,
        }),
        resources: Object.freeze({
            systemRam: Object.freeze({
                state: resourceFit.systemRam,
                requiredMiB: finitePositiveOrNull(resourceFit.minSystemRamMiB),
                observedMiB: finitePositiveOrNull(resourceFit.observedSystemRamMiB),
            }),
            vram: Object.freeze({
                state: resourceFit.vram,
                requiredMiB: finitePositiveOrNull(resourceFit.minVramMiB),
                observedMiB: finitePositiveOrNull(resourceFit.observedVramMiB),
            }),
        }),
        boundaries: Object.freeze({
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
    });

    return Object.freeze({
        status: SHADOW_DIAGNOSTICS_STATUS.READY,
        reason: null,
        snapshot,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export {
    ALLOWED_BACKEND_STATES,
    ALLOWED_COMPATIBILITY_STATUSES,
    ALLOWED_PROFILE_STATUSES,
    ALLOWED_REASON_CODES,
    ALLOWED_SYSTEM_RAM_STATES,
    ALLOWED_VRAM_STATES,
    sanitizeReasons,
};
