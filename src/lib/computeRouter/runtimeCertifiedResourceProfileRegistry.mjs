import {
    createCertifiedResourceProfileRegistry,
    REGISTRY_STATUS,
} from './certifiedResourceProfileRegistry.mjs';
import {
    RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
} from './runtimeResourceProfileCertifications.mjs';

const SOURCE_KEYS = new Set([
    'schemaVersion',
    'sourceType',
    'sourceRevision',
    'certifications',
    'authenticityVerified',
    'routingEligible',
    'cutoverAuthorized',
    'executionAuthority',
]);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function isDeepFrozen(value) {
    if (!value || typeof value !== 'object') return true;
    if (!Object.isFrozen(value)) return false;
    return Object.values(value).every((entry) => isDeepFrozen(entry));
}

function invalid(reason) {
    return Object.freeze({
        status: 'RUNTIME_CERTIFIED_RESOURCE_PROFILE_REGISTRY_INVALID',
        reason,
        registry: null,
        sourceType: 'source-controlled-static-bundle',
        certificationCount: 0,
        sourceContractValid: false,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateRuntimeCertificationSource(source) {
    if (!hasExactKeys(source, SOURCE_KEYS)) {
        return Object.freeze({ ok: false, reason: 'RUNTIME_CERTIFICATION_SOURCE_SHAPE_INVALID' });
    }
    if (source.schemaVersion !== 1
        || source.sourceType !== 'source-controlled-static-bundle'
        || source.sourceRevision !== 1
        || !Array.isArray(source.certifications)) {
        return Object.freeze({ ok: false, reason: 'RUNTIME_CERTIFICATION_SOURCE_IDENTITY_INVALID' });
    }
    if (source.authenticityVerified !== false
        || source.routingEligible !== false
        || source.cutoverAuthorized !== false
        || source.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'RUNTIME_CERTIFICATION_SOURCE_AUTHORITY_INVALID' });
    }
    if (!isDeepFrozen(source)) {
        return Object.freeze({ ok: false, reason: 'RUNTIME_CERTIFICATION_SOURCE_MUTABLE' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        certifications: source.certifications,
    });
}

export function loadRuntimeCertifiedResourceProfileRegistry() {
    const sourceValidation = validateRuntimeCertificationSource(
        RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE,
    );
    if (!sourceValidation.ok) return invalid(sourceValidation.reason);

    const registryResult = createCertifiedResourceProfileRegistry({
        certifications: sourceValidation.certifications,
    });
    if (registryResult.status !== REGISTRY_STATUS.READY
        || !registryResult.registry
        || registryResult.routingEligible !== false
        || registryResult.cutoverAuthorized !== false
        || registryResult.executionAuthority !== 'legacy-dispatcher-only') {
        return invalid(registryResult.reason || 'RUNTIME_CERTIFICATION_REGISTRY_REJECTED');
    }

    return Object.freeze({
        status: REGISTRY_STATUS.READY,
        reason: null,
        registry: registryResult.registry,
        sourceType: RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE.sourceType,
        certificationCount: sourceValidation.certifications.length,
        sourceContractValid: true,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export {
    SOURCE_KEYS,
    hasExactKeys,
    isDeepFrozen,
    validateRuntimeCertificationSource,
};
