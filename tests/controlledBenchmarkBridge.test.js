const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('P1C20 preload exposes one separate benchmark capability with one method', () => {
    const preload = read('electron/preload.js');

    assert.equal((preload.match(/exposeInMainWorld\('orbiBenchmark'/g) || []).length, 1);
    assert.ok(preload.includes("runSample: (request) => ipcRenderer.invoke('compute-router:controlled-benchmark-sample', request)"));
    assert.equal(preload.includes('orbiBenchmark.binaryPath'), false);
    assert.equal(preload.includes('orbiBenchmark.modelPath'), false);
    assert.equal(preload.includes('orbiBenchmark.outputDir'), false);
});

test('P1C20 bridge authenticates sender and delegates to the bounded sample runner', () => {
    const bridge = read('electron/lib/controlledBenchmarkBridge.js');

    assert.ok(bridge.includes("const CHANNEL = 'compute-router:controlled-benchmark-sample'"));
    assert.ok(bridge.includes('assertTrustedSender(event)'));
    assert.ok(bridge.includes('createControlledBenchmarkSampleRunner'));
    assert.ok(bridge.includes('return runner.runSample(request)'));
    assert.ok(bridge.includes('benchmarkOnly: true'));
    assert.ok(bridge.includes('productionProfilePromoted: false'));
    assert.ok(bridge.includes('routingEligible: false'));
    assert.ok(bridge.includes('cutoverAuthorized: false'));
    assert.ok(bridge.includes("executionAuthority: 'legacy-dispatcher-only'"));
});

test('P1C20 localInference exports main-only state readers without adding benchmark IPC there', () => {
    const localInference = read('electron/lib/localInference.js');

    assert.ok(localInference.includes('getBinaryStatus,'));
    assert.ok(localInference.includes('listModels,'));
    assert.equal(localInference.includes('compute-router:controlled-benchmark-sample'), false);
    assert.equal(localInference.includes('runLocalBenchmark'), false);
});

test('P1C20 main registers the benchmark bridge but does not auto-run a benchmark', () => {
    const main = read('electron/main.js');

    assert.ok(main.includes("require('./lib/controlledBenchmarkBridge')"));
    assert.ok(main.includes('registerControlledBenchmark();'));
    assert.equal(main.includes('.runSample('), false);
    assert.equal(main.includes('runLocalBenchmark('), false);
});

test('P1C20 direct benchmark execution bridge remains absent from Router Diagnostics and generation surfaces', () => {
    const settings = read('src/components/SettingsModal.js');
    const panel = read('src/components/RouterDiagnosticsPanel.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    assert.ok(settings.includes('window.orbiBenchmark?.exportPilotBundle(bundle)'));
    assert.equal(settings.includes('window.orbiBenchmark?.runSample'), false);
    assert.equal(panel.includes('window.orbiBenchmark'), false);

    for (const source of [settings, panel, image, video]) {
        assert.equal(source.includes('controlledBenchmarkBridge'), false);
        assert.equal(source.includes('CONTROLLED_BENCHMARK_SAMPLE_READY'), false);
        assert.equal(source.includes('window.orbiBenchmark.runSample'), false);
    }
});

test('P1C20 renderer request cannot supply filesystem or execution identity fields', () => {
    const core = read('electron/lib/controlledBenchmarkSampleCore.js');

    assert.ok(core.includes("const REQUEST_KEYS = new Set(['modelId', 'backend', 'width', 'height', 'runIndex'])"));
    for (const forbiddenKey of [
        'binaryPath',
        'modelPath',
        'outputDir',
        'sourceCommit',
        'runtimeIdentity',
        'runtimeVersion',
        'llmPath',
        'vaePath',
    ]) {
        assert.equal(
            core.includes(`REQUEST_KEYS = new Set([\n    '${forbiddenKey}'`),
            false,
        );
    }
});
