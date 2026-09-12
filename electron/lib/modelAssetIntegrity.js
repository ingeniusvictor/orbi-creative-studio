'use strict';

const fs = require('fs');
const { verifyFileSha256 } = require('./fileIntegrity');

const verificationCache = new Map();

function integrityError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function normalizeMetadata(asset) {
    const expectedBytes = Number(asset?.sizeBytes);
    const expectedSha256 = String(asset?.sha256 || '').trim().toLowerCase();

    if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
        throw integrityError('MODEL_ASSET_METADATA_INVALID', 'Model asset size metadata is missing or invalid');
    }
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw integrityError('MODEL_ASSET_METADATA_INVALID', 'Model asset SHA-256 metadata is missing or invalid');
    }

    return { expectedBytes, expectedSha256 };
}

function fingerprint(filePath, stat, expectedSha256) {
    return `${filePath}|${stat.size}|${stat.mtimeMs}|${stat.ctimeMs}|${expectedSha256}`;
}

function clearIntegrityCache(filePath) {
    for (const key of verificationCache.keys()) {
        if (key.startsWith(`${filePath}|`)) verificationCache.delete(key);
    }
}

function getFileSizeState(filePath, asset, { fsImpl = fs } = {}) {
    if (!fsImpl.existsSync(filePath)) return { exists: false, sizeMatches: false };

    const { expectedBytes } = normalizeMetadata(asset);
    const stat = fsImpl.statSync(filePath);
    return {
        exists: true,
        size: stat.size,
        expectedBytes,
        sizeMatches: stat.size === expectedBytes,
    };
}

async function verifyModelAsset(
    filePath,
    asset,
    {
        fsImpl = fs,
        verifyFileSha256Impl = verifyFileSha256,
    } = {},
) {
    const { expectedBytes, expectedSha256 } = normalizeMetadata(asset);

    if (!fsImpl.existsSync(filePath)) {
        throw integrityError(
            'MODEL_ASSET_MISSING',
            `Model asset is missing: ${filePath}`,
            { filePath },
        );
    }

    const stat = fsImpl.statSync(filePath);
    if (stat.size !== expectedBytes) {
        clearIntegrityCache(filePath);
        throw integrityError(
            'MODEL_ASSET_SIZE_MISMATCH',
            `Model asset size mismatch for ${asset.id || asset.filename || filePath}: expected ${expectedBytes}, got ${stat.size}`,
            { filePath, expectedBytes, actualBytes: stat.size },
        );
    }

    const key = fingerprint(filePath, stat, expectedSha256);
    if (verificationCache.has(key)) {
        return {
            ok: true,
            cached: true,
            expectedBytes,
            actualBytes: stat.size,
            sha256: expectedSha256,
        };
    }

    const integrity = await verifyFileSha256Impl(filePath, expectedSha256);
    if (!integrity?.ok) {
        clearIntegrityCache(filePath);
        throw integrityError(
            'MODEL_ASSET_HASH_MISMATCH',
            `Model asset SHA-256 mismatch for ${asset.id || asset.filename || filePath}`,
            {
                filePath,
                expectedSha256,
                actualSha256: integrity?.actual || null,
            },
        );
    }

    clearIntegrityCache(filePath);
    verificationCache.set(key, true);

    return {
        ok: true,
        cached: false,
        expectedBytes,
        actualBytes: stat.size,
        sha256: expectedSha256,
    };
}

async function promoteVerifiedAsset(
    stagedPath,
    finalPath,
    asset,
    {
        fsImpl = fs,
        verifyFileSha256Impl = verifyFileSha256,
    } = {},
) {
    try {
        const result = await verifyModelAsset(stagedPath, asset, {
            fsImpl,
            verifyFileSha256Impl,
        });

        if (fsImpl.existsSync(finalPath)) {
            throw integrityError(
                'MODEL_ASSET_DESTINATION_EXISTS',
                `Refusing to overwrite an existing model asset: ${finalPath}`,
                { finalPath },
            );
        }

        clearIntegrityCache(finalPath);
        fsImpl.renameSync(stagedPath, finalPath);
        clearIntegrityCache(stagedPath);

        const finalStat = fsImpl.statSync(finalPath);
        verificationCache.set(
            fingerprint(finalPath, finalStat, String(asset.sha256).trim().toLowerCase()),
            true,
        );

        return { ...result, path: finalPath };
    } catch (error) {
        try {
            if (fsImpl.existsSync(stagedPath)) fsImpl.unlinkSync(stagedPath);
        } catch {
            // Cleanup failure must not hide the integrity failure.
        }
        clearIntegrityCache(stagedPath);
        throw error;
    }
}

module.exports = {
    clearIntegrityCache,
    getFileSizeState,
    normalizeMetadata,
    promoteVerifiedAsset,
    verifyModelAsset,
};
