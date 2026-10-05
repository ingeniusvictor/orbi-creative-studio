'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { sanitizeHardwarePilotBundle } = require('./hardwarePilotFileExportCore');

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildHardwarePilotImportIntake({
    fileName,
    bytes,
} = {}) {
    if (typeof fileName !== 'string' || !fileName.trim()) {
        throw new TypeError('hardware pilot import filename is required');
    }
    if (path.extname(fileName).toLowerCase() !== '.json') {
        throw new TypeError('hardware pilot import must be a JSON file');
    }
    if (!Buffer.isBuffer(bytes)) {
        throw new TypeError('hardware pilot import bytes must be a Buffer');
    }
    if (bytes.length <= 0 || bytes.length > MAX_IMPORT_BYTES) {
        throw new TypeError('hardware pilot import size is invalid');
    }

    let parsed;
    try {
        parsed = JSON.parse(bytes.toString('utf8'));
    } catch {
        throw new TypeError('hardware pilot import JSON is invalid');
    }

    const sanitizedBundle = sanitizeHardwarePilotBundle(parsed);
    const sha256 = sha256Buffer(bytes);

    return Object.freeze({
        schemaVersion: 1,
        status: 'HARDWARE_PILOT_IMPORT_REVIEW_READY',
        fileName: path.basename(fileName),
        sha256,
        bytes: bytes.length,
        target: Object.freeze({ ...sanitizedBundle.target }),
        sampleCount: sanitizedBundle.sampleCount,
        runIndexes: Object.freeze([...sanitizedBundle.runIndexes]),
        capturedFrom: sanitizedBundle.capturedFrom,
        capturedTo: sanitizedBundle.capturedTo,
        evidenceClass: sanitizedBundle.evidenceClass,
        cryptographicAuthenticityVerified: false,
        importedFileHashVerified: true,
        revalidatedAgainstCurrentContract: true,
        localPathsIncluded: false,
        hardwareIdentityIncluded: false,
        promptContentIncluded: false,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
        bundle: sanitizedBundle,
    });
}

function sanitizeHardwarePilotImportResult(intake) {
    if (!intake
        || intake.status !== 'HARDWARE_PILOT_IMPORT_REVIEW_READY'
        || !/^[a-f0-9]{64}$/.test(intake.sha256)
        || !intake.target
        || intake.sampleCount !== 3
        || intake.requiresHumanReview !== true
        || intake.routingEligible !== false
        || intake.cutoverAuthorized !== false) {
        throw new TypeError('hardware pilot import intake is invalid');
    }

    return Object.freeze({
        status: intake.status,
        fileName: intake.fileName,
        sha256: intake.sha256,
        bytes: intake.bytes,
        target: Object.freeze({ ...intake.target }),
        sampleCount: intake.sampleCount,
        capturedFrom: intake.capturedFrom,
        capturedTo: intake.capturedTo,
        evidenceClass: intake.evidenceClass,
        cryptographicAuthenticityVerified: false,
        importedFileHashVerified: true,
        revalidatedAgainstCurrentContract: true,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    MAX_IMPORT_BYTES,
    buildHardwarePilotImportIntake,
    sanitizeHardwarePilotImportResult,
    sha256Buffer,
};
