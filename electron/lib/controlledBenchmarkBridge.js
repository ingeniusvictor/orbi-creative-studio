'use strict';

const { ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const {
    getBinaryStatus,
    listModels,
} = require('./localInference');
const { getBuildIdentity } = require('./buildIdentity');
const { runLocalBenchmark } = require('./localBenchmarkHarness');
const { sha256File } = require('./fileIntegrity');
const {
    createControlledBenchmarkSampleRunner,
} = require('./controlledBenchmarkSampleCore');

const CHANNEL = 'compute-router:controlled-benchmark-sample';

function register({
    getBinaryStatusImpl = getBinaryStatus,
    listModelsImpl = listModels,
    getBuildIdentityImpl = getBuildIdentity,
    runLocalBenchmarkImpl = runLocalBenchmark,
    sha256FileImpl = sha256File,
} = {}) {
    const runner = createControlledBenchmarkSampleRunner({
        getBinaryStatus: getBinaryStatusImpl,
        listModels: listModelsImpl,
        getBuildIdentity: getBuildIdentityImpl,
        runLocalBenchmark: runLocalBenchmarkImpl,
        sha256File: sha256FileImpl,
    });

    ipcMain.removeHandler(CHANNEL);
    ipcMain.handle(CHANNEL, async (event, request) => {
        assertTrustedSender(event);
        return runner.runSample(request);
    });

    return Object.freeze({
        channel: CHANNEL,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    CHANNEL,
    register,
};
