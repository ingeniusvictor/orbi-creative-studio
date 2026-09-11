const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    RUNTIME_MANIFEST,
    resolvePinnedRuntime,
} = require('../electron/lib/runtimeManifest');
const {
    sha256File,
    verifyFileSha256,
} = require('../electron/lib/fileIntegrity');

test('pinned runtime defaults Windows x64 to CPU compatibility', () => {
    const runtime = resolvePinnedRuntime({ platform: 'win32', arch: 'x64', env: {} });
    assert.equal(runtime.backend, 'cpu');
    assert.equal(runtime.assetName, 'sd-master-7f410a3-bin-win-cpu-x64.zip');
    assert.equal(runtime.sha256, '38c58cd603e39f91a63fb4c854db4af19c6a15b642d3982ab3c5b336b05c1855');
});

test('pinned runtime accepts explicit Windows CUDA 12 backend', () => {
    const runtime = resolvePinnedRuntime({
        platform: 'win32',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'cuda12' },
    });
    assert.equal(runtime.backend, 'cuda12');
    assert.match(runtime.assetName, /cuda12/);
});

test('pinned runtime defaults Linux x64 to plain CPU build and supports Vulkan override', () => {
    const cpu = resolvePinnedRuntime({ platform: 'linux', arch: 'x64', env: {} });
    assert.equal(cpu.backend, 'cpu');
    assert.equal(cpu.size, 33224779);

    const vulkan = resolvePinnedRuntime({
        platform: 'linux',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'vulkan' },
    });
    assert.equal(vulkan.backend, 'vulkan');
    assert.match(vulkan.assetName, /vulkan/);
});

test('pinned runtime defaults macOS arm64 to fixed Metal asset', () => {
    const runtime = resolvePinnedRuntime({ platform: 'darwin', arch: 'arm64', env: {} });
    assert.equal(runtime.backend, 'metal');
    assert.equal(runtime.release, 'v1.0.3-binaries');
    assert.equal(runtime.sha256, '197c1254468cac17a00dce9256d683be43bf20ea202d3c2915debc05c6deaac0');
});

test('pinned runtime rejects unsupported platforms/backends', () => {
    assert.throws(
        () => resolvePinnedRuntime({ platform: 'linux', arch: 'arm64', env: {} }),
        /No pinned local inference runtime/
    );
    assert.throws(
        () => resolvePinnedRuntime({
            platform: 'linux',
            arch: 'x64',
            env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'metal' },
        }),
        /not certified/
    );
});

test('every pinned runtime entry has HTTPS URL, exact size and SHA-256', () => {
    for (const variants of Object.values(RUNTIME_MANIFEST)) {
        for (const runtime of Object.values(variants)) {
            assert.match(runtime.url, /^https:\/\//);
            assert.ok(Number.isInteger(runtime.size) && runtime.size > 0);
            assert.match(runtime.sha256, /^[a-f0-9]{64}$/);
        }
    }
});

test('file integrity helper computes and verifies SHA-256', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-integrity-'));
    const file = path.join(dir, 'sample.bin');
    fs.writeFileSync(file, 'ORBI');
    const expected = 'a56362a10c816abf206d72cb914e2d5ca454eb9c7e744f88b1a1422c379e9942';

    assert.equal(await sha256File(file), expected);
    assert.deepEqual(await verifyFileSha256(file, expected), {
        ok: true,
        expected,
        actual: expected,
    });
    const mismatch = await verifyFileSha256(file, '0'.repeat(64));
    assert.equal(mismatch.ok, false);

    fs.rmSync(dir, { recursive: true, force: true });
});
