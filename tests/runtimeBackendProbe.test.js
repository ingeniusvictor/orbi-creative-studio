const test = require('node:test');
const assert = require('node:assert/strict');

const {
    evaluateBackendActivation,
    parseDeviceList,
    probeRuntimeBackend,
} = require('../electron/lib/runtimeBackendProbe');

test('P1C54 parses the pinned sd.cpp name<TAB>description device contract', () => {
    assert.deepEqual(parseDeviceList('CPU\tGeneric CPU\nCUDA0\tNVIDIA GPU\n'), [
        { name: 'CPU', description: 'Generic CPU' },
        { name: 'CUDA0', description: 'NVIDIA GPU' },
    ]);
});

test('P1C54 verifies requested backend families without depending on hardware descriptions', () => {
    assert.equal(evaluateBackendActivation({
        backend: 'cuda12',
        stdout: 'CPU\tGeneric CPU\nCUDA0\tNVIDIA RTX\n',
    }).verified, true);

    assert.equal(evaluateBackendActivation({
        backend: 'vulkan',
        stdout: 'CPU\tGeneric CPU\nVulkan0\tGPU\n',
    }).verified, true);

    assert.equal(evaluateBackendActivation({
        backend: 'metal',
        stdout: 'Metal\tApple GPU\nCPU\tCPU\n',
    }).verified, true);
});

test('P1C54 fails closed when the selected backend device is absent', () => {
    const result = evaluateBackendActivation({
        backend: 'cuda12',
        stdout: 'CPU\tGeneric CPU\n',
    });

    assert.equal(result.verified, false);
    assert.equal(result.reason, 'EXPECTED_BACKEND_DEVICE_NOT_FOUND');
});

test('P1C54 executes only the official --list-devices probe', async () => {
    const calls = [];
    const result = await probeRuntimeBackend({
        binaryPath: '/fake/sd-cli',
        backend: 'cuda12',
        execFileImpl: (binary, args, options, callback) => {
            calls.push({ binary, args, options });
            callback(null, 'CPU\tGeneric CPU\nCUDA0\tGPU\n', '');
        },
    });

    assert.equal(result.verified, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].binary, '/fake/sd-cli');
    assert.deepEqual(calls[0].args, ['--list-devices']);
    assert.equal(calls[0].options.windowsHide, true);
});

test('P1C54 probe execution failures remain non-ready', async () => {
    const result = await probeRuntimeBackend({
        binaryPath: '/fake/sd-cli',
        backend: 'cuda12',
        execFileImpl: (_binary, _args, _options, callback) => {
            callback(new Error('load failed'), '', 'failed');
        },
    });

    assert.equal(result.verified, false);
    assert.equal(result.reason, 'BACKEND_DEVICE_PROBE_FAILED');
});
