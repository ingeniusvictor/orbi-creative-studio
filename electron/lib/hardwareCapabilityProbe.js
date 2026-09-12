'use strict';

const os = require('node:os');
const { execFileSync, execFile } = require('node:child_process');

const COMMAND_TIMEOUT_MS = 2500;
const COMMAND_MAX_BUFFER = 512 * 1024;
const ALLOWED_COMMANDS = new Set(['nvidia-smi', 'nvcc', 'vulkaninfo', 'rocminfo']);

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function mib(bytes) {
    return Math.round(bytes / (1024 * 1024));
}

function probeCommand(command, args = [], { execFileSyncImpl = execFileSync } = {}) {
    if (!ALLOWED_COMMANDS.has(command)) {
        const error = new Error('Hardware probe command is not allowlisted');
        error.code = 'PROBE_COMMAND_NOT_ALLOWED';
        throw error;
    }
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
        throw new TypeError('Hardware probe command arguments must be strings');
    }

    try {
        const stdout = execFileSyncImpl(command, args, {
            encoding: 'utf8',
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: COMMAND_MAX_BUFFER,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return {
            available: true,
            stdout: String(stdout || '').slice(0, COMMAND_MAX_BUFFER),
            error: null,
        };
    } catch (error) {
        return {
            available: false,
            stdout: '',
            error: error?.code || error?.name || 'probe-failed',
        };
    }
}


function probeCommandAsync(command, args = [], { execFileImpl = execFile } = {}) {
    if (!ALLOWED_COMMANDS.has(command)) {
        return Promise.reject(Object.assign(
            new Error('Hardware probe command is not allowlisted'),
            { code: 'PROBE_COMMAND_NOT_ALLOWED' },
        ));
    }
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
        return Promise.reject(new TypeError('Hardware probe command arguments must be strings'));
    }

    return new Promise((resolve) => {
        execFileImpl(command, args, {
            encoding: 'utf8',
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: COMMAND_MAX_BUFFER,
            windowsHide: true,
        }, (error, stdout) => {
            if (error) {
                resolve({
                    available: false,
                    stdout: '',
                    error: error?.code || error?.name || 'probe-failed',
                });
                return;
            }
            resolve({
                available: true,
                stdout: String(stdout || '').slice(0, COMMAND_MAX_BUFFER),
                error: null,
            });
        });
    });
}

