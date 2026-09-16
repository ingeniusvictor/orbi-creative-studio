const SHA_RE = /^[0-9a-f]{40}$/i;

function unavailable(reason = 'build-identity-unavailable') {
    return Object.freeze({
        schemaVersion: 1,
        available: false,
        sourceCommit: null,
        appVersion: null,
        reason,
    });
}

function normalizeRendererBuildIdentity(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return unavailable();
    }

    if (
        input.schemaVersion !== 1
        || input.available !== true
        || typeof input.sourceCommit !== 'string'
        || !SHA_RE.test(input.sourceCommit)
        || typeof input.appVersion !== 'string'
        || !input.appVersion.trim()
    ) {
        return unavailable('build-identity-invalid');
    }

    return Object.freeze({
        schemaVersion: 1,
        available: true,
        sourceCommit: input.sourceCommit.toLowerCase(),
        appVersion: input.appVersion.trim(),
        reason: null,
    });
}

function getRendererBuildIdentity(source = globalThis?.orbiBuildIdentity) {
    return normalizeRendererBuildIdentity(source);
}

function requireRendererBuildIdentity(source = globalThis?.orbiBuildIdentity) {
    const identity = getRendererBuildIdentity(source);
    if (!identity.available) {
        const error = new Error(identity.reason || 'build identity unavailable');
        error.code = 'BUILD_IDENTITY_UNAVAILABLE';
        throw error;
    }
    return identity;
}

export {
    getRendererBuildIdentity,
    normalizeRendererBuildIdentity,
    requireRendererBuildIdentity,
};
