import {
    parseCertificationReleaseEvidenceExport,
    validateCertificationReleaseEvidenceExport,
} from './evidenceExportValidator.mjs';

const EVIDENCE_FINGERPRINT_SCHEMA_VERSION = 1;
const EVIDENCE_FINGERPRINT_ALGORITHM = 'SHA-256';
const EVIDENCE_FINGERPRINT_AUTHORITY = 'legacy-dispatcher-only';

function fingerprintError(message, code = 'INVALID_EVIDENCE_FINGERPRINT') {
    const error = new Error(message);
    error.code = code;
    return error;
}

function canonicalJson(value) {
    if (value === null) return 'null';

    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw fingerprintError('canonical evidence contains a non-finite number');
        }
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys
            .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
            .join(',')}}`;
    }

    throw fingerprintError(`unsupported canonical evidence value type: ${typeof value}`);
}

function canonicalizeEvidenceExport(exportBundle) {
    validateCertificationReleaseEvidenceExport(exportBundle);
    return canonicalJson(exportBundle);
}

function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireCryptoProvider(cryptoProvider) {
    if (
        !cryptoProvider
        || !cryptoProvider.subtle
        || typeof cryptoProvider.subtle.digest !== 'function'
    ) {
        throw fingerprintError(
            'Web Crypto SHA-256 is unavailable',
            'EVIDENCE_FINGERPRINT_CRYPTO_UNAVAILABLE',
        );
    }
    return cryptoProvider;
}

async function sha256Hex(text, cryptoProvider = globalThis?.crypto) {
    const crypto = requireCryptoProvider(cryptoProvider);
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Object.freeze({
        digestHex: bytesToHex(new Uint8Array(digest)),
        canonicalBytes: bytes.byteLength,
    });
}

async function createEvidenceFingerprint(
    exportBundle,
    { cryptoProvider = globalThis?.crypto } = {},
) {
    const validation = validateCertificationReleaseEvidenceExport(exportBundle);
    const canonical = canonicalJson(exportBundle);
    const digest = await sha256Hex(canonical, cryptoProvider);

    return Object.freeze({
        schemaVersion: EVIDENCE_FINGERPRINT_SCHEMA_VERSION,
        algorithm: EVIDENCE_FINGERPRINT_ALGORITHM,
        digestHex: digest.digestHex,
        canonicalBytes: digest.canonicalBytes,
        sourceCommit: validation.sourceCommit,
        profileId: validation.profileId,
        reviewStatus: validation.reviewStatus,
        readyForReview: validation.readyForReview,
        cutoverAuthorized: false,
        executionAuthority: EVIDENCE_FINGERPRINT_AUTHORITY,
        authenticityVerified: false,
    });
}

async function createEvidenceFingerprintFromJson(
    json,
    { cryptoProvider = globalThis?.crypto } = {},
) {
    const parsed = parseCertificationReleaseEvidenceExport(json);
    return createEvidenceFingerprint(parsed.bundle, { cryptoProvider });
}

function validateFingerprintShape(fingerprint) {
    if (!fingerprint || typeof fingerprint !== 'object' || Array.isArray(fingerprint)) {
        throw fingerprintError('fingerprint must be an object');
    }

    const keys = Object.keys(fingerprint).sort();
    const expected = [
        'algorithm',
        'authenticityVerified',
        'canonicalBytes',
        'cutoverAuthorized',
        'digestHex',
        'executionAuthority',
        'profileId',
        'readyForReview',
        'reviewStatus',
        'schemaVersion',
        'sourceCommit',
    ].sort();

    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw fingerprintError('fingerprint fields do not match schema');
    }

    if (fingerprint.schemaVersion !== EVIDENCE_FINGERPRINT_SCHEMA_VERSION) {
        throw fingerprintError('unsupported fingerprint schema version');
    }
    if (fingerprint.algorithm !== EVIDENCE_FINGERPRINT_ALGORITHM) {
        throw fingerprintError('unsupported fingerprint algorithm');
    }
    if (
        typeof fingerprint.digestHex !== 'string'
        || !/^[0-9a-f]{64}$/.test(fingerprint.digestHex)
    ) {
        throw fingerprintError('fingerprint digest must be lowercase SHA-256 hex');
    }
    if (
        !Number.isInteger(fingerprint.canonicalBytes)
        || fingerprint.canonicalBytes <= 0
    ) {
        throw fingerprintError('fingerprint canonicalBytes is invalid');
    }
    if (
        typeof fingerprint.sourceCommit !== 'string'
        || !/^[0-9a-f]{40}$/.test(fingerprint.sourceCommit)
    ) {
        throw fingerprintError('fingerprint sourceCommit is invalid');
    }
    if (typeof fingerprint.profileId !== 'string' || !fingerprint.profileId) {
        throw fingerprintError('fingerprint profileId is invalid');
    }
    if (!['READY_FOR_REVIEW', 'BLOCKED'].includes(fingerprint.reviewStatus)) {
        throw fingerprintError('fingerprint reviewStatus is invalid');
    }
    if (typeof fingerprint.readyForReview !== 'boolean') {
        throw fingerprintError('fingerprint readyForReview must be boolean');
    }
    if (fingerprint.reviewStatus !== (
        fingerprint.readyForReview ? 'READY_FOR_REVIEW' : 'BLOCKED'
    )) {
        throw fingerprintError('fingerprint review state is inconsistent');
    }
    if (fingerprint.cutoverAuthorized !== false) {
        throw fingerprintError('fingerprint cannot authorize cutover');
    }
    if (fingerprint.executionAuthority !== EVIDENCE_FINGERPRINT_AUTHORITY) {
        throw fingerprintError('fingerprint must preserve legacy execution authority');
    }
    if (fingerprint.authenticityVerified !== false) {
        throw fingerprintError('fingerprint cannot claim authenticity verification');
    }

    return fingerprint;
}

async function verifyEvidenceFingerprint(
    exportBundle,
    fingerprint,
    { cryptoProvider = globalThis?.crypto } = {},
) {
    const input = validateFingerprintShape(fingerprint);
    const actual = await createEvidenceFingerprint(exportBundle, { cryptoProvider });

    const matches = (
        input.digestHex === actual.digestHex
        && input.canonicalBytes === actual.canonicalBytes
        && input.sourceCommit === actual.sourceCommit
        && input.profileId === actual.profileId
        && input.reviewStatus === actual.reviewStatus
        && input.readyForReview === actual.readyForReview
    );

    return Object.freeze({
        valid: matches,
        digestMatches: input.digestHex === actual.digestHex,
        metadataMatches: matches || (
            input.sourceCommit === actual.sourceCommit
            && input.profileId === actual.profileId
            && input.reviewStatus === actual.reviewStatus
            && input.readyForReview === actual.readyForReview
            && input.canonicalBytes === actual.canonicalBytes
        ),
        expectedDigestHex: input.digestHex,
        actualDigestHex: actual.digestHex,
        sourceCommit: actual.sourceCommit,
        profileId: actual.profileId,
        reviewStatus: actual.reviewStatus,
        readyForReview: actual.readyForReview,
        cutoverAuthorized: false,
        executionAuthority: EVIDENCE_FINGERPRINT_AUTHORITY,
        authenticityVerified: false,
    });
}

export {
    EVIDENCE_FINGERPRINT_ALGORITHM,
    EVIDENCE_FINGERPRINT_AUTHORITY,
    EVIDENCE_FINGERPRINT_SCHEMA_VERSION,
    canonicalizeEvidenceExport,
    createEvidenceFingerprint,
    createEvidenceFingerprintFromJson,
    validateFingerprintShape,
    verifyEvidenceFingerprint,
};
