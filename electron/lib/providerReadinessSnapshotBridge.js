'use strict';

const { ipcMain } = require('electron');
const {
    assertTrustedSender,
    MUAPI_PROVIDER,
    MUAPI_SECRET,
} = require('./providerCredentials');
const { createCachedHardwareCapabilityProbe } = require('./hardwareCapabilityProbe');
const { getReadinessEvidence: getSdCppReadinessEvidence } = require('./localInference');
const { getReadinessEvidence: getWan2gpReadinessEvidence } = require('./wan2gpProvider');
const {
    buildProviderReadinessSnapshot,
    canProbeMuapiHealth,
} = require('./providerReadinessSnapshotCore');
const { createMuapiHealthProbe } = require('./muapiHealthProbe');

const CHANNEL = 'compute-router:readiness-snapshot';

function register({
    store,
    getSdCppEvidence = getSdCppReadinessEvidence,
    getWan2gpEvidence = getWan2gpReadinessEvidence,
    createHardwareProbe = createCachedHardwareCapabilityProbe,
    createHealthProbe = createMuapiHealthProbe,
} = {}) {
    if (!store || typeof store.getReadiness !== 'function' || typeof store.getSecret !== 'function') {
        throw new TypeError('Provider secret store with readiness/secret access is required');
    }

    const hardwareProbe = createHardwareProbe();
    const muapiHealthProbe = createHealthProbe({ store });

    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event) => {
        assertTrustedSender(event);

        const [sdcppEvidence, wan2gpEvidence] = await Promise.all([
            getSdCppEvidence(),
            getWan2gpEvidence(),
        ]);

        const hardwareSnapshot = await hardwareProbe.probe();
        const muapiCredentialReadiness = store.getReadiness(MUAPI_PROVIDER, MUAPI_SECRET);

        const muapiTransportHealth = canProbeMuapiHealth(muapiCredentialReadiness)
            ? await muapiHealthProbe.probe()
            : undefined;

        return buildProviderReadinessSnapshot({
            sdcppEvidence,
            wan2gpEvidence,
            muapiCredentialReadiness,
            muapiTransportHealth,
            hardwareSnapshot,
        });
    });
}

module.exports = {
    CHANNEL,
    register,
};
