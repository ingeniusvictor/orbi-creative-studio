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

function validateIdentity(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return unavailable();
    }

    if (
        input.schemaVersion !== 1
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

function loadBuildIdentity() {
    try {
        // Generated before Vite/Electron packaging by scripts/write-build-identity.js.
        const generated = require('../generated/buildIdentity.js');
        return validateIdentity(generated);
    } catch {
        return unavailable();
    }
}

const BUILD_IDENTITY = loadBuildIdentity();

function getBuildIdentity() {
    return BUILD_IDENTITY;
}

module.exports = Object.freeze({
    BUILD_IDENTITY,
    getBuildIdentity,
    validateIdentity,
});
