'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sha256File } = require('./fileIntegrity');

const RUNTIME_INSTALLATION_EVIDENCE_FILE = '.orbi-runtime-installation.json';
const MAX_EVIDENCE_BYTES = 16 * 1024;

function normalizeSha256(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function nonEmptyString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRequiredFiles(value) {
    if (!Array.isArray(value) || value.length === 0) return null;
    const files = [...new Set(value.map(nonEmptyString).filter(Boolean))].sort();
    return files.length > 0 ? Object.freeze(files) : null;
}

function normalizeCompanionDefinition(companion) {
    if (!companion || typeof companion !== 'object') return null;

    const assetName = nonEmptyString(companion.assetName);
    const archiveSha256 = normalizeSha256(companion.sha256 || companion.archiveSha256);
    const requiredFiles = normalizeRequiredFiles(companion.requiredFiles);

    if (!assetName || !archiveSha256 || !requiredFiles) return null;

    return Object.freeze({
        assetName,
        archiveSha256,
        requiredFiles,
    });
}

function evidencePath(binDir) {
    return path.join(binDir, RUNTIME_INSTALLATION_EVIDENCE_FILE);
}

function runtimeIdentity(runtime) {
    if (!runtime || typeof runtime !== 'object') return null;
    const backend = nonEmptyString(runtime.backend);
    const release = nonEmptyString(runtime.release);
    const assetName = nonEmptyString(runtime.assetName);
    const archiveSha256 = normalizeSha256(runtime.sha256);
    if (!backend || !release || !assetName || !archiveSha256) return null;

    const companionDefinitions = Array.isArray(runtime.companions)
        ? runtime.companions.map(normalizeCompanionDefinition)
        : [];
    if (companionDefinitions.some((entry) => !entry)) return null;

    return Object.freeze({
        backend,
        release,
        upstreamCommit: nonEmptyString(runtime.upstreamCommit),
        assetName,
        archiveSha256,
        companions: Object.freeze(companionDefinitions),
    });
}

function stableFailure(reason) {
    return Object.freeze({
        schemaVersion: 1,
        integrityVerified: false,
        authenticityVerified: false,
        reason,
        evidenceSource: 'pinned-archive-installation-receipt',
        tamperResistance: 'local-receipt-not-tamper-proof',
    });
}

function parseCompanionReceipt(value) {
    if (!value || typeof value !== 'object') return null;
    const assetName = nonEmptyString(value.assetName);
    const archiveSha256 = normalizeSha256(value.archiveSha256);
    if (!assetName || !archiveSha256 || !Array.isArray(value.files)) return null;

    const files = [];
    for (const entry of value.files) {
        const name = nonEmptyString(entry?.name);
        const fileSha256 = normalizeSha256(entry?.sha256);
        if (!name || !fileSha256) return null;
        files.push(Object.freeze({ name, sha256: fileSha256 }));
    }

    files.sort((left, right) => left.name.localeCompare(right.name));
    return Object.freeze({
        assetName,
        archiveSha256,
        files: Object.freeze(files),
    });
}

function parseReceipt(raw) {
    let receipt;
    try {
        receipt = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!receipt || typeof receipt !== 'object' || receipt.schemaVersion !== 1) return null;

    const backend = nonEmptyString(receipt.backend);
    const release = nonEmptyString(receipt.release);
    const assetName = nonEmptyString(receipt.assetName);
    const binaryName = nonEmptyString(receipt.binaryName);
    const archiveSha256 = normalizeSha256(receipt.archiveSha256);
    const binarySha256 = normalizeSha256(receipt.binarySha256);
    const installedAt = Number(receipt.installedAt);

    if (!backend || !release || !assetName || !binaryName || !archiveSha256 || !binarySha256) return null;
    if (!Number.isFinite(installedAt) || installedAt <= 0) return null;

    const rawCompanions = receipt.companions === undefined ? [] : receipt.companions;
    if (!Array.isArray(rawCompanions)) return null;
    const companions = rawCompanions.map(parseCompanionReceipt);
    if (companions.some((entry) => !entry)) return null;

    return Object.freeze({
        schemaVersion: 1,
        source: receipt.source === 'pinned-archive' ? 'pinned-archive' : null,
        backend,
        release,
        upstreamCommit: nonEmptyString(receipt.upstreamCommit),
        assetName,
        archiveSha256,
        binaryName,
        binarySha256,
        installedAt,
        companions: Object.freeze(companions),
        authenticityVerified: false,
    });
}

function normalizeObservedCompanionInstallations(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) return null;

    const normalized = [];
    for (const entry of value) {
        const definition = normalizeCompanionDefinition({
            assetName: entry?.assetName,
            archiveSha256: entry?.archiveSha256,
            requiredFiles: entry?.requiredFiles,
        });
        if (!definition) return null;
        normalized.push(definition);
    }
    return normalized;
}

