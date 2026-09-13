'use strict';

const { ipcMain } = require('electron');
const {
    assertTrustedSender,
    MUAPI_PROVIDER,
    MUAPI_SECRET,
} = require('./providerCredentials');
const { probeHardwareCapabilities } = require('./hardwareCapabilityProbe');
const { getReadinessEvidence: getSdCppReadinessEvidence } = require('./localInference');
const { getReadinessEvidence: getWan2gpReadinessEvidence } = require('./wan2gpProvider');
const { buildProviderReadinessSnapshot } = require('./providerReadinessSnapshotCore');

const CHANNEL = 'compute-router:readiness-snapshot';

function register({
    store,
    getSdCppEvidence = getSdCppReadinessEvidence,
    getWan2gpEvidence = getWan2gpReadinessEvidence,
    probeHardware = probeHardwareCapabilities,
} = {}) {
    if (!store || typeof store.getReadiness !== 'function') {
        throw new TypeError('Provider secret store with getReadiness() is required');
    }

    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event) => {
        assertTrustedSender(event);

        const [sdcppEvidence, wan2gpEvidence] = await Promise.all([
            getSdCppEvidence(),
            getWan2gpEvidence(),
        ]);

        const hardwareSnapshot = probeHardware();
        const muapiCredentialReadiness = store.getReadiness(MUAPI_PROVIDER, MUAPI_SECRET);

        return buildProviderReadinessSnapshot({
            sdcppEvidence,
            wan2gpEvidence,
            muapiCredentialReadiness,
            hardwareSnapshot,
        });
    });
}

module.exports = {
    CHANNEL,
    register,
};
