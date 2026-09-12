import { createProviderDescriptor } from './contracts.mjs';
import {
    STUDIO_PARITY_PROFILE_ID,
    STUDIO_PARITY_TARGETS,
} from './studioParityTargets.mjs';

const CUTOVER_ELIGIBILITY_SCHEMA_VERSION = 1;
const CUTOVER_EXECUTION_AUTHORITY = 'legacy-dispatcher-only';

const REQUIRED_RELEASE_GATES = Object.freeze([
    'ciGreen',
    'platformMatrixGreen',
    'securityReviewApproved',
    'rollbackPlanApproved',
]);

function normalizeReleaseGates(input = {}) {
    const gates = {};
    for (const gate of REQUIRED_RELEASE_GATES) {
        gates[gate] = input?.[gate] === true;
    }
    return Object.freeze(gates);
}

function missingReleaseGates(gates) {
    return Object.freeze(
        REQUIRED_RELEASE_GATES.filter((gate) => gates[gate] !== true),
    );
}

function certificationRouteMap(certification) {
    if (!certification || typeof certification !== 'object' || Array.isArray(certification)) {
        return new Map();
    }

    const routes = Array.isArray(certification.routes) ? certification.routes : [];
    const map = new Map();

    for (const route of routes) {
        if (!route || typeof route !== 'object') continue;
        const key = typeof route.routeKey === 'string' ? route.routeKey.trim() : '';
        if (!key || map.has(key)) continue;
        map.set(key, route);
    }

    return map;
}

function providerMap(providers = []) {
    if (!Array.isArray(providers)) return new Map();

    const map = new Map();
    for (const providerInput of providers) {
        try {
            const provider = createProviderDescriptor(providerInput);
            if (!map.has(provider.id)) map.set(provider.id, provider);
        } catch {
            // Invalid provider evidence is ignored and therefore fails closed as missing.
        }
    }
    return map;
}

function capabilityModelIds(provider, operation) {
    if (!provider) return new Set();
    return new Set(
        provider.capabilities
            .filter((capability) => capability.operations.includes(operation))
            .map((capability) => capability.modelId),
    );
}

