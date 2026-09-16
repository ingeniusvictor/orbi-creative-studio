'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { sha256File } = require('./fileIntegrity');

const PROTOCOL_VERSION = 'p1c5-v1';
const HARNESS_VERSION = 'orbi-local-benchmark-harness-0.1.0';
const DEFAULT_SAMPLE_INTERVAL_MS = 250;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;
const NVIDIA_QUERY_TIMEOUT_MS = 2000;
const NVIDIA_QUERY_MAX_BUFFER = 128 * 1024;
const CONTROLLED_PROMPT = 'ORBI controlled local resource benchmark. Neutral studio object on plain background.';
const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);
const ALLOWED_BINARY_NAMES = new Set(['sd-cli', 'sd-cli.exe']);

function mib(bytes) {
    return bytes / (1024 * 1024);
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function exactCommit(value) {
    return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function assertExistingFile(filePath, label) {
    if (typeof filePath !== 'string' || !filePath.trim() || !fs.existsSync(filePath)) {
        const error = new Error(`${label} must reference an existing file`);
        error.code = 'BENCHMARK_FILE_MISSING';
        throw error;
    }
}

function validatePlan(plan) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
        throw new TypeError('benchmark plan must be an object');
    }
    if (!positiveInteger(plan.runIndex)) throw new TypeError('benchmark runIndex must be a positive integer');
    if (typeof plan.modelId !== 'string' || !plan.modelId.trim()) throw new TypeError('benchmark modelId is required');
    if (!CERTIFIABLE_BACKENDS.has(plan.backend)) throw new TypeError('benchmark backend must be cpu or cuda12');
    if (!positiveInteger(plan.width) || !positiveInteger(plan.height)) {
        throw new TypeError('benchmark width and height must be positive integers');
    }
    if (!exactCommit(plan.sourceCommit)) throw new TypeError('benchmark sourceCommit must be an exact 40-character lowercase hex commit');
    if (typeof plan.runtimeIdentity !== 'string' || !plan.runtimeIdentity.trim()) throw new TypeError('benchmark runtimeIdentity is required');
    if (typeof plan.runtimeVersion !== 'string' || !plan.runtimeVersion.trim()) throw new TypeError('benchmark runtimeVersion is required');
    if (typeof plan.modelType !== 'string' || !plan.modelType.trim()) throw new TypeError('benchmark modelType is required');

    assertExistingFile(plan.binaryPath, 'benchmark binaryPath');
    if (!ALLOWED_BINARY_NAMES.has(path.basename(plan.binaryPath))) {
        const error = new Error('benchmark runtime binary must be sd-cli');
        error.code = 'BENCHMARK_BINARY_NOT_ALLOWED';
        throw error;
    }
    assertExistingFile(plan.modelPath, 'benchmark modelPath');
    if (plan.modelType === 'z-image') {
        assertExistingFile(plan.llmPath, 'benchmark llmPath');
        assertExistingFile(plan.vaePath, 'benchmark vaePath');
    }
    if (typeof plan.outputDir !== 'string' || !plan.outputDir.trim() || !fs.existsSync(plan.outputDir)) {
        throw new TypeError('benchmark outputDir must reference an existing directory');
    }
}

function buildControlledBenchmarkArgs(plan, outputPath) {
    const modelFlag = (plan.modelType === 'z-image' || plan.modelType === 'flux')
        ? '--diffusion-model'
        : '-m';
    const args = [
        modelFlag, plan.modelPath,
        '-p', CONTROLLED_PROMPT,
        '-o', outputPath,
        '--steps', String(positiveInteger(plan.steps) ? plan.steps : 1),
        '-H', String(plan.height),
        '-W', String(plan.width),
        '--cfg-scale', String(Number.isFinite(plan.guidanceScale) ? plan.guidanceScale : 1),
        '--seed', '1',
        '--sampling-method', typeof plan.sampler === 'string' && plan.sampler.trim() ? plan.sampler : 'euler',
    ];

    if (plan.modelType === 'z-image') {
        args.push('--llm', plan.llmPath, '--vae', plan.vaePath);
        if (typeof plan.scheduler === 'string' && plan.scheduler.trim()) args.push('--scheduler', plan.scheduler);
    } else if (plan.modelType === 'sdxl') {
        args.push('--sd-version', 'sdxl');
    } else if (plan.modelType === 'sd2') {
        args.push('--sd-version', 'sd2');
    } else if (plan.modelType === 'flux') {
        args.push('--flux');
    }

    return args;
}

function parseNvidiaComputeMemory(stdout, targetPid) {
    let totalMiB = 0;
    for (const rawLine of String(stdout || '').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const [pidText, memoryText] = line.split(',').map((part) => part.trim());
        const pid = Number.parseInt(pidText, 10);
        const memoryMiB = Number.parseFloat(memoryText);
        if (pid === targetPid && Number.isFinite(memoryMiB) && memoryMiB >= 0) totalMiB += memoryMiB;
    }
    return totalMiB;
}

function queryNvidiaProcessMemoryMiB(targetPid, { execFileImpl = execFile } = {}) {
    if (!positiveInteger(targetPid)) return Promise.resolve(null);

    return new Promise((resolve) => {
        execFileImpl(
            'nvidia-smi',
            ['--query-compute-apps=pid,used_gpu_memory', '--format=csv,noheader,nounits'],
            {
                encoding: 'utf8',
                timeout: NVIDIA_QUERY_TIMEOUT_MS,
                maxBuffer: NVIDIA_QUERY_MAX_BUFFER,
                windowsHide: true,
                shell: false,
            },
            (error, stdout) => {
                if (error) {
                    resolve(null);
                    return;
                }
                resolve(parseNvidiaComputeMemory(stdout, targetPid));
            },
        );
    });
}

