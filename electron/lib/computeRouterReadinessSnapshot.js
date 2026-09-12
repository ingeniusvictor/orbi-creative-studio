'use strict';

const { ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const { probeHardwareCapabilitiesAsync } = require('./hardwareCapabilityProbe');
const { getBinaryStatus, listModels: listSdModels } = require('./localInference');
const {
    readConfig: readWanConfig,
    probe: probeWan,
    listModelsFromProbe: listWanModelsFromProbe,
} = require('./wan2gpProvider');
const { collectReadinessSnapshot } = require('./computeRouterReadinessSnapshotCore');

const CHANNEL = 'compute-router:readiness-snapshot';

function register({ store } = {}) {
    if (!store) throw new TypeError('Provider secret store is required for readiness snapshot');

    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event) => {
        assertTrustedSender(event);
        return collectReadinessSnapshot({
            store,
            probeHardware: () => probeHardwareCapabilitiesAsync(),
            getBinaryStatus,
            listSdModels,
            readWanConfig,
            probeWan,
            listWanModelsFromProbe,
        });
    });
}

module.exports = {
    CHANNEL,
    register,
};
