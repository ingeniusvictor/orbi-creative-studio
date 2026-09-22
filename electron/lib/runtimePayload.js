'use strict';

const fs = require('node:fs');
const path = require('node:path');

function findFileRecursive(rootDir, name, fsImpl = fs) {
    if (!rootDir || !fsImpl.existsSync(rootDir)) return null;

    for (const entry of fsImpl.readdirSync(rootDir, { withFileTypes: true })) {
        const full = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            const found = findFileRecursive(full, name, fsImpl);
            if (found) return found;
        } else if (entry.name === name) {
            return full;
        }
    }
    return null;
}

function copyTreeContents(sourceDir, targetDir, fsImpl = fs) {
    fsImpl.mkdirSync(targetDir, { recursive: true });

    for (const entry of fsImpl.readdirSync(sourceDir, { withFileTypes: true })) {
        const source = path.join(sourceDir, entry.name);
        const target = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyTreeContents(source, target, fsImpl);
        } else {
            fsImpl.copyFileSync(source, target);
        }
    }
}

function promoteExtractedRuntime({
    extractDir,
    binDir,
    binaryName,
    fsImpl = fs,
} = {}) {
    const foundBinary = findFileRecursive(extractDir, binaryName, fsImpl);
    if (!foundBinary) {
        throw new Error(`Extracted runtime does not contain ${binaryName}`);
    }

    const payloadDir = path.dirname(foundBinary);
    copyTreeContents(payloadDir, binDir, fsImpl);

    const binaryPath = path.join(binDir, binaryName);
    if (!fsImpl.existsSync(binaryPath)) {
        throw new Error(`Runtime promotion did not produce ${binaryName}`);
    }

    return Object.freeze({
        binaryPath,
        payloadDir,
    });
}

function validateCompanion(companion) {
    if (!companion || typeof companion !== 'object') {
        throw new Error('Runtime companion definition is invalid');
    }
    if (typeof companion.assetName !== 'string' || !companion.assetName.trim()) {
        throw new Error('Runtime companion assetName is required');
    }
    if (typeof companion.url !== 'string' || !/^https:\/\//.test(companion.url)) {
        throw new Error(`Runtime companion ${companion.assetName} must use HTTPS`);
    }
    if (!/^[a-f0-9]{64}$/.test(String(companion.sha256 || ''))) {
        throw new Error(`Runtime companion ${companion.assetName} SHA-256 is invalid`);
    }
    if (!Array.isArray(companion.requiredFiles) || companion.requiredFiles.length === 0) {
        throw new Error(`Runtime companion ${companion.assetName} requiredFiles are missing`);
    }

    return Object.freeze({
        assetName: companion.assetName,
        url: companion.url,
        sha256: companion.sha256,
        requiredFiles: Object.freeze([...companion.requiredFiles]),
    });
}

async function installPinnedRuntimeCompanions({
    runtime,
    binDir,
    tmpDir,
    downloadFile,
    verifyFileSha256,
    extractZip,
    send = () => {},
    fsImpl = fs,
    now = Date.now,
} = {}) {
    const companions = Array.isArray(runtime?.companions)
        ? runtime.companions.map(validateCompanion)
        : [];

    if (companions.length === 0) return Object.freeze([]);

    if (typeof downloadFile !== 'function') throw new TypeError('downloadFile is required');
    if (typeof verifyFileSha256 !== 'function') throw new TypeError('verifyFileSha256 is required');
    if (typeof extractZip !== 'function') throw new TypeError('extractZip is required');

    fsImpl.mkdirSync(binDir, { recursive: true });
    fsImpl.mkdirSync(tmpDir, { recursive: true });

    const installed = [];

    for (let index = 0; index < companions.length; index++) {
        const companion = companions[index];
        const token = `${process.pid}-${now()}-${index}`;
        const archivePath = path.join(tmpDir, `${token}-${companion.assetName}`);
        const extractDir = path.join(tmpDir, `${token}-extract`);
        const copiedTargets = [];

        try {
            send({
                phase: 'downloading-companion',
                companion: companion.assetName,
                progress: 0,
            });

            await downloadFile(companion.url, archivePath, (progress) => {
                send({
                    phase: 'downloading-companion',
                    companion: companion.assetName,
                    progress,
                });
            });

            send({
                phase: 'verifying-companion',
                companion: companion.assetName,
                progress: 0.98,
            });

            const integrity = await verifyFileSha256(archivePath, companion.sha256);
            if (!integrity?.ok) {
                throw new Error(
                    `Runtime companion integrity check failed for ${companion.assetName}: expected ${integrity?.expected || companion.sha256}, got ${integrity?.actual || 'unknown'}`,
                );
            }

            fsImpl.mkdirSync(extractDir, { recursive: true });
            await extractZip(archivePath, extractDir);

            for (const fileName of companion.requiredFiles) {
                const source = findFileRecursive(extractDir, fileName, fsImpl);
                if (!source) {
                    throw new Error(
                        `Runtime companion ${companion.assetName} is missing required file ${fileName}`,
                    );
                }

                const target = path.join(binDir, fileName);
                fsImpl.copyFileSync(source, target);
                copiedTargets.push(target);
            }

            for (const fileName of companion.requiredFiles) {
                if (!fsImpl.existsSync(path.join(binDir, fileName))) {
                    throw new Error(
                        `Runtime companion ${companion.assetName} failed to install ${fileName}`,
                    );
                }
            }

            installed.push(Object.freeze({
                assetName: companion.assetName,
                archiveSha256: integrity.actual,
                requiredFiles: companion.requiredFiles,
            }));

            send({
                phase: 'companion-ready',
                companion: companion.assetName,
                progress: 1,
            });
        } catch (error) {
            for (const target of copiedTargets) {
                try { fsImpl.rmSync(target, { force: true }); } catch {}
            }
            throw error;
        } finally {
            for (const artifact of [
                archivePath,
                archivePath + '.part',
                archivePath + '.part.meta.json',
                archivePath + '.part.fresh',
            ]) {
                try { fsImpl.rmSync(artifact, { force: true }); } catch {}
            }
            try { fsImpl.rmSync(extractDir, { recursive: true, force: true }); } catch {}
        }
    }

    return Object.freeze(installed);
}

module.exports = {
    copyTreeContents,
    findFileRecursive,
    installPinnedRuntimeCompanions,
    promoteExtractedRuntime,
    validateCompanion,
};
