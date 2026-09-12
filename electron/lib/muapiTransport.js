'use strict';

const { ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const { authenticatedRequest, authenticatedUpload } = require('./muapiTransportCore');
const { createMuapiHealthTracker } = require('./muapiHealthTracker');

const CHANNELS = Object.freeze({
    request: 'muapi-transport:request',
    upload: 'muapi-transport:upload',
});

function register({
    store,
    fetchImpl = fetch,
    healthTracker = createMuapiHealthTracker(),
} = {}) {
    if (!store) throw new TypeError('Provider secret store is required');
    if (!healthTracker
        || typeof healthTracker.recordResponse !== 'function'
        || typeof healthTracker.recordError !== 'function'
        || typeof healthTracker.getHealthSnapshot !== 'function') {
        throw new TypeError('MuAPI health tracker is invalid');
    }

    ipcMain.removeHandler(CHANNELS.request);
    ipcMain.removeHandler(CHANNELS.upload);

    ipcMain.handle(CHANNELS.request, async (event, request) => {
        assertTrustedSender(event);
        try {
            const result = await authenticatedRequest({ store, fetchImpl, request });
            healthTracker.recordResponse(result);
            return result;
        } catch (error) {
            healthTracker.recordError(error);
            throw error;
        }
    });

    ipcMain.handle(CHANNELS.upload, async (event, payload) => {
        assertTrustedSender(event);
        try {
            const result = await authenticatedUpload({ store, fetchImpl, payload });
            healthTracker.recordResponse(result);
            return result;
        } catch (error) {
            healthTracker.recordError(error);
            throw error;
        }
    });

    return Object.freeze({
        getHealthSnapshot: () => healthTracker.getHealthSnapshot(),
    });
}

module.exports = { CHANNELS, register };
