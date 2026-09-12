'use strict';

const { app, ipcMain, safeStorage } = require('electron');
const { createProviderSecretStore } = require('./providerSecretStore');

const CHANNELS = Object.freeze({
    readiness: 'provider-credentials:readiness',
    setMuapiKey: 'provider-credentials:set-muapi-key',
    deleteMuapiKey: 'provider-credentials:delete-muapi-key',
});

const MUAPI_PROVIDER = 'muapi';
const MUAPI_SECRET = 'apiKey';

function assertTrustedSender(event) {
    const frame = event?.senderFrame;
    const mainFrame = event?.sender?.mainFrame;
    if (!frame || !mainFrame || frame !== mainFrame) {
        const error = new Error('Provider credential IPC rejected: untrusted frame');
        error.code = 'UNTRUSTED_IPC_SENDER';
        throw error;
    }

    const url = frame.url || '';
    if (!url.startsWith('file://')) {
        const error = new Error('Provider credential IPC rejected: unexpected renderer origin');
        error.code = 'UNTRUSTED_IPC_ORIGIN';
        throw error;
    }
}

function register({ store } = {}) {
    const secretStore = store || createProviderSecretStore({
        safeStorage,
        userDataPath: app.getPath('userData'),
    });

    ipcMain.removeHandler(CHANNELS.readiness);
    ipcMain.removeHandler(CHANNELS.setMuapiKey);
    ipcMain.removeHandler(CHANNELS.deleteMuapiKey);

    ipcMain.handle(CHANNELS.readiness, async (event) => {
        assertTrustedSender(event);
        return secretStore.getReadiness(MUAPI_PROVIDER, MUAPI_SECRET);
    });

    ipcMain.handle(CHANNELS.setMuapiKey, async (event, value) => {
        assertTrustedSender(event);
        return secretStore.setSecret(MUAPI_PROVIDER, MUAPI_SECRET, value);
    });

    ipcMain.handle(CHANNELS.deleteMuapiKey, async (event) => {
        assertTrustedSender(event);
        return { deleted: secretStore.deleteSecret(MUAPI_PROVIDER, MUAPI_SECRET) };
    });

    return secretStore;
}

module.exports = {
    CHANNELS,
    MUAPI_PROVIDER,
    MUAPI_SECRET,
    assertTrustedSender,
    register,
};
