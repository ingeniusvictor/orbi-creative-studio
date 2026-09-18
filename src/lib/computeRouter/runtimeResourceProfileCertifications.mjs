function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;

    if (Array.isArray(value)) {
        for (const entry of value) deepFreeze(entry);
    } else {
        for (const entry of Object.values(value)) deepFreeze(entry);
    }

    return Object.freeze(value);
}

/*
 * P1C18 governed runtime certification source.
 *
 * This array is intentionally empty until real P1C8 certification records,
 * derived from controlled benchmark evidence and explicit human approval,
 * are deliberately committed through source review.
 *
 * Do not insert synthetic/demo/fixture certifications here.
 */
const certifications = [];

export const RUNTIME_RESOURCE_PROFILE_CERTIFICATION_SOURCE = deepFreeze({
    schemaVersion: 1,
    sourceType: 'source-controlled-static-bundle',
    sourceRevision: 1,
    certifications,
    authenticityVerified: false,
    routingEligible: false,
    cutoverAuthorized: false,
    executionAuthority: 'legacy-dispatcher-only',
});
