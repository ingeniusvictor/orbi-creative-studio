'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { dialog } = require('electron');
const { sha256File } = require('./fileIntegrity');
const {
    createScene3DRecoveryExportPlan,
} = require('./scene3dRecoveryExportCore');

function result(status, {
    reason = null,
    fileName = null,
    sha256 = null,
    bytes = 0,
} = {}) {
    return Object.freeze({
        status,
        reason,
        fileName,
        sha256,
        bytes,
        readOnlyEvidence: true,
        executionAuthorized: false,
        retryAuthorized: false,
        reconciliationAuthorized: false,
        requestIdReleaseAuthorized: false,
        productionCutoverAuthorized: false,
    });
}

function canceled() {
    return result('SCENE3D_RECOVERY_EXPORT_CANCELED');
}

function rejected(reason) {
    return result('SCENE3D_RECOVERY_EXPORT_REJECTED', { reason });
}

async function exportScene3DRecoveryEvidence(snapshot, {
    dialogImpl = dialog,
    fsImpl = fs,
    pathImpl = path,
    sha256FileImpl = sha256File,
} = {}) {
    let plan;
    try {
        plan = createScene3DRecoveryExportPlan(snapshot);
    } catch {
        return rejected('SCENE3D_RECOVERY_EXPORT_SNAPSHOT_INVALID');
    }

    let selection;
    try {
        selection = await dialogImpl.showSaveDialog({
            title: 'Export ORBI Scene3D recovery evidence',
            defaultPath: plan.defaultFilename,
            filters: [
                { name: 'JSON evidence', extensions: ['json'] },
            ],
            properties: ['createDirectory', 'showOverwriteConfirmation'],
        });
    } catch {
        return rejected('SCENE3D_RECOVERY_EXPORT_DIALOG_FAILED');
    }

    if (!selection || selection.canceled === true || !selection.filePath) {
        return canceled();
    }

    const destination = pathImpl.resolve(selection.filePath);
    if (fsImpl.existsSync(destination)) {
        return rejected('SCENE3D_RECOVERY_EXPORT_DESTINATION_EXISTS');
    }

    const tempPath = `${destination}.orbi-tmp-${process.pid}-${Date.now()}`;

    try {
        await fsImpl.promises.writeFile(tempPath, plan.serialized, {
            encoding: 'utf8',
            flag: 'wx',
        });
        await fsImpl.promises.link(tempPath, destination);
        await fsImpl.promises.unlink(tempPath);

        const actualSha256 = await sha256FileImpl(destination);
        if (actualSha256 !== plan.sha256) {
            try {
                await fsImpl.promises.unlink(destination);
            } catch {
                // Best-effort cleanup; the destination path is never returned.
            }
            return rejected('SCENE3D_RECOVERY_EXPORT_HASH_MISMATCH');
        }

        return result('SCENE3D_RECOVERY_EXPORT_WRITTEN', {
            fileName: pathImpl.basename(destination),
            sha256: actualSha256,
            bytes: plan.bytes,
        });
    } catch {
        try {
            if (fsImpl.existsSync(tempPath)) {
                await fsImpl.promises.unlink(tempPath);
            }
        } catch {
            // Best-effort temporary-file cleanup.
        }
        return rejected('SCENE3D_RECOVERY_EXPORT_WRITE_FAILED');
    }
}

module.exports = {
    canceled,
    exportScene3DRecoveryEvidence,
    rejected,
};
