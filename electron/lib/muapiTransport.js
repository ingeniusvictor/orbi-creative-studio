'use strict';

const { ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const { authenticatedRequest, authenticatedUpload } = require('./muapiTransportCore');

const CHANNELS = Object.freeze({
    request: 'muapi-transport:request',
    upload: 'muapi-transport:upload',
});

function register({ store, fetchImpl = fetch } = {}) {
    if (!store) throw new TypeError('Provider secret store is required');

    ipcMain.removeHandler(CHANNELS.request);
    ipcMain.removeHandler(CHANNELS.upload);

    ipcMain.handle(CHANNELS.request, async (event, request) => {
        assertTrustedSender(event);
        return authenticatedRequest({ store, fetchImpl, request });
    });

    ipcMain.handle(CHANNELS.upload, async (event, payload) => {
        assertTrustedSender(event);
        return authenticatedUpload({ store, fetchImpl, payload });
    });
}

module.exports = { CHANNELS, register };
