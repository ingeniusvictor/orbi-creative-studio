const fs = require('fs');
const path = require('path');
const { verifyFileSha256 } = require('./fileIntegrity');
const provenance = require('./modelProvenance.json');

const PROVENANCE_BY_FILENAME = new Map(
    provenance.assets.map((asset) => [asset.localFilename, asset])
);

function integrityError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
}

function removeFileIfExists(filePath) {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
        // Best-effort cleanup. The original integrity error remains authoritative.
    }
}

function getIntegritySpecForCatalogEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        throw integrityError('MODEL_ASSET_METADATA_INVALID', 'Catalog entry is required for model integrity verification');
    }

    const filename = typeof entry.filename === 'string' ? entry.filename : '';
    const asset = PROVENANCE_BY_FILENAME.get(filename);
    if (!asset) {
        throw integrityError(
            'MODEL_ASSET_PROVENANCE_MISSING',
            `No provenance record exists for local asset "${filename || 'unknown'}"`
        );
    }

    if (entry.sizeBytes !== asset.expectedBytes) {
        throw integrityError(
            'MODEL_ASSET_METADATA_DRIFT',
            `Catalog byte size drift for ${asset.id}: expected ${asset.expectedBytes}, got ${entry.sizeBytes}`
        );
    }

    const catalogSha = String(entry.sha256 || '').trim().toLowerCase();
    const provenanceSha = String(asset.sha256 || '').trim().toLowerCase();
    if (catalogSha !== provenanceSha) {
        throw integrityError(
            'MODEL_ASSET_METADATA_DRIFT',
            `Catalog SHA-256 drift for ${asset.id}`
        );
    }

    return Object.freeze({
        assetId: asset.id,
        localFilename: asset.localFilename,
        expectedBytes: asset.expectedBytes,
        sha256: provenanceSha,
    });
}

async function verifyAndPromoteFile({
    stagedPath,
    destinationPath,
    expectedBytes,
    expectedSha256,
}) {
    if (!stagedPath || !destinationPath) {
        throw integrityError('MODEL_ASSET_PATH_INVALID', 'Staged and destination paths are required');
    }
    if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
        throw integrityError('MODEL_ASSET_METADATA_INVALID', 'Expected byte size must be a positive safe integer');
    }

    let stat;
    try {
        stat = fs.statSync(stagedPath);
    } catch {
        throw integrityError('MODEL_ASSET_STAGED_MISSING', `Staged asset is missing: ${stagedPath}`);
    }

    if (!stat.isFile()) {
        removeFileIfExists(stagedPath);
        throw integrityError('MODEL_ASSET_STAGED_INVALID', `Staged asset is not a regular file: ${stagedPath}`);
    }

    if (stat.size !== expectedBytes) {
        removeFileIfExists(stagedPath);
        throw integrityError(
            'MODEL_ASSET_SIZE_MISMATCH',
            `Downloaded asset size mismatch: expected ${expectedBytes} bytes, got ${stat.size}`,
            { expectedBytes, actualBytes: stat.size }
        );
    }

    const integrity = await verifyFileSha256(stagedPath, expectedSha256);
    if (!integrity.ok) {
        removeFileIfExists(stagedPath);
        throw integrityError(
            'MODEL_ASSET_SHA256_MISMATCH',
            `Downloaded asset SHA-256 mismatch: expected ${integrity.expected}, got ${integrity.actual}`,
            { expectedSha256: integrity.expected, actualSha256: integrity.actual }
        );
    }

    if (fs.existsSync(destinationPath)) {
        removeFileIfExists(stagedPath);
        throw integrityError(
            'MODEL_ASSET_DESTINATION_EXISTS',
            `Refusing to overwrite an existing model asset: ${destinationPath}`
        );
    }

    fs.renameSync(stagedPath, destinationPath);
    return Object.freeze({
        ok: true,
        bytes: stat.size,
        sha256: integrity.actual,
    });
}

async function verifyAndPromoteCatalogAsset({
    stagedPath,
    destinationPath,
    catalogEntry,
}) {
    const spec = getIntegritySpecForCatalogEntry(catalogEntry);
    if (path.basename(destinationPath) !== spec.localFilename) {
        removeFileIfExists(stagedPath);
        throw integrityError(
            'MODEL_ASSET_DESTINATION_INVALID',
            `Destination filename must remain "${spec.localFilename}" for ${spec.assetId}`
        );
    }

    const result = await verifyAndPromoteFile({
        stagedPath,
        destinationPath,
        expectedBytes: spec.expectedBytes,
        expectedSha256: spec.sha256,
    });

    return Object.freeze({
        ...result,
        assetId: spec.assetId,
    });
}

module.exports = {
    getIntegritySpecForCatalogEntry,
    verifyAndPromoteCatalogAsset,
    verifyAndPromoteFile,
};
