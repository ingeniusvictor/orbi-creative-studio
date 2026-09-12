const test = require('node:test');
const assert = require('node:assert/strict');
const {
    COMMAND_TIMEOUT_MS,
    COMMAND_MAX_BUFFER,
    probeCommand,
    probeCommandAsync,
    parseNvidiaSmi,
    parseCudaVersion,
    probeHardwareCapabilities,
    probeHardwareCapabilitiesAsync,
} = require('../electron/lib/hardwareCapabilityProbe');

function fakeOs() {
    return {
        totalmem: () => 16 * 1024 * 1024 * 1024,
        freemem: () => 6 * 1024 * 1024 * 1024,
        cpus: () => Array.from({ length: 8 }, () => ({
            model: 'Test CPU 8-Core',
            speed: 3200,
        })),
    };
}

test('probeCommand refuses non-allowlisted commands', () => {
    assert.throws(
        () => probeCommand('powershell', ['Get-ChildItem'], { execFileSyncImpl: () => '' }),
        (error) => error.code === 'PROBE_COMMAND_NOT_ALLOWED',
    );
});

test('probeCommand enforces bounded no-shell execution options', () => {
    let observed;
    const result = probeCommand('nvcc', ['--version'], {
        execFileSyncImpl: (command, args, options) => {
            observed = { command, args, options };
            return 'Cuda compilation tools, release 12.4, V12.4.99';
        },
    });

    assert.equal(result.available, true);
    assert.equal(observed.command, 'nvcc');
    assert.deepEqual(observed.args, ['--version']);
    assert.equal(observed.options.timeout, COMMAND_TIMEOUT_MS);
    assert.equal(observed.options.maxBuffer, COMMAND_MAX_BUFFER);
    assert.equal(Object.prototype.hasOwnProperty.call(observed.options, 'shell'), false);
});

test('NVIDIA parser records name VRAM and driver', () => {
    assert.deepEqual(
        parseNvidiaSmi('NVIDIA GeForce RTX 3060, 12288, 560.94\n'),
        [{ name: 'NVIDIA GeForce RTX 3060', memoryTotalMiB: 12288, driverVersion: '560.94' }],
    );
});

test('CUDA version parser handles nvcc release output', () => {
    assert.equal(parseCudaVersion('Cuda compilation tools, release 12.4, V12.4.99'), '12.4');
    assert.equal(parseCudaVersion('not cuda'), null);
});

test('hardware probe reports measured facts without inventing unsupported accelerators', () => {
    const calls = [];
    const execFileSyncImpl = (command) => {
        calls.push(command);
        if (command === 'nvidia-smi') return 'NVIDIA RTX TEST, 8192, 555.10\n';
        if (command === 'nvcc') return 'Cuda compilation tools, release 12.2, V12.2.10';
        if (command === 'vulkaninfo') return 'Vulkan Instance Version: 1.3.280';
        const error = new Error('not installed');
        error.code = 'ENOENT';
        throw error;
    };

    const result = probeHardwareCapabilities({
        osImpl: fakeOs(),
        execFileSyncImpl,
        platform: 'linux',
        arch: 'x64',
    });

    assert.equal(result.platform, 'linux');
    assert.equal(result.arch, 'x64');
    assert.equal(result.cpu.logicalCores, 8);
    assert.equal(result.memory.totalMiB, 16384);
    assert.equal(result.memory.freeMiB, 6144);
    assert.equal(result.accelerators.nvidia.available, true);
    assert.equal(result.accelerators.nvidia.gpus[0].memoryTotalMiB, 8192);
    assert.equal(result.accelerators.cudaToolkit.version, '12.2');
    assert.equal(result.accelerators.vulkan.available, true);
    assert.equal(result.accelerators.rocm.available, false);
    assert.deepEqual(calls, ['nvidia-smi', 'nvcc', 'vulkaninfo', 'rocminfo']);
    assert.equal(result.probePolicy.shellUsed, false);
});

test('missing probe tools degrade to unavailable facts rather than throwing', () => {
    const result = probeHardwareCapabilities({
        osImpl: fakeOs(),
        execFileSyncImpl: () => {
            const error = new Error('missing');
            error.code = 'ENOENT';
            throw error;
        },
        platform: 'win32',
        arch: 'x64',
    });

    assert.equal(result.accelerators.nvidia.available, false);
    assert.equal(result.accelerators.cudaToolkit.available, false);
    assert.equal(result.accelerators.vulkan.available, false);
    assert.equal(result.accelerators.rocm.available, false);
});


test('async command probe uses bounded execFile without shell and resolves failures as facts', async () => {
    let observed;
    const ok = await probeCommandAsync('nvcc', ['--version'], {
        execFileImpl: (command, args, options, callback) => {
            observed = { command, args, options };
            callback(null, 'Cuda compilation tools, release 12.5, V12.5.1', '');
        },
    });

    assert.equal(ok.available, true);
    assert.equal(observed.command, 'nvcc');
    assert.deepEqual(observed.args, ['--version']);
    assert.equal(observed.options.timeout, COMMAND_TIMEOUT_MS);
    assert.equal(observed.options.maxBuffer, COMMAND_MAX_BUFFER);
    assert.equal(Object.prototype.hasOwnProperty.call(observed.options, 'shell'), false);

    const missing = await probeCommandAsync('rocminfo', [], {
        execFileImpl: (_command, _args, _options, callback) => {
            const error = new Error('missing');
            error.code = 'ENOENT';
            callback(error, '', '');
        },
    });
    assert.equal(missing.available, false);
    assert.equal(missing.error, 'ENOENT');
});

test('async hardware probe launches independent accelerator checks without blocking composition', async () => {
    const calls = [];
    const execFileImpl = (command, _args, _options, callback) => {
        calls.push(command);
        queueMicrotask(() => {
            if (command === 'nvidia-smi') return callback(null, 'NVIDIA RTX ASYNC, 12288, 560.10\n', '');
            if (command === 'nvcc') return callback(null, 'Cuda compilation tools, release 12.5, V12.5.1', '');
            if (command === 'vulkaninfo') return callback(null, 'Vulkan Instance Version: 1.3', '');
            const error = new Error('missing');
            error.code = 'ENOENT';
            callback(error, '', '');
        });
    };

    const result = await probeHardwareCapabilitiesAsync({
        osImpl: fakeOs(),
        execFileImpl,
        platform: 'win32',
        arch: 'x64',
    });

    assert.deepEqual(calls, ['nvidia-smi', 'nvcc', 'vulkaninfo', 'rocminfo']);
    assert.equal(result.accelerators.nvidia.available, true);
    assert.equal(result.accelerators.nvidia.gpus[0].memoryTotalMiB, 12288);
    assert.equal(result.accelerators.cudaToolkit.version, '12.5');
    assert.equal(result.accelerators.vulkan.available, true);
    assert.equal(result.accelerators.rocm.available, false);
    assert.equal(result.probePolicy.execution, 'async-parallel');
});