function sameStringSet(left, right) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
}

async function recordPinnedRuntimeInstallation({
    binDir,
    binaryPath,
    runtime,
    archiveSha256,
    companionInstallations,
    now = Date.now,
    fsImpl = fs,
    sha256FileImpl = sha256File,
} = {}) {
    const identity = runtimeIdentity(runtime);
    if (!identity) throw new Error('Pinned runtime identity is incomplete');

    const observedArchiveSha256 = normalizeSha256(archiveSha256);
    if (!observedArchiveSha256 || observedArchiveSha256 !== identity.archiveSha256) {
        throw new Error('Verified archive SHA-256 does not match pinned runtime manifest');
    }

    if (!nonEmptyString(binDir) || !nonEmptyString(binaryPath)) {
        throw new Error('Runtime installation paths are required');
    }
    if (!fsImpl.existsSync(binaryPath)) {
        throw new Error('Installed runtime binary is missing');
    }

    const observedCompanions = normalizeObservedCompanionInstallations(companionInstallations);
    if (!observedCompanions) {
        throw new Error('Verified runtime companion evidence is invalid');
    }
    if (observedCompanions.length !== identity.companions.length) {
        throw new Error('Verified runtime companion count does not match pinned runtime manifest');
    }

    const binarySha256 = normalizeSha256(await sha256FileImpl(binaryPath));
    if (!binarySha256) throw new Error('Installed runtime binary SHA-256 is invalid');

    const companionReceipts = [];
    for (const expected of identity.companions) {
        const observed = observedCompanions.find((entry) => entry.assetName === expected.assetName);
        if (!observed || observed.archiveSha256 !== expected.archiveSha256) {
            throw new Error(`Verified companion archive does not match pinned runtime manifest: ${expected.assetName}`);
        }
        if (!sameStringSet(observed.requiredFiles, expected.requiredFiles)) {
            throw new Error(`Verified companion required files do not match pinned runtime manifest: ${expected.assetName}`);
        }

        const files = [];
        for (const fileName of expected.requiredFiles) {
            const filePath = path.join(binDir, fileName);
            if (!fsImpl.existsSync(filePath)) {
                throw new Error(`Installed runtime support file is missing: ${fileName}`);
            }
            const fileSha256 = normalizeSha256(await sha256FileImpl(filePath));
            if (!fileSha256) {
                throw new Error(`Installed runtime support file SHA-256 is invalid: ${fileName}`);
            }
            files.push(Object.freeze({ name: fileName, sha256: fileSha256 }));
        }

        companionReceipts.push(Object.freeze({
            assetName: expected.assetName,
            archiveSha256: expected.archiveSha256,
            files: Object.freeze(files),
        }));
    }

    const receipt = Object.freeze({
        schemaVersion: 1,
        source: 'pinned-archive',
        backend: identity.backend,
        release: identity.release,
        upstreamCommit: identity.upstreamCommit,
        assetName: identity.assetName,
        archiveSha256: identity.archiveSha256,
        binaryName: path.basename(binaryPath),
        binarySha256,
        companions: Object.freeze(companionReceipts),
        installedAt: Number(now()),
        authenticityVerified: false,
    });

    if (!Number.isFinite(receipt.installedAt) || receipt.installedAt <= 0) {
        throw new Error('Runtime installation timestamp is invalid');
    }

    fsImpl.mkdirSync(binDir, { recursive: true });
    const target = evidencePath(binDir);
    const temporary = target + '.tmp';
    fsImpl.writeFileSync(temporary, JSON.stringify(receipt, null, 2) + '\n', {
        encoding: 'utf8',
        mode: 0o600,
    });
    fsImpl.renameSync(temporary, target);
    return receipt;
}

