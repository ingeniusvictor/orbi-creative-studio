const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
    evaluateBackendActivation,
    resolveGenerationBackendArgs,
} = require('../electron/lib/runtimeBackendProbe');

test('P1C55 keeps auto mode delegated to sd.cpp auto-fit', () => {
    const activation = evaluateBackendActivation({
        backend: 'cuda12',
        stdout: 'CPU\tGeneric CPU\nCUDA0\tGPU\n',
    });

    const args = resolveGenerationBackendArgs({
        runtime: { requested: 'auto', backend: 'cuda12' },
        activation,
    });

    assert.deepEqual(args, []);
});

test('P1C55 binds explicit CUDA selection to the discovered runtime device name', () => {
    const activation = evaluateBackendActivation({
        backend: 'cuda12',
        stdout: 'CPU\tGeneric CPU\nCUDA0\tNVIDIA GPU\n',
    });

    assert.equal(activation.selectedDeviceName, 'CUDA0');
    assert.deepEqual(resolveGenerationBackendArgs({
        runtime: { requested: 'cuda12', backend: 'cuda12' },
        activation,
    }), ['--backend', 'CUDA0']);
});

test('P1C55 binds explicit Vulkan, Metal and CPU selections to discovered names', () => {
    const fixtures = [
        ['vulkan', 'Vulkan0\tGPU\nCPU\tCPU\n', 'Vulkan0'],
        ['metal', 'Metal\tApple GPU\nCPU\tCPU\n', 'Metal'],
        ['cpu', 'CPU\tGeneric CPU\n', 'CPU'],
    ];

    for (const [backend, stdout, expected] of fixtures) {
        const activation = evaluateBackendActivation({ backend, stdout });
        assert.deepEqual(resolveGenerationBackendArgs({
            runtime: { requested: backend, backend },
            activation,
        }), ['--backend', expected]);
    }
});

test('P1C55 fails closed instead of silently falling back for an explicit unavailable backend', () => {
    const activation = evaluateBackendActivation({
        backend: 'cuda12',
        stdout: 'CPU\tGeneric CPU\n',
    });

    assert.throws(
        () => resolveGenerationBackendArgs({
            runtime: { requested: 'cuda12', backend: 'cuda12' },
            activation,
        }),
        /Explicit backend "cuda12" is not active/,
    );
});

test('P1C55 local generation injects verified backend args before spawning sd-cli', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    const resolveIndex = source.indexOf('backendArgs = resolveGenerationBackendArgs({');
    const argsIndex = source.indexOf('...backendArgs');
    const spawnIndex = source.indexOf('activeProcess = spawn(BINARY_PATH, args');

    assert.ok(resolveIndex >= 0);
    assert.ok(argsIndex > resolveIndex);
    assert.ok(spawnIndex > argsIndex);
});

test('P1C55 does not expose selectedDeviceName through provider readiness', () => {
    const source = fs.readFileSync('electron/lib/providerReadinessSnapshotCore.js', 'utf8');
    assert.equal(source.includes('selectedDeviceName'), false);
    assert.equal(source.includes('description'), false);
});