function evaluateCertificationRoute(target, route) {
    const reasons = [];

    if (!route) {
        reasons.push('parity-route-missing');
        return Object.freeze({ valid: false, reasons: Object.freeze(reasons) });
    }

    if (route.expectedProviderId !== target.expectedProviderId) {
        reasons.push('parity-provider-mismatch');
    }
    if (route.operation !== target.operation) {
        reasons.push('parity-operation-mismatch');
    }
    if (route.certified !== true) {
        reasons.push('parity-not-certified');
    }

    const minSamples = Number(route.minSamples);
    const samples = Number(route.samples);
    const matches = Number(route.matches);
    const blocked = Number(route.blocked);
    const mismatches = Number(route.mismatches);
    const minDistinctModels = Number(route.minDistinctModels);
    const distinctModels = Number(route.distinctModels);

    if (!Number.isFinite(minSamples) || minSamples < target.minSamples) {
        reasons.push('parity-sample-threshold-weakened');
    }
    if (!Number.isFinite(samples) || samples < target.minSamples) {
        reasons.push('parity-samples-insufficient');
    }
    if (!Number.isFinite(matches) || matches !== samples) {
        reasons.push('parity-non-match-evidence');
    }
    if (!Number.isFinite(blocked) || blocked !== 0) {
        reasons.push('parity-blocked-evidence');
    }
    if (!Number.isFinite(mismatches) || mismatches !== 0) {
        reasons.push('parity-mismatch-evidence');
    }
    if (!Number.isFinite(minDistinctModels) || minDistinctModels < target.minDistinctModels) {
        reasons.push('parity-model-threshold-weakened');
    }
    if (!Number.isFinite(distinctModels) || distinctModels < target.minDistinctModels) {
        reasons.push('parity-model-coverage-insufficient');
    }

    const modelIds = Array.isArray(route.modelIds)
        ? [...new Set(route.modelIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
        : [];

    if (modelIds.length < target.minDistinctModels) {
        reasons.push('parity-model-identities-insufficient');
    }

    return Object.freeze({
        valid: reasons.length === 0,
        reasons: Object.freeze(reasons),
        modelIds: Object.freeze(modelIds),
    });
}

function evaluateProviderRoute(target, provider, certifiedModelIds = []) {
    const reasons = [];

    if (!provider) {
        reasons.push('provider-readiness-missing');
        return Object.freeze({ valid: false, reasons: Object.freeze(reasons) });
    }

    if (provider.health !== 'ready') {
        reasons.push(`provider-health:${provider.health}`);
    }

    if (!['available', 'not-required'].includes(provider.credentials)) {
        reasons.push(`provider-credentials:${provider.credentials}`);
    }

    const models = capabilityModelIds(provider, target.operation);
    if (!models.size) {
        reasons.push('provider-operation-unsupported');
    }

    const missingModels = certifiedModelIds.filter((modelId) => !models.has(modelId));
    if (missingModels.length) {
        reasons.push(`provider-models-missing:${missingModels.join(',')}`);
    }

    return Object.freeze({
        valid: reasons.length === 0,
        reasons: Object.freeze(reasons),
        supportedModelIds: Object.freeze([...models].sort()),
    });
}

function profileMatchesCertification(certificationRoutes) {
    const expected = new Set(STUDIO_PARITY_TARGETS.map((target) => target.routeKey));
    const actual = new Set(certificationRoutes.keys());

    if (expected.size !== actual.size) return false;
    for (const key of expected) {
        if (!actual.has(key)) return false;
    }
    return true;
}

function assessStudioCutoverEligibility({
    certification,
    providers = [],
    releaseGates = {},
    profileId = STUDIO_PARITY_PROFILE_ID,
} = {}) {
    const gates = normalizeReleaseGates(releaseGates);
    const missingGates = missingReleaseGates(gates);
    const certificationRoutes = certificationRouteMap(certification);
    const providersById = providerMap(providers);

    const profileMatches = profileId === STUDIO_PARITY_PROFILE_ID
        && profileMatchesCertification(certificationRoutes);

    const certificationGloballyCertified = Boolean(
        certification
        && certification.certified === true
        && certification.reason === 'PARITY_CERTIFIED'
    );

    const routes = STUDIO_PARITY_TARGETS.map((target) => {
        const parity = evaluateCertificationRoute(
            target,
            certificationRoutes.get(target.routeKey),
        );
        const provider = providersById.get(target.expectedProviderId);
        const readiness = evaluateProviderRoute(
            target,
            provider,
            parity.modelIds || [],
        );

        const reasons = [
            ...parity.reasons,
            ...readiness.reasons,
        ];

        if (!profileMatches) reasons.push('certification-profile-mismatch');
        if (!certificationGloballyCertified) reasons.push('certification-global-not-certified');
        for (const gate of missingGates) reasons.push(`release-gate:${gate}`);

        return Object.freeze({
            routeKey: target.routeKey,
            expectedProviderId: target.expectedProviderId,
            operation: target.operation,
            eligibleForCutoverReview: reasons.length === 0,
            cutoverAuthorized: false,
            executionAuthority: CUTOVER_EXECUTION_AUTHORITY,
            certifiedModelIds: parity.modelIds || Object.freeze([]),
            reasons: Object.freeze(reasons),
        });
    });

    const eligibleForCutoverReview = (
        profileMatches
        && certificationGloballyCertified
        && missingGates.length === 0
        && routes.every((route) => route.eligibleForCutoverReview)
    );

    return Object.freeze({
        schemaVersion: CUTOVER_ELIGIBILITY_SCHEMA_VERSION,
        profileId: STUDIO_PARITY_PROFILE_ID,
        requestedProfileId: profileId,
        profileMatches,
        certificationGloballyCertified,
        releaseGates: gates,
        missingReleaseGates: missingGates,
        eligibleForCutoverReview,
        cutoverAuthorized: false,
        executionAuthority: CUTOVER_EXECUTION_AUTHORITY,
        reason: eligibleForCutoverReview
            ? 'ELIGIBLE_FOR_CUTOVER_REVIEW'
            : 'NOT_ELIGIBLE_FOR_CUTOVER_REVIEW',
        routes: Object.freeze(routes),
    });
}

export {
    CUTOVER_ELIGIBILITY_SCHEMA_VERSION,
    CUTOVER_EXECUTION_AUTHORITY,
    REQUIRED_RELEASE_GATES,
    assessStudioCutoverEligibility,
    normalizeReleaseGates,
};
