const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const harness = require('../electron/lib/localBenchmarkHarness');

function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-p1c6-'));
    const binaryPath = path.join(dir, process.platform === 'win32' ? 'sd-cli.exe' : 'sd-cli');
    const modelPath = path.join(dir, 'model.gguf');
    const llmPath = path.join(dir, 'llm.gguf');
    const vaePath = path.join(dir, 'vae.safetensors');
    for (const file of [binaryPath, modelPath, llmPath, vaePath]) fs.writeFileSync(file, 'fixture');

    return {
        dir,
        plan: {
            runIndex: 1,
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 1024,
            height: 1024,
            sourceCommit: 'a'.repeat(40),
            runtimeIdentity: 'sd.cpp-cuda12',
            runtimeVersion: 'test-runtime-v1',
            modelType: 'z-image',
            binaryPath,
            modelPath,
            llmPath,
            vaePath,
            outputDir: dir,
            steps: 1,
            guidanceScale: 1,
            sampler: 'euler',
            scheduler: 'simple',
            sampleIntervalMs: 100,
            timeoutMs: 5000,
        },
    };
}

function successfulChild(pid = 4242) {
    const child = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.killed = false;
    child.stderr = new EventEmitter();
    child.kill = () => {
        child.killed = true;
        return true;
    };
    setImmediate(() => {
        child.exitCode = 0;
        child.emit('close', 0);
    });
    return child;
}

test('P1C6 only permits sd-cli benchmark binary names', () => {
    const { dir, plan } = fixture();
    const badBinary = path.join(dir, 'arbitrary-tool');
    fs.writeFileSync(badBinary, 'fixture');

    assert.throws(
        () => harness.validatePlan({ ...plan, binaryPath: badBinary }),
        (error) => error.code === 'BENCHMARK_BINARY_NOT_ALLOWED',
    );
});

test('controlled args use fixed benchmark prompt, seed and exact resolution', () => {
    const { plan } = fixture();
    const args = harness.buildControlledBenchmarkArgs(plan, '/tmp/out.png');

    assert.ok(args.includes(harness.CONTROLLED_PROMPT));
    assert.equal(args.includes('--seed'), true);
    assert.equal(args[args.indexOf('--seed') + 1], '1');
    assert.equal(args[args.indexOf('-W') + 1], '1024');
    assert.equal(args[args.indexOf('-H') + 1], '1024');
    assert.equal(args.includes('--llm'), true);
    assert.equal(args.includes('--vae'), true);
});

test('NVIDIA compute parser totals only the target pid', () => {
    const parsed = harness.parseNvidiaComputeMemory('4242, 4096\n7777, 1200\n4242, 512\n', 4242);
    assert.equal(parsed, 4608);
});

test('bounded CUDA12 harness emits a valid P1C5 sample and no routing authority', async () => {
    const { plan } = fixture();
    let spawnCall = null;
    let freeCall = 0;

    const result = await harness.runLocalBenchmark(plan, {
        spawnImpl: (binaryPath, args, options) => {
            spawnCall = { binaryPath, args, options };
            return successfulChild();
        },
        execFileImpl: (command, args, options, callback) => {
            assert.equal(command, 'nvidia-smi');
            assert.equal(options.shell, false);
            callback(null, '4242, 6144\n7777, 999\n');
        },
        osImpl: {
            totalmem: () => 32 * 1024 * 1024 * 1024,
            freemem: () => {
                freeCall += 1;
                return (freeCall === 1 ? 24 : 22) * 1024 * 1024 * 1024;
            },
        },
        sha256FileImpl: async (filePath) => (
            filePath === plan.binaryPath ? 'b'.repeat(64) : 'c'.repeat(64)
        ),
        now: () => new Date('2026-09-16T03:00:00.000Z'),
        setIntervalImpl: () => 123,
        clearIntervalImpl: () => {},
        setTimeoutImpl: () => 456,
        clearTimeoutImpl: () => {},
    });

    assert.equal(spawnCall.binaryPath, plan.binaryPath);
    assert.equal(spawnCall.options.shell, false);
    assert.equal(result.sample.protocolVersion, 'p1c5-v1');
    assert.equal(result.sample.harnessVersion, 'orbi-local-benchmark-harness-0.1.0');
    assert.equal(result.sample.runtimeBinarySha256, 'b'.repeat(64));
    assert.equal(result.sample.modelArtifactSha256, 'c'.repeat(64));
    assert.equal(result.sample.peakSystemRamMiB, 10240);
    assert.equal(result.sample.peakVramMiB, 6144);
    assert.equal(result.benchmarkOnly, true);
    assert.equal(result.productionProfilePromoted, false);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.equal(result.executionAuthority, 'legacy-dispatcher-only');

    const p1c5 = await import('../src/lib/computeRouter/controlledBenchmark.mjs');
    assert.deepEqual(p1c5.validateControlledBenchmarkSample(result.sample), { ok: true, reason: null });
});

test('CPU harness emits null VRAM and does not invoke nvidia-smi', async () => {
    const { plan } = fixture();
    const cpuPlan = { ...plan, backend: 'cpu' };
    let nvidiaCalled = false;

    const result = await harness.runLocalBenchmark(cpuPlan, {
        spawnImpl: () => successfulChild(),
        execFileImpl: () => { nvidiaCalled = true; },
        osImpl: {
            totalmem: () => 16 * 1024 * 1024 * 1024,
            freemem: () => 8 * 1024 * 1024 * 1024,
        },
        sha256FileImpl: async () => 'd'.repeat(64),
        now: () => new Date('2026-09-16T03:00:00.000Z'),
        setIntervalImpl: () => 1,
        clearIntervalImpl: () => {},
        setTimeoutImpl: () => 2,
        clearTimeoutImpl: () => {},
    });

    assert.equal(nvidiaCalled, false);
    assert.equal(result.sample.peakVramMiB, null);
});

test('CUDA12 benchmark fails closed when target-process VRAM cannot be measured', async () => {
    const { plan } = fixture();

    await assert.rejects(
        harness.runLocalBenchmark(plan, {
            spawnImpl: () => successfulChild(),
            execFileImpl: (command, args, options, callback) => callback(new Error('nvidia-smi unavailable')),
            osImpl: {
                totalmem: () => 16 * 1024 * 1024 * 1024,
                freemem: () => 8 * 1024 * 1024 * 1024,
            },
            sha256FileImpl: async () => 'e'.repeat(64),
            now: () => new Date('2026-09-16T03:00:00.000Z'),
            setIntervalImpl: () => 1,
            clearIntervalImpl: () => {},
            setTimeoutImpl: () => 2,
            clearTimeoutImpl: () => {},
        }),
        (error) => error.code === 'BENCHMARK_VRAM_NOT_MEASURED',
    );
});

test('benchmark bounds sampling interval and timeout', async () => {
    const { plan } = fixture();

    await assert.rejects(
        harness.runLocalBenchmark({ ...plan, sampleIntervalMs: 10 }, { sha256FileImpl: async () => 'f'.repeat(64) }),
        /sampleIntervalMs/,
    );
    await assert.rejects(
        harness.runLocalBenchmark({ ...plan, timeoutMs: harness.MAX_TIMEOUT_MS + 1 }, { sha256FileImpl: async () => 'f'.repeat(64) }),
        /timeoutMs/,
    );
});
