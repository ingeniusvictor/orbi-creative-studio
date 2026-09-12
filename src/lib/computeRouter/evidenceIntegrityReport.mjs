import {
    validateCertificationReleaseEvidenceExport,
} from './evidenceExportValidator.mjs';
import {
    validateFingerprintShape,
    verifyEvidenceFingerprint,
} from './evidenceFingerprint.mjs';

const EVIDENCE_INTEGRITY_REPORT_SCHEMA_VERSION = 1;
const EVIDENCE_INTEGRITY_REPORT_AUTHORITY = 'legacy-dispatcher-only';

function positiveTimestamp(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        const error = new Error('checkedAt must be a positive finite timestamp');
        error.code = 'INVALID_EVIDENCE_INTEGRITY_REPORT_INPUT';
        throw error;
    }
    return number;
}

function baseReport({
    checkedAt,
    status,
    integrityVerified,
    sourceCommit = null,
    profileId = null,
    reviewStatus = 'UNKNOWN',
    readyForReview = false,
    expectedDigestHex = null,
    actualDigestHex = null,
    reasons = [],
} = {}) {
    return Object.freeze({
        schemaVersion: EVIDENCE_INTEGRITY_REPORT_SCHEMA_VERSION,
        checkedAt,
        status,
        integrityVerified,
        authenticityVerified: false,
        sourceCommit,
        profileId,
        reviewStatus,
        readyForReview,
        expectedDigestHex,
        actualDigestHex,
        reasons: Object.freeze([...reasons]),
        cutoverAuthorized: false,
        executionAuthority: EVIDENCE_INTEGRITY_REPORT_AUTHORITY,
    });
}

function classifyExportFailure(error) {
    if (error?.code === 'INVALID_EXPORTED_EVIDENCE') {
        return 'EXPORT_SCHEMA_OR_CONSISTENCY_INVALID';
    }
    return 'EXPORT_VALIDATION_FAILED';
}

function classifyFingerprintFailure(error) {
    if (error?.code === 'EVIDENCE_FINGERPRINT_CRYPTO_UNAVAILABLE') {
        return 'CRYPTO_UNAVAILABLE';
    }
    if (error?.code === 'INVALID_EVIDENCE_FINGERPRINT') {
        return 'FINGERPRINT_SCHEMA_INVALID';
    }
    return 'FINGERPRINT_VALIDATION_FAILED';
}

async function inspectEvidenceIntegrity({
    exportBundle,
    fingerprint,
    cryptoProvider = globalThis?.crypto,
    checkedAt = Date.now(),
} = {}) {
    const timestamp = positiveTimestamp(checkedAt);

    let exportValidation;
    try {
        exportValidation = validateCertificationReleaseEvidenceExport(exportBundle);
    } catch (error) {
        return baseReport({
            checkedAt: timestamp,
            status: 'EXPORT_INVALID',
            integrityVerified: false,
            reasons: [classifyExportFailure(error)],
        });
    }

    try {
        validateFingerprintShape(fingerprint);
    } catch (error) {
        return baseReport({
            checkedAt: timestamp,
            status: 'FINGERPRINT_INVALID',
            integrityVerified: false,
            sourceCommit: exportValidation.sourceCommit,
            profileId: exportValidation.profileId,
            reviewStatus: exportValidation.reviewStatus,
            readyForReview: exportValidation.readyForReview,
            reasons: [classifyFingerprintFailure(error)],
        });
    }

    let verification;
    try {
        verification = await verifyEvidenceFingerprint(
            exportBundle,
            fingerprint,
            { cryptoProvider },
        );
    } catch (error) {
        const reason = classifyFingerprintFailure(error);
        return baseReport({
            checkedAt: timestamp,
            status: reason === 'CRYPTO_UNAVAILABLE'
                ? 'CRYPTO_UNAVAILABLE'
                : 'VERIFICATION_FAILED',
            integrityVerified: false,
            sourceCommit: exportValidation.sourceCommit,
            profileId: exportValidation.profileId,
            reviewStatus: exportValidation.reviewStatus,
            readyForReview: exportValidation.readyForReview,
            expectedDigestHex: fingerprint.digestHex,
            reasons: [reason],
        });
    }

    const reasons = [];
    if (!verification.digestMatches) reasons.push('DIGEST_MISMATCH');
    if (!verification.metadataMatches) reasons.push('FINGERPRINT_METADATA_MISMATCH');

    return baseReport({
        checkedAt: timestamp,
        status: verification.valid
            ? 'INTEGRITY_VERIFIED'
            : 'FINGERPRINT_MISMATCH',
        integrityVerified: verification.valid,
        sourceCommit: verification.sourceCommit,
        profileId: verification.profileId,
        reviewStatus: verification.reviewStatus,
        readyForReview: verification.readyForReview,
        expectedDigestHex: verification.expectedDigestHex,
        actualDigestHex: verification.actualDigestHex,
        reasons,
    });
}

function formatEvidenceIntegrityText(report) {
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
        const error = new Error('integrity report is required');
        error.code = 'INVALID_EVIDENCE_INTEGRITY_REPORT_INPUT';
        throw error;
    }

    if (report.schemaVersion !== EVIDENCE_INTEGRITY_REPORT_SCHEMA_VERSION) {
        const error = new Error('unsupported integrity report schema version');
        error.code = 'INVALID_EVIDENCE_INTEGRITY_REPORT_INPUT';
        throw error;
    }

    if (report.cutoverAuthorized !== false) {
        const error = new Error('integrity report cannot authorize cutover');
        error.code = 'INVALID_EVIDENCE_INTEGRITY_REPORT_INPUT';
        throw error;
    }

    if (report.executionAuthority !== EVIDENCE_INTEGRITY_REPORT_AUTHORITY) {
        const error = new Error('integrity report must preserve legacy execution authority');
        error.code = 'INVALID_EVIDENCE_INTEGRITY_REPORT_INPUT';
        throw error;
    }

    const checked = Number.isFinite(Number(report.checkedAt))
        ? new Date(Number(report.checkedAt)).toISOString()
        : 'n/a';

    const lines = [
        'ORBI Compute Router — Evidence Integrity Report',
        `Checked: ${checked}`,
        `Status: ${report.status || 'UNKNOWN'}`,
        `Integrity verified: ${report.integrityVerified === true ? 'YES' : 'NO'}`,
        'Authenticity verified: NO',
        `Execution authority: ${report.executionAuthority}`,
        'Cutover authorized: NO',
        `Source commit: ${report.sourceCommit || 'n/a'}`,
        `Profile: ${report.profileId || 'n/a'}`,
        `Review status: ${report.reviewStatus || 'UNKNOWN'}`,
        `Ready for review: ${report.readyForReview === true ? 'YES' : 'NO'}`,
        `Expected SHA-256: ${report.expectedDigestHex || 'n/a'}`,
        `Actual SHA-256: ${report.actualDigestHex || 'n/a'}`,
        '',
        'Reasons:',
    ];

    if (Array.isArray(report.reasons) && report.reasons.length) {
        for (const reason of report.reasons) lines.push(`- ${reason}`);
    } else {
        lines.push('- none');
    }

    lines.push(
        '',
        'Note: SHA-256 verifies integrity against the supplied fingerprint only. It does not prove signer identity or provenance.',
    );

    return lines.join('\n');
}

export {
    EVIDENCE_INTEGRITY_REPORT_AUTHORITY,
    EVIDENCE_INTEGRITY_REPORT_SCHEMA_VERSION,
    formatEvidenceIntegrityText,
    inspectEvidenceIntegrity,
};
