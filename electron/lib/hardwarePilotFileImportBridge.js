'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { dialog, ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const {
    MAX_IMPORT_BYTES,
    buildHardwarePilotImportIntake,
    sanitizeHardwarePilotImportResult,
} = require('./hardwarePilotFileImportCore');

const CHANNEL = 'compute-router:hardware-pilot-import';
const importedBundles = new Map();

function rejected(reason) {
    return Object.freeze({
        status: 'HARDWARE_PILOT_IMPORT_REJECTED',
        reason,
        fileName: null,
        sha256: null,
        bytes: 0,
        target: null,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function canceled() {
    return Object.freeze({
        status: 'HARDWARE_PILOT_IMPORT_CANCELED',
        reason: null,
        fileName: null,
        sha256: null,
        bytes: 0,
        target: null,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneBundle(bundle) {
    return JSON.parse(JSON.stringify(bundle));
}

function readImportedBundle(sha256) {
    const bundle = importedBundles.get(sha256);
    return bundle ? cloneBundle(bundle) : null;
}

function register({
    dialogImpl = dialog,
    fsImpl = fs,
} = {}) {
    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event) => {
        assertTrustedSender(event);

        let selection;
        try {
            selection = await dialogImpl.showOpenDialog({
                title: 'Import ORBI hardware pilot evidence',
                properties: ['openFile'],
                filters: [{ name: 'JSON evidence', extensions: ['json'] }],
            });
        } catch {
            return rejected('HARDWARE_PILOT_IMPORT_DIALOG_FAILED');
        }

        const selected = selection?.filePaths?.[0];
        if (!selection || selection.canceled === true || !selected) {
            return canceled();
        }

        let stat;
        try {
            stat = await fsImpl.promises.stat(selected);
        } catch {
            return rejected('HARDWARE_PILOT_IMPORT_STAT_FAILED');
        }

        if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_IMPORT_BYTES) {
            return rejected('HARDWARE_PILOT_IMPORT_SIZE_INVALID');
        }

        let bytes;
        try {
            bytes = await fsImpl.promises.readFile(selected);
        } catch {
            return rejected('HARDWARE_PILOT_IMPORT_READ_FAILED');
        }

        let intake;
        try {
            intake = buildHardwarePilotImportIntake({
                fileName: path.basename(selected),
                bytes,
            });
        } catch {
            return rejected('HARDWARE_PILOT_IMPORT_EVIDENCE_INVALID');
        }

        importedBundles.set(intake.sha256, cloneBundle(intake.bundle));
        return sanitizeHardwarePilotImportResult(intake);
    });

    return Object.freeze({
        channel: CHANNEL,
        userInitiatedOpenDialog: true,
        rendererPathInputAllowed: false,
        rawBundleReturnedToRenderer: false,
        maxImportBytes: MAX_IMPORT_BYTES,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    CHANNEL,
    importedBundles,
    readImportedBundle,
    register,
};