async function inspectPinnedRuntimeInstallation({
    binDir,
    binaryPath,
    runtime,
    fsImpl = fs,
    sha256FileImpl = sha256File,
} = {}) {
    const identity = runtimeIdentity(runtime);
    if (!identity) return stableFailure('PINNED_RUNTIME_IDENTITY_INVALID');
    if (!nonEmptyString(binDir) || !nonEmptyString(binaryPath)) {
        return stableFailure('INSTALLATION_PATH_EVIDENCE_MISSING');
    }
    if (!fsImpl.existsSync(binaryPath)) return stableFailure('RUNTIME_BINARY_MISSING');

    const target = evidencePath(binDir);
    if (!fsImpl.existsSync(target)) return stableFailure('INSTALLATION_RECEIPT_MISSING');

    let stat;
    try {
        stat = fsImpl.statSync(target);
    } catch {
        return stableFailure('INSTALLATION_RECEIPT_UNREADABLE');
    }
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_EVIDENCE_BYTES) {
        return stableFailure('INSTALLATION_RECEIPT_INVALID_SIZE');
    }

    let receipt;
    try {
        receipt = parseReceipt(fsImpl.readFileSync(target, 'utf8'));
    } catch {
        return stableFailure('INSTALLATION_RECEIPT_UNREADABLE');
    }
    if (!receipt || receipt.source !== 'pinned-archive') {
        return stableFailure('INSTALLATION_RECEIPT_INVALID');
    }

    if (
        receipt.backend !== identity.backend
        || receipt.release !== identity.release
        || receipt.upstreamCommit !== identity.upstreamCommit
        || receipt.assetName !== identity.assetName
        || receipt.archiveSha256 !== identity.archiveSha256
        || receipt.binaryName !== path.basename(binaryPath)
    ) {
        return stableFailure('INSTALLATION_RECEIPT_MANIFEST_MISMATCH');
    }

    if (receipt.companions.length !== identity.companions.length) {
        return stableFailure('INSTALLATION_RECEIPT_COMPANION_MISMATCH');
    }

    for (const expected of identity.companions) {
        const recorded = receipt.companions.find((entry) => entry.assetName === expected.assetName);
        if (!recorded || recorded.archiveSha256 !== expected.archiveSha256) {
            return stableFailure('INSTALLATION_RECEIPT_COMPANION_MISMATCH');
        }

        const recordedNames = recorded.files.map((entry) => entry.name).sort();
        if (!sameStringSet(recordedNames, expected.requiredFiles)) {
            return stableFailure('INSTALLATION_RECEIPT_COMPANION_MISMATCH');
        }

        for (const file of recorded.files) {
            const filePath = path.join(binDir, file.name);
            if (!fsImpl.existsSync(filePath)) {
                return stableFailure('RUNTIME_SUPPORT_FILE_MISSING');
            }

            let currentSha256;
            try {
                currentSha256 = normalizeSha256(await sha256FileImpl(filePath));
            } catch {
                return stableFailure('RUNTIME_SUPPORT_FILE_HASH_FAILED');
            }
            if (!currentSha256) return stableFailure('RUNTIME_SUPPORT_FILE_HASH_INVALID');
            if (currentSha256 !== file.sha256) {
                return stableFailure('RUNTIME_SUPPORT_FILE_CHANGED_AFTER_INSTALL');
            }
        }
    }

    let currentBinarySha256;
    try {
        currentBinarySha256 = normalizeSha256(await sha256FileImpl(binaryPath));
    } catch {
        return stableFailure('RUNTIME_BINARY_HASH_FAILED');
    }
    if (!currentBinarySha256) return stableFailure('RUNTIME_BINARY_HASH_INVALID');
    if (currentBinarySha256 !== receipt.binarySha256) {
        return stableFailure('RUNTIME_BINARY_CHANGED_AFTER_INSTALL');
    }

    return Object.freeze({
        schemaVersion: 1,
        integrityVerified: true,
        authenticityVerified: false,
        reason: null,
        evidenceSource: 'pinned-archive-installation-receipt',
        backend: identity.backend,
        release: identity.release,
        assetName: identity.assetName,
        archiveManifestMatch: true,
        binaryReceiptMatch: true,
        companionReceiptMatch: true,
        supportFilesVerified: true,
        tamperResistance: 'local-receipt-not-tamper-proof',
    });
}

module.exports = {
    MAX_EVIDENCE_BYTES,
    RUNTIME_INSTALLATION_EVIDENCE_FILE,
    inspectPinnedRuntimeInstallation,
    normalizeCompanionDefinition,
    parseReceipt,
    recordPinnedRuntimeInstallation,
    runtimeIdentity,
};
