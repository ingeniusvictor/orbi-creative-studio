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

    return Object.freeze({
        backend,
        release,
        upstreamCommit: nonEmptyString(runtime.upstreamCommit),
        assetName,
        archiveSha256,
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
        authenticityVerified: false,
    });
}

async function recordPinnedRuntimeInstallation({
    binDir,
    binaryPath,
    runtime,
    archiveSha256,
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

    const binarySha256 = normalizeSha256(await sha256FileImpl(binaryPath));
    if (!binarySha256) throw new Error('Installed runtime binary SHA-256 is invalid');

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
        tamperResistance: 'local-receipt-not-tamper-proof',
    });
}

module.exports = {
    MAX_EVIDENCE_BYTES,
    RUNTIME_INSTALLATION_EVIDENCE_FILE,
    inspectPinnedRuntimeInstallation,
    parseReceipt,
    recordPinnedRuntimeInstallation,
    runtimeIdentity,
};
