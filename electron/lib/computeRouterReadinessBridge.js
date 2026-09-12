'use strict';

const { ipcMain } = require('electron');
const {
    assertTrustedSender,
    MUAPI_PROVIDER,
    MUAPI_SECRET,
} = require('./providerCredentials');
const { probeHardwareCapabilities } = require('./hardwareCapabilityProbe');
const { buildReadinessSnapshot } = require('./computeRouterReadinessSnapshot');

const CHANNEL = 'compute-router:readiness-snapshot';

async function failSoft(read) {
    try {
        return await read();
    } catch {
        return undefined;
    }
}

async function collectReadinessSnapshot({
    store,
    getSdCppSnapshot,
    getWan2gpSnapshot,
    getHardwareSnapshot = probeHardwareCapabilities,
    getMuapiTransportHealth,
} = {}) {
    const [sdcpp, wan2gp, hardware, credentialReadiness, transportHealth] = await Promise.all([
        typeof getSdCppSnapshot === 'function'
            ? failSoft(() => getSdCppSnapshot())
            : undefined,
        typeof getWan2gpSnapshot === 'function'
            ? failSoft(() => getWan2gpSnapshot())
            : undefined,
        typeof getHardwareSnapshot === 'function'
            ? failSoft(() => getHardwareSnapshot())
            : undefined,
        store && typeof store.getReadiness === 'function'
            ? failSoft(() => store.getReadiness(MUAPI_PROVIDER, MUAPI_SECRET))
            : undefined,
        typeof getMuapiTransportHealth === 'function'
            ? failSoft(() => getMuapiTransportHealth())
            : undefined,
    ]);

    return buildReadinessSnapshot({
        sdcpp,
        wan2gp,
        hardware,
        credentialReadiness,
        transportHealth,
    });
}

function register({
    store,
    getSdCppSnapshot,
    getWan2gpSnapshot,
    getHardwareSnapshot,
    getMuapiTransportHealth,
} = {}) {
    const sdCppReader = getSdCppSnapshot
        || require('./localInference').getReadinessSnapshot;
    const wan2gpReader = getWan2gpSnapshot
        || require('./wan2gpProvider').getReadinessSnapshot;

    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event) => {
        assertTrustedSender(event);
        return collectReadinessSnapshot({
            store,
            getSdCppSnapshot: sdCppReader,
            getWan2gpSnapshot: wan2gpReader,
            getHardwareSnapshot,
            getMuapiTransportHealth,
        });
    });
}

module.exports = {
    CHANNEL,
    collectReadinessSnapshot,
    register,
};
