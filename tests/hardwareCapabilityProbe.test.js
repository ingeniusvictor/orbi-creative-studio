const test = require('node:test');
const assert = require('node:assert/strict');
const {
    COMMAND_TIMEOUT_MS,
    COMMAND_MAX_BUFFER,
    DEFAULT_READINESS_CACHE_TTL_MS,
    probeCommand,
    probeCommandAsync,
    parseNvidiaSmi,
    parseCudaVersion,
    probeHardwareCapabilities,
    probeHardwareCapabilitiesAsync,
    createCachedHardwareCapabilityProbe,
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


test('probeCommandAsync enforces bounded no-shell execution options', async () => {
    let observed;
    const result = await probeCommandAsync('nvcc', ['--version'], {
        execFileImpl: (command, args, options, callback) => {
            observed = { command, args, options };
            setImmediate(() => callback(null, 'Cuda compilation tools, release 12.4, V12.4.99'));
        },
    });

    assert.equal(result.available, true);
    assert.equal(observed.command, 'nvcc');
    assert.deepEqual(observed.args, ['--version']);
    assert.equal(observed.options.timeout, COMMAND_TIMEOUT_MS);
    assert.equal(observed.options.maxBuffer, COMMAND_MAX_BUFFER);
    assert.equal(observed.options.shell, false);
});

test('async hardware readiness probe preserves measured facts and starts all commands without serial waits', async () => {
    const started = [];
    const pending = new Map();

    const execFileImpl = (command, args, options, callback) => {
        started.push(command);
        pending.set(command, callback);
    };

    const promise = probeHardwareCapabilitiesAsync({
        osImpl: fakeOs(),
        execFileImpl,
        platform: 'linux',
        arch: 'x64',
    });

    assert.deepEqual(started, ['nvidia-smi', 'nvcc', 'vulkaninfo', 'rocminfo']);

    pending.get('nvidia-smi')(null, 'NVIDIA RTX ASYNC, 12288, 560.10\n');
    pending.get('nvcc')(null, 'Cuda compilation tools, release 12.4, V12.4.99');
    pending.get('vulkaninfo')(null, 'Vulkan Instance Version: 1.3.280');
    const rocmError = new Error('missing');
    rocmError.code = 'ENOENT';
    pending.get('rocminfo')(rocmError, '');

    const result = await promise;
    assert.equal(result.platform, 'linux');
    assert.equal(result.cpu.logicalCores, 8);
    assert.equal(result.memory.totalMiB, 16384);
    assert.equal(result.accelerators.nvidia.available, true);
    assert.equal(result.accelerators.nvidia.gpus[0].memoryTotalMiB, 12288);
    assert.equal(result.accelerators.cudaToolkit.version, '12.4');
    assert.equal(result.accelerators.vulkan.available, true);
    assert.equal(result.accelerators.rocm.available, false);
    assert.equal(result.probePolicy.shellUsed, false);
    assert.equal(result.probePolicy.execution, 'async-parallel');
});

test('async hardware readiness probe degrades missing tools without throwing', async () => {
    const result = await probeHardwareCapabilitiesAsync({
        osImpl: fakeOs(),
        execFileImpl: (command, args, options, callback) => {
            const error = new Error('missing');
            error.code = 'ENOENT';
            setImmediate(() => callback(error, ''));
        },
        platform: 'win32',
        arch: 'x64',
    });

    assert.equal(result.accelerators.nvidia.available, false);
    assert.equal(result.accelerators.cudaToolkit.available, false);
    assert.equal(result.accelerators.vulkan.available, false);
    assert.equal(result.accelerators.rocm.available, false);
});


test('cached hardware readiness probe reuses stable evidence and can be invalidated', async () => {
    let calls = 0;
    let clock = 1000;
    const snapshot = Object.freeze({ schemaVersion: 1, platform: 'test' });
    const cached = createCachedHardwareCapabilityProbe({
        probeImpl: async () => {
            calls += 1;
            return snapshot;
        },
        cacheTtlMs: DEFAULT_READINESS_CACHE_TTL_MS,
        now: () => clock,
    });

    const first = await cached.probe();
    const second = await cached.probe();
    assert.equal(calls, 1);
    assert.equal(first, snapshot);
    assert.equal(second, snapshot);

    clock += DEFAULT_READINESS_CACHE_TTL_MS + 1;
    await cached.probe();
    assert.equal(calls, 2);

    cached.invalidate();
    await cached.probe();
    assert.equal(calls, 3);
});

test('cached hardware readiness probe coalesces concurrent collection', async () => {
    let calls = 0;
    let resolveProbe;
    const cached = createCachedHardwareCapabilityProbe({
        probeImpl: () => {
            calls += 1;
            return new Promise((resolve) => {
                resolveProbe = resolve;
            });
        },
        cacheTtlMs: 0,
    });

    const first = cached.probe();
    const second = cached.probe();
    await Promise.resolve();
    assert.equal(calls, 1);

    const snapshot = Object.freeze({ schemaVersion: 1, platform: 'test' });
    resolveProbe(snapshot);
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a, snapshot);
    assert.equal(a, b);
});
