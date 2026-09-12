import {
    DEFAULT_MAX_EVIDENCE_AGE_MS,
    DEFAULT_MAX_FUTURE_SKEW_MS,
} from './parityCertification.mjs';
import {
    STUDIO_PARITY_PROFILE_ID,
    STUDIO_PARITY_TARGETS,
} from './studioParityTargets.mjs';

const PARITY_BUILD_BINDING_SCHEMA_VERSION = 1;
const PARITY_BUILD_EXECUTION_AUTHORITY = 'legacy-dispatcher-only';

function bindingError(message) {
    const error = new Error(message);
    error.code = 'INVALID_PARITY_BUILD_BINDING';
    return error;
}

function normalizeCommit(value, label = 'sourceCommit') {
    if (typeof value !== 'string' || !/^[0-9a-f]{40}$/i.test(value.trim())) {
        throw bindingError(`${label} must be a 40-character Git commit SHA`);
    }
    return value.trim().toLowerCase();
}

function requireString(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        throw bindingError(`${label} must be a non-empty string`);
    }
    return value.trim();
}

function normalizeTimestamp(value, label) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw bindingError(`${label} must be a positive finite timestamp`);
    }
    return timestamp;
}

function routeMap(certification) {
    const map = new Map();
    const duplicates = new Set();

    if (!certification || typeof certification !== 'object' || Array.isArray(certification)) {
        return Object.freeze({ map, duplicates });
    }

    const routes = Array.isArray(certification.routes) ? certification.routes : [];
    for (const route of routes) {
        if (!route || typeof route !== 'object' || Array.isArray(route)) continue;
        const key = typeof route.routeKey === 'string' ? route.routeKey.trim() : '';
        if (!key) continue;
        if (map.has(key)) {
            duplicates.add(key);
            continue;
        }
        map.set(key, route);
    }

    return Object.freeze({ map, duplicates });
}

function exactProfileMatch(certification) {
    const state = routeMap(certification);
    if (state.duplicates.size) return false;

    const expected = new Set(STUDIO_PARITY_TARGETS.map((target) => target.routeKey));
    if (state.map.size !== expected.size) return false;

    for (const routeKey of expected) {
        if (!state.map.has(routeKey)) return false;
    }
    return true;
}

function certificationIntegrity(certification) {
    const reasons = [];

    if (!certification || typeof certification !== 'object' || Array.isArray(certification)) {
        return Object.freeze({
            valid: false,
            reasons: Object.freeze(['certification-missing']),
        });
    }

    if (certification.schemaVersion !== 1) reasons.push('certification-schema-invalid');

    const maxEvidenceAgeMs = Number(certification.maxEvidenceAgeMs);
    const maxFutureSkewMs = Number(certification.maxFutureSkewMs);

    if (
        !Number.isFinite(maxEvidenceAgeMs)
        || maxEvidenceAgeMs <= 0
        || maxEvidenceAgeMs > DEFAULT_MAX_EVIDENCE_AGE_MS
    ) {
        reasons.push('certification-evidence-age-weakened');
    }

    if (
        !Number.isFinite(maxFutureSkewMs)
        || maxFutureSkewMs < 0
        || maxFutureSkewMs > DEFAULT_MAX_FUTURE_SKEW_MS
    ) {
        reasons.push('certification-future-skew-weakened');
    }

    if (!exactProfileMatch(certification)) {
        reasons.push('certification-profile-mismatch');
    }

    const state = routeMap(certification);
    if (state.duplicates.size) {
        reasons.push('certification-route-duplicates');
    }

    for (const target of STUDIO_PARITY_TARGETS) {
        const route = state.map.get(target.routeKey);
        if (!route) {
            reasons.push(`route-missing:${target.routeKey}`);
            continue;
        }

        if (route.expectedProviderId !== target.expectedProviderId) {
            reasons.push(`route-provider-mismatch:${target.routeKey}`);
        }
        if (route.operation !== target.operation) {
            reasons.push(`route-operation-mismatch:${target.routeKey}`);
        }

        const samples = Number(route.samples);
        const matches = Number(route.matches);
        const blocked = Number(route.blocked);
        const mismatches = Number(route.mismatches);
        const distinctModels = Number(route.distinctModels);
        const minSamples = Number(route.minSamples);
        const minDistinctModels = Number(route.minDistinctModels);

        if (!Number.isFinite(minSamples) || minSamples < target.minSamples) {
            reasons.push(`route-min-samples-weakened:${target.routeKey}`);
        }
        if (!Number.isFinite(samples) || samples < target.minSamples) {
            reasons.push(`route-samples-insufficient:${target.routeKey}`);
        }
        if (!Number.isFinite(matches) || matches !== samples) {
            reasons.push(`route-non-match-evidence:${target.routeKey}`);
        }
        if (!Number.isFinite(blocked) || blocked !== 0) {
            reasons.push(`route-blocked-evidence:${target.routeKey}`);
        }
        if (!Number.isFinite(mismatches) || mismatches !== 0) {
            reasons.push(`route-mismatch-evidence:${target.routeKey}`);
        }
        if (!Number.isFinite(minDistinctModels) || minDistinctModels < target.minDistinctModels) {
            reasons.push(`route-min-models-weakened:${target.routeKey}`);
        }
        if (!Number.isFinite(distinctModels) || distinctModels < target.minDistinctModels) {
            reasons.push(`route-models-insufficient:${target.routeKey}`);
        }

        const modelIds = Array.isArray(route.modelIds)
            ? route.modelIds.filter((id) => typeof id === 'string' && id.trim())
            : [];
        if (modelIds.length < target.minDistinctModels) {
            reasons.push(`route-model-identities-insufficient:${target.routeKey}`);
        }

        if (route.certified !== true) {
            reasons.push(`route-not-certified:${target.routeKey}`);
        }
    }

    const globallyCertified = certification.certified === true
        && certification.reason === 'PARITY_CERTIFIED'
        && reasons.length === 0;

    if (!globallyCertified) reasons.push('certification-global-not-certified');

    return Object.freeze({
        valid: reasons.length === 0,
        reasons: Object.freeze([...new Set(reasons)]),
    });
}

