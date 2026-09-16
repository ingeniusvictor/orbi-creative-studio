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
    'RESOURCE_PROFILE_INVALID',
    'RESOURCE_PROFILE_CONTEXT_MISMATCH',
]);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finitePositiveOrNull(value) {
    return Number.isFinite(value) && value > 0 ? value : null;
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

    const compatibility = shadowEvaluation.compatibility;
    if (!isPlainObject(compatibility)
        || compatibility.schemaVersion !== 1
        || !ALLOWED_COMPATIBILITY_STATUSES.has(compatibility.status)
        || compatibility.routingEligible !== false
        || compatibility.cutoverAuthorized !== false
        || compatibility.executionAuthority !== 'legacy-dispatcher-only') {
        return invalid('DIAGNOSTIC_COMPATIBILITY_INVALID');
    }

    if (!isPlainObject(requestedContext)) return invalid('DIAGNOSTIC_CONTEXT_INVALID');
    const modelId = safeString(requestedContext.modelId);
    const backend = safeString(requestedContext.backend);
    const width = requestedContext.width;
    const height = requestedContext.height;
    if (!modelId || !backend || !Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
        return invalid('DIAGNOSTIC_CONTEXT_INVALID');
    }

    if (typeof capturedAt !== 'string' || !capturedAt.trim()) return invalid('DIAGNOSTIC_TIMESTAMP_INVALID');
    const parsedTime = Date.parse(capturedAt);
    if (!Number.isFinite(parsedTime) || new Date(parsedTime).toISOString() !== capturedAt) {
        return invalid('DIAGNOSTIC_TIMESTAMP_INVALID');
    }

    const reasons = sanitizeReasons(compatibility.reasons);
    if (!reasons) return invalid('DIAGNOSTIC_REASON_SET_INVALID');

    const resourceFit = isPlainObject(compatibility.resourceFit) ? compatibility.resourceFit : {};
    const resourceProfile = isPlainObject(compatibility.resourceProfile) ? compatibility.resourceProfile : {};
    const backendHardware = isPlainObject(compatibility.backendHardware) ? compatibility.backendHardware : {};

    const snapshot = Object.freeze({
        schemaVersion: 1,
        snapshotType: 'p1c10-shadow-compatibility-diagnostics',
        capturedAt,
        mode: 'shadow-diagnostic-only',
        context: Object.freeze({ modelId, backend, width, height }),
        registry: Object.freeze({
            match: shadowEvaluation.registryMatch,
            certifiedProfile: resourceProfile.certified === true,
            profileStatus: safeString(resourceProfile.status) || 'RESOURCE_PROFILE_STATUS_UNAVAILABLE',
        }),
        compatibility: Object.freeze({
            status: compatibility.status,
            candidate: compatibility.compatibilityCandidate === true,
            reasons,
        }),
        hardware: Object.freeze({
            backendState: safeString(backendHardware.state) || 'unknown',
        }),
        resources: Object.freeze({
            systemRam: Object.freeze({
                state: safeString(resourceFit.systemRam) || 'unknown',
                requiredMiB: finitePositiveOrNull(resourceFit.minSystemRamMiB),
                observedMiB: finitePositiveOrNull(resourceFit.observedSystemRamMiB),
            }),
            vram: Object.freeze({
                state: safeString(resourceFit.vram) || 'unknown',
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

export { ALLOWED_COMPATIBILITY_STATUSES, ALLOWED_REASON_CODES, sanitizeReasons };
