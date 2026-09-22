import { buildUserHardwarePilotEvidenceBundle } from './hardwarePilotEvidenceBundle.mjs';
import { validateTarget } from './userBenchmarkSession.mjs';

export const USER_HARDWARE_PILOT_EXPORT_STATUS = Object.freeze({
    WRITTEN: 'USER_HARDWARE_PILOT_EXPORT_WRITTEN',
    CANCELED: 'USER_HARDWARE_PILOT_EXPORT_CANCELED',
    REJECTED: 'USER_HARDWARE_PILOT_EXPORT_REJECTED',
});

const SHA256 = /^[a-f0-9]{64}$/;

function authorityFields() {
    return Object.freeze({
        exportOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason, target = null) {
    return Object.freeze({
        status: USER_HARDWARE_PILOT_EXPORT_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        summary: null,
        ...authorityFields(),
    });
}

function defaultGetBridge() {
    if (typeof window === 'undefined') return null;
    return window.orbiBenchmark || null;
}

function safeFileName(value) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= 255
        && !value.includes('/')
        && !value.includes('\\')
        && value !== '.'
        && value !== '..';
}

function validateWrittenResult(result) {
    return Boolean(
        result
        && result.status === 'HARDWARE_PILOT_EXPORT_WRITTEN'
        && result.reason === null
        && safeFileName(result.fileName)
        && typeof result.sha256 === 'string'
        && SHA256.test(result.sha256)
        && Number.isInteger(result.bytes)
        && result.bytes > 0
        && result.routingEligible === false
        && result.cutoverAuthorized === false
        && result.executionAuthority === 'legacy-dispatcher-only'
        && !Object.hasOwn(result, 'filePath')
        && !Object.hasOwn(result, 'path')
    );
}

function validateCanceledResult(result) {
    return Boolean(
        result
        && result.status === 'HARDWARE_PILOT_EXPORT_CANCELED'
        && result.reason === null
        && result.fileName === null
        && result.sha256 === null
        && result.bytes === 0
        && result.routingEligible === false
        && result.cutoverAuthorized === false
        && result.executionAuthority === 'legacy-dispatcher-only'
        && !Object.hasOwn(result, 'filePath')
        && !Object.hasOwn(result, 'path')
    );
}

export async function exportUserHardwarePilotEvidence(target, {
    buildBundle = buildUserHardwarePilotEvidenceBundle,
    getBridge = defaultGetBridge,
} = {}) {
    const targetValidation = validateTarget(target);
    if (!targetValidation.ok) return rejected(targetValidation.reason);
    const normalizedTarget = targetValidation.target;

    if (typeof buildBundle !== 'function' || typeof getBridge !== 'function') {
        return rejected('USER_HARDWARE_PILOT_EXPORT_DEPENDENCY_INVALID', normalizedTarget);
    }

    let pilot;
    try {
        pilot = buildBundle(normalizedTarget);
    } catch {
        return rejected('USER_HARDWARE_PILOT_EXPORT_BUNDLE_UNAVAILABLE', normalizedTarget);
    }

    if (!pilot
        || pilot.status !== 'HARDWARE_PILOT_EVIDENCE_READY'
        || pilot.reason !== null
        || !pilot.bundle
        || pilot.pilotEvidenceOnly !== true
        || pilot.requiresHumanReview !== true
        || pilot.productionProfilePromoted !== false
        || pilot.routingEligible !== false
        || pilot.cutoverAuthorized !== false
        || pilot.executionAuthority !== 'legacy-dispatcher-only') {
        return rejected('USER_HARDWARE_PILOT_EXPORT_BUNDLE_NOT_READY', normalizedTarget);
    }

    let bridge;
    try {
        bridge = getBridge();
    } catch {
        return rejected('USER_HARDWARE_PILOT_EXPORT_BRIDGE_UNAVAILABLE', normalizedTarget);
    }

    if (!bridge
        || bridge.isElectron !== true
        || typeof bridge.exportPilotBundle !== 'function') {
        return rejected('USER_HARDWARE_PILOT_EXPORT_BRIDGE_UNAVAILABLE', normalizedTarget);
    }

    let result;
    try {
        result = await bridge.exportPilotBundle(pilot.bundle);
    } catch {
        return rejected('USER_HARDWARE_PILOT_EXPORT_EXECUTION_FAILED', normalizedTarget);
    }

    if (validateCanceledResult(result)) {
        return Object.freeze({
            status: USER_HARDWARE_PILOT_EXPORT_STATUS.CANCELED,
            reason: null,
            context: normalizedTarget,
            summary: null,
            ...authorityFields(),
        });
    }

    if (!validateWrittenResult(result)) {
        return rejected('USER_HARDWARE_PILOT_EXPORT_RESULT_INVALID', normalizedTarget);
    }

    return Object.freeze({
        status: USER_HARDWARE_PILOT_EXPORT_STATUS.WRITTEN,
        reason: null,
        context: normalizedTarget,
        summary: Object.freeze({
            fileName: result.fileName,
            sha256: result.sha256,
            bytes: result.bytes,
        }),
        ...authorityFields(),
    });
}

export {
    defaultGetBridge,
    safeFileName,
    validateCanceledResult,
    validateWrittenResult,
};