function cloneCertification(certification) {
    const routes = Array.isArray(certification.routes)
        ? certification.routes.map((route) => Object.freeze({
            routeKey: String(route.routeKey || ''),
            expectedProviderId: String(route.expectedProviderId || ''),
            operation: String(route.operation || ''),
            minSamples: Number(route.minSamples),
            minDistinctModels: Number(route.minDistinctModels),
            samples: Number(route.samples),
            matches: Number(route.matches),
            blocked: Number(route.blocked),
            mismatches: Number(route.mismatches),
            distinctModels: Number(route.distinctModels),
            modelIds: Object.freeze(Array.isArray(route.modelIds) ? [...route.modelIds] : []),
            certified: route.certified === true,
            reasons: Object.freeze(Array.isArray(route.reasons) ? [...route.reasons] : []),
        }))
        : [];

    return Object.freeze({
        schemaVersion: certification.schemaVersion,
        certified: certification.certified === true,
        reason: String(certification.reason || ''),
        maxEvidenceAgeMs: Number(certification.maxEvidenceAgeMs),
        maxFutureSkewMs: Number(certification.maxFutureSkewMs),
        routes: Object.freeze(routes),
    });
}

function bindParityCertificationToBuild({
    sourceCommit,
    bindingId,
    boundAt = Date.now(),
    profileId = STUDIO_PARITY_PROFILE_ID,
    certification,
} = {}) {
    const commit = normalizeCommit(sourceCommit);
    const id = requireString(bindingId, 'bindingId');
    const timestamp = normalizeTimestamp(boundAt, 'boundAt');

    if (profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw bindingError(`unsupported parity profile: ${profileId}`);
    }

    const integrity = certificationIntegrity(certification);
    const snapshot = certification && typeof certification === 'object'
        ? cloneCertification(certification)
        : undefined;

    return Object.freeze({
        schemaVersion: PARITY_BUILD_BINDING_SCHEMA_VERSION,
        sourceCommit: commit,
        profileId: STUDIO_PARITY_PROFILE_ID,
        bindingId: id,
        boundAt: timestamp,
        bindingValid: integrity.valid,
        status: integrity.valid
            ? 'PARITY_CERTIFICATION_BOUND'
            : 'PARITY_CERTIFICATION_REJECTED',
        reasons: integrity.reasons,
        cutoverAuthorized: false,
        executionAuthority: PARITY_BUILD_EXECUTION_AUTHORITY,
        certification: snapshot,
    });
}

function extractBoundCertification(binding, expectedSourceCommit) {
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
        throw bindingError('parity build binding is required');
    }

    if (binding.schemaVersion !== PARITY_BUILD_BINDING_SCHEMA_VERSION) {
        throw bindingError('unsupported parity build binding schema version');
    }

    const sourceCommit = normalizeCommit(binding.sourceCommit);
    const expectedCommit = normalizeCommit(expectedSourceCommit, 'expectedSourceCommit');

    if (sourceCommit !== expectedCommit) {
        throw bindingError('parity certification build commit mismatch');
    }

    if (binding.profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw bindingError('parity certification profile mismatch');
    }

    requireString(binding.bindingId, 'bindingId');
    normalizeTimestamp(binding.boundAt, 'boundAt');

    if (binding.cutoverAuthorized !== false) {
        throw bindingError('parity build binding cannot authorize cutover');
    }

    if (binding.executionAuthority !== PARITY_BUILD_EXECUTION_AUTHORITY) {
        throw bindingError('parity build binding must preserve legacy execution authority');
    }

    const integrity = certificationIntegrity(binding.certification);
    if (!integrity.valid || binding.bindingValid !== true) {
        throw bindingError(
            `bound parity certification is invalid: ${integrity.reasons.join(',') || 'unknown'}`,
        );
    }

    return cloneCertification(binding.certification);
}

export {
    PARITY_BUILD_BINDING_SCHEMA_VERSION,
    PARITY_BUILD_EXECUTION_AUTHORITY,
    bindParityCertificationToBuild,
    certificationIntegrity,
    extractBoundCertification,
};