function usedSystemMemoryMiB(osImpl = os) {
    return mib(osImpl.totalmem() - osImpl.freemem());
}

function terminateChild(child) {
    if (!child || child.exitCode !== null || child.killed) return;
    try {
        child.kill('SIGTERM');
    } catch {
        // Best-effort cleanup after a bounded benchmark timeout/failure.
    }
}

async function runLocalBenchmark(plan, {
    spawnImpl = spawn,
    execFileImpl = execFile,
    osImpl = os,
    sha256FileImpl = sha256File,
    now = () => new Date(),
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
} = {}) {
    validatePlan(plan);

    const sampleIntervalMs = plan.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    const timeoutMs = plan.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(sampleIntervalMs) || sampleIntervalMs < 100 || sampleIntervalMs > 5000) {
        throw new TypeError('benchmark sampleIntervalMs must be between 100 and 5000');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > MAX_TIMEOUT_MS) {
        throw new TypeError('benchmark timeoutMs must be between 1000 and 1800000');
    }

    const [runtimeBinarySha256, modelArtifactSha256] = await Promise.all([
        sha256FileImpl(plan.binaryPath),
        sha256FileImpl(plan.modelPath),
    ]);

    const measuredAt = now().toISOString();
    const outputPath = path.join(
        plan.outputDir,
        `orbi-benchmark-${plan.modelId}-${plan.backend}-${plan.runIndex}-${Date.now()}.png`,
    );
    const args = buildControlledBenchmarkArgs(plan, outputPath);
    const spawnEnv = {
        ...process.env,
        DYLD_LIBRARY_PATH: path.dirname(plan.binaryPath),
        LD_LIBRARY_PATH: path.dirname(plan.binaryPath),
    };

    let peakSystemRamMiB = usedSystemMemoryMiB(osImpl);
    let peakVramMiB = plan.backend === 'cuda12' ? 0 : null;
    let interval = null;
    let timeout = null;
    let sampling = false;

    try {
        const child = spawnImpl(plan.binaryPath, args, {
            env: spawnEnv,
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'ignore', 'pipe'],
        });

        if (!child || !positiveInteger(child.pid)) {
            throw new Error('benchmark runtime did not provide a valid process id');
        }

        const sampleResources = async () => {
            if (sampling) return;
            sampling = true;
            try {
                peakSystemRamMiB = Math.max(peakSystemRamMiB, usedSystemMemoryMiB(osImpl));
                if (plan.backend === 'cuda12') {
                    const observed = await queryNvidiaProcessMemoryMiB(child.pid, { execFileImpl });
                    if (Number.isFinite(observed)) peakVramMiB = Math.max(peakVramMiB, observed);
                }
            } finally {
                sampling = false;
            }
        };

        await sampleResources();
        interval = setIntervalImpl(() => {
            void sampleResources();
        }, sampleIntervalMs);

        const exitCode = await new Promise((resolve, reject) => {
            timeout = setTimeoutImpl(() => {
                terminateChild(child);
                const error = new Error('controlled benchmark exceeded its bounded timeout');
                error.code = 'BENCHMARK_TIMEOUT';
                reject(error);
            }, timeoutMs);

            child.once('error', reject);
            child.once('close', (code) => resolve(code));
        });

        await sampleResources();
        if (exitCode !== 0) {
            const error = new Error(`controlled benchmark runtime exited with code ${exitCode ?? 'signal'}`);
            error.code = 'BENCHMARK_RUNTIME_FAILED';
            throw error;
        }
        if (plan.backend === 'cuda12' && !(peakVramMiB > 0)) {
            const error = new Error('CUDA12 benchmark completed without measurable target-process VRAM');
            error.code = 'BENCHMARK_VRAM_NOT_MEASURED';
            throw error;
        }

        return Object.freeze({
            sample: Object.freeze({
                schemaVersion: 1,
                protocolVersion: PROTOCOL_VERSION,
                runIndex: plan.runIndex,
                modelId: plan.modelId,
                backend: plan.backend,
                resolution: Object.freeze({ width: plan.width, height: plan.height }),
                harnessVersion: HARNESS_VERSION,
                sourceCommit: plan.sourceCommit,
                runtimeIdentity: plan.runtimeIdentity,
                runtimeVersion: plan.runtimeVersion,
                runtimeBinarySha256,
                modelArtifactSha256,
                measuredAt,
                peakSystemRamMiB: Math.ceil(peakSystemRamMiB),
                peakVramMiB: plan.backend === 'cuda12' ? Math.ceil(peakVramMiB) : null,
            }),
            benchmarkOnly: true,
            productionProfilePromoted: false,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });
    } finally {
        if (interval) clearIntervalImpl(interval);
        if (timeout) clearTimeoutImpl(timeout);
        try {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch {
            // Benchmark output is disposable evidence scaffolding only.
        }
    }
}

module.exports = {
    ALLOWED_BINARY_NAMES,
    CERTIFIABLE_BACKENDS,
    CONTROLLED_PROMPT,
    DEFAULT_SAMPLE_INTERVAL_MS,
    DEFAULT_TIMEOUT_MS,
    HARNESS_VERSION,
    MAX_TIMEOUT_MS,
    PROTOCOL_VERSION,
    buildControlledBenchmarkArgs,
    parseNvidiaComputeMemory,
    queryNvidiaProcessMemoryMiB,
    runLocalBenchmark,
    usedSystemMemoryMiB,
    validatePlan,
};
