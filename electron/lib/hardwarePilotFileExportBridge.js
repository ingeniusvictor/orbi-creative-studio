'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { dialog, ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const { sha256File } = require('./fileIntegrity');
const { createHardwarePilotExportPlan } = require('./hardwarePilotFileExportCore');

const CHANNEL = 'compute-router:hardware-pilot-export';

function canceled() {
    return Object.freeze({
        status: 'HARDWARE_PILOT_EXPORT_CANCELED',
        reason: null,
        fileName: null,
        sha256: null,
        bytes: 0,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason) {
    return Object.freeze({
        status: 'HARDWARE_PILOT_EXPORT_REJECTED',
        reason,
        fileName: null,
        sha256: null,
        bytes: 0,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function register({
    dialogImpl = dialog,
    fsImpl = fs,
    pathImpl = path,
    sha256FileImpl = sha256File,
} = {}) {
    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event, bundle) => {
        assertTrustedSender(event);

        let plan;
        try {
            plan = createHardwarePilotExportPlan(bundle);
        } catch {
            return rejected('HARDWARE_PILOT_EXPORT_BUNDLE_INVALID');
        }

        let selection;
        try {
            selection = await dialogImpl.showSaveDialog({
                title: 'Export ORBI hardware pilot evidence',
                defaultPath: plan.defaultFilename,
                filters: [
                    { name: 'JSON evidence', extensions: ['json'] },
                ],
                properties: ['createDirectory', 'showOverwriteConfirmation'],
            });
        } catch {
            return rejected('HARDWARE_PILOT_EXPORT_DIALOG_FAILED');
        }

        if (!selection || selection.canceled === true || !selection.filePath) {
            return canceled();
        }

        const destination = pathImpl.resolve(selection.filePath);
        if (fsImpl.existsSync(destination)) {
            return rejected('HARDWARE_PILOT_EXPORT_DESTINATION_EXISTS');
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
                    // Best effort cleanup; no path or file content is returned to renderer.
                }
                return rejected('HARDWARE_PILOT_EXPORT_HASH_MISMATCH');
            }

            return Object.freeze({
                status: 'HARDWARE_PILOT_EXPORT_WRITTEN',
                reason: null,
                fileName: pathImpl.basename(destination),
                sha256: actualSha256,
                bytes: plan.bytes,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            });
        } catch {
            try {
                if (fsImpl.existsSync(tempPath)) {
                    await fsImpl.promises.unlink(tempPath);
                }
            } catch {
                // Best effort temp cleanup.
            }
            return rejected('HARDWARE_PILOT_EXPORT_WRITE_FAILED');
        }
    });

    return Object.freeze({
        channel: CHANNEL,
        userInitiatedSaveDialog: true,
        rendererPathInputAllowed: false,
        overwriteAllowed: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    CHANNEL,
    register,
};