function parseNvidiaSmi(stdout) {
    const gpus = [];
    for (const rawLine of String(stdout || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const parts = line.split(',').map((part) => part.trim());
        if (parts.length < 3) continue;
        const memoryTotalMiB = safeNumber(parts[1]);
        gpus.push({
            name: parts[0] || 'unknown',
            memoryTotalMiB,
            driverVersion: parts.slice(2).join(',').trim() || null,
        });
    }
    return gpus;
}

function parseCudaVersion(stdout) {
    const text = String(stdout || '');
    const release = text.match(/release\s+(\d+(?:\.\d+)+)/i);
    if (release) return release[1];
    const version = text.match(/V(\d+(?:\.\d+)+)/);
    return version ? version[1] : null;
}

function summarizeCpu(osImpl) {
    let cpus = [];
    try {
        cpus = osImpl.cpus?.() || [];
    } catch {
        cpus = [];
    }
    const first = cpus[0] || {};
    return {
        logicalCores: cpus.length || null,
        model: typeof first.model === 'string' && first.model.trim() ? first.model.trim() : null,
        speedMHz: safeNumber(first.speed),
    };
}

function probeHardwareCapabilities({
    osImpl = os,
    execFileSyncImpl = execFileSync,
    platform = process.platform,
    arch = process.arch,
} = {}) {
    const totalMemoryMiB = mib(osImpl.totalmem());
    const freeMemoryMiB = mib(osImpl.freemem());

    const nvidiaResult = probeCommand(
        'nvidia-smi',
        ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'],
        { execFileSyncImpl },
    );
    const nvidiaGpus = nvidiaResult.available ? parseNvidiaSmi(nvidiaResult.stdout) : [];

    const cudaResult = probeCommand('nvcc', ['--version'], { execFileSyncImpl });
    const vulkanResult = probeCommand('vulkaninfo', ['--summary'], { execFileSyncImpl });
    const rocmResult = probeCommand('rocminfo', [], { execFileSyncImpl });

    return Object.freeze({
        schemaVersion: 1,
        platform,
        arch,
        cpu: Object.freeze(summarizeCpu(osImpl)),
        memory: Object.freeze({
            totalMiB: totalMemoryMiB,
            freeMiB: freeMemoryMiB,
        }),
        accelerators: Object.freeze({
            nvidia: Object.freeze({
                available: nvidiaGpus.length > 0,
                probeAvailable: nvidiaResult.available,
                gpus: Object.freeze(nvidiaGpus.map((gpu) => Object.freeze(gpu))),
            }),
            cudaToolkit: Object.freeze({
                available: cudaResult.available,
                version: cudaResult.available ? parseCudaVersion(cudaResult.stdout) : null,
            }),
            vulkan: Object.freeze({
                available: vulkanResult.available,
                summaryObserved: vulkanResult.available,
            }),
            rocm: Object.freeze({
                available: rocmResult.available,
            }),
        }),
        probePolicy: Object.freeze({
            commandTimeoutMs: COMMAND_TIMEOUT_MS,
            commandMaxBufferBytes: COMMAND_MAX_BUFFER,
            shellUsed: false,
        }),
    });
}


async function probeHardwareCapabilitiesAsync({
    osImpl = os,
    execFileImpl = execFile,
    platform = process.platform,
    arch = process.arch,
} = {}) {
    const totalMemoryMiB = mib(osImpl.totalmem());
    const freeMemoryMiB = mib(osImpl.freemem());

    const [nvidiaResult, cudaResult, vulkanResult, rocmResult] = await Promise.all([
        probeCommandAsync(
            'nvidia-smi',
            ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'],
            { execFileImpl },
        ),
        probeCommandAsync('nvcc', ['--version'], { execFileImpl }),
        probeCommandAsync('vulkaninfo', ['--summary'], { execFileImpl }),
        probeCommandAsync('rocminfo', [], { execFileImpl }),
    ]);

    const nvidiaGpus = nvidiaResult.available ? parseNvidiaSmi(nvidiaResult.stdout) : [];

    return Object.freeze({
        schemaVersion: 1,
        platform,
        arch,
        cpu: Object.freeze(summarizeCpu(osImpl)),
        memory: Object.freeze({
            totalMiB: totalMemoryMiB,
            freeMiB: freeMemoryMiB,
        }),
        accelerators: Object.freeze({
            nvidia: Object.freeze({
                available: nvidiaGpus.length > 0,
                probeAvailable: nvidiaResult.available,
                gpus: Object.freeze(nvidiaGpus.map((gpu) => Object.freeze(gpu))),
            }),
            cudaToolkit: Object.freeze({
                available: cudaResult.available,
                version: cudaResult.available ? parseCudaVersion(cudaResult.stdout) : null,
            }),
            vulkan: Object.freeze({
                available: vulkanResult.available,
                summaryObserved: vulkanResult.available,
            }),
            rocm: Object.freeze({
                available: rocmResult.available,
            }),
        }),
        probePolicy: Object.freeze({
            commandTimeoutMs: COMMAND_TIMEOUT_MS,
            commandMaxBufferBytes: COMMAND_MAX_BUFFER,
            shellUsed: false,
            execution: 'async-parallel',
        }),
    });
}

module.exports = {
    ALLOWED_COMMANDS,
    COMMAND_TIMEOUT_MS,
    COMMAND_MAX_BUFFER,
    probeCommand,
    probeCommandAsync,
    parseNvidiaSmi,
    parseCudaVersion,
    probeHardwareCapabilities,
    probeHardwareCapabilitiesAsync,
};
