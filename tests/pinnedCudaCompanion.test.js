const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { resolvePinnedRuntime } = require('../electron/lib/runtimeManifest');
const {
    installPinnedRuntimeCompanions,
    promoteExtractedRuntime,
} = require('../electron/lib/runtimePayload');
const {
    inspectPinnedRuntimeInstallation,
    recordPinnedRuntimeInstallation,
} = require('../electron/lib/runtimeInstallationEvidence');

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function tempFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-cuda-companion-'));
    const binDir = path.join(root, 'bin');
    const tmpDir = path.join(root, 'tmp');
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    return { root, binDir, tmpDir };
}

test('P1C52 pins the official CUDA12 companion asset and DLL contract', () => {
    const runtime = resolvePinnedRuntime({
        platform: 'win32',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'cuda12' },
    });

    assert.equal(runtime.companions.length, 1);
    assert.deepEqual(runtime.companions[0], {
        assetName: 'cudart-sd-bin-win-cu12-x64.zip',
        url: 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-859-7f410a3/cudart-sd-bin-win-cu12-x64.zip',
        size: 563452046,
        sha256: 'fe20366827d357c00797eebb58244dddab7fd9a348d70090c3871004c320f38d',
        requiredFiles: [
            'cudart64_12.dll',
            'cublas64_12.dll',
            'cublasLt64_12.dll',
        ],
    });
});

test('P1C52 promotes the full primary runtime directory beside sd-cli', (t) => {
    const f = tempFixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const extracted = path.join(f.tmpDir, 'extract', 'bin');
    fs.mkdirSync(path.join(extracted, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(extracted, 'sd-cli.exe'), 'exe');
    fs.writeFileSync(path.join(extracted, 'stable-diffusion.dll'), 'shared');
    fs.writeFileSync(path.join(extracted, 'ggml-cuda.dll'), 'backend');
    fs.writeFileSync(path.join(extracted, 'nested', 'extra.dll'), 'extra');

    promoteExtractedRuntime({
        extractDir: path.join(f.tmpDir, 'extract'),
        binDir: f.binDir,
        binaryName: 'sd-cli.exe',
    });

    assert.equal(fs.readFileSync(path.join(f.binDir, 'sd-cli.exe'), 'utf8'), 'exe');
    assert.equal(fs.readFileSync(path.join(f.binDir, 'stable-diffusion.dll'), 'utf8'), 'shared');
    assert.equal(fs.readFileSync(path.join(f.binDir, 'ggml-cuda.dll'), 'utf8'), 'backend');
    assert.equal(fs.readFileSync(path.join(f.binDir, 'nested', 'extra.dll'), 'utf8'), 'extra');
});

test('P1C52 installs only a hash-verified CUDA companion and flattens required DLLs', async (t) => {
    const f = tempFixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const runtime = resolvePinnedRuntime({
        platform: 'win32',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'cuda12' },
    });

    const observed = await installPinnedRuntimeCompanions({
        runtime,
        binDir: f.binDir,
        tmpDir: f.tmpDir,
        downloadFile: async (_url, destination, onProgress) => {
            fs.writeFileSync(destination, 'verified-companion-archive');
            onProgress?.(0.5);
        },
        verifyFileSha256: async (_file, expected) => ({
            ok: true,
            expected,
            actual: expected,
        }),
        extractZip: async (_archive, destination) => {
            const nested = path.join(destination, 'cuda', 'bin');
            fs.mkdirSync(nested, { recursive: true });
            fs.writeFileSync(path.join(nested, 'cudart64_12.dll'), 'cudart');
            fs.writeFileSync(path.join(nested, 'cublas64_12.dll'), 'cublas');
            fs.writeFileSync(path.join(nested, 'cublasLt64_12.dll'), 'cublasLt');
        },
        now: () => 12345,
    });

    assert.equal(observed.length, 1);
    assert.equal(observed[0].archiveSha256, runtime.companions[0].sha256);
    for (const name of runtime.companions[0].requiredFiles) {
        assert.equal(fs.existsSync(path.join(f.binDir, name)), true);
    }
});

test('P1C52 fails closed on companion digest mismatch without installing DLLs', async (t) => {
    const f = tempFixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const runtime = resolvePinnedRuntime({
        platform: 'win32',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'cuda12' },
    });

    await assert.rejects(
        installPinnedRuntimeCompanions({
            runtime,
            binDir: f.binDir,
            tmpDir: f.tmpDir,
            downloadFile: async (_url, destination) => fs.writeFileSync(destination, 'bad'),
            verifyFileSha256: async (_file, expected) => ({
                ok: false,
                expected,
                actual: '0'.repeat(64),
            }),
            extractZip: async () => {
                throw new Error('must not extract unverified companion');
            },
        }),
        /integrity check failed/,
    );

    for (const name of runtime.companions[0].requiredFiles) {
        assert.equal(fs.existsSync(path.join(f.binDir, name)), false);
    }
});

test('P1C52 installation receipt binds and re-verifies CUDA support files', async (t) => {
    const f = tempFixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const runtime = resolvePinnedRuntime({
        platform: 'win32',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'cuda12' },
    });

    const binaryPath = path.join(f.binDir, 'sd-cli.exe');
    fs.writeFileSync(binaryPath, 'binary');
    fs.writeFileSync(path.join(f.binDir, 'cudart64_12.dll'), 'cudart');
    fs.writeFileSync(path.join(f.binDir, 'cublas64_12.dll'), 'cublas');
    fs.writeFileSync(path.join(f.binDir, 'cublasLt64_12.dll'), 'cublasLt');

    const companionInstallations = [{
        assetName: runtime.companions[0].assetName,
        archiveSha256: runtime.companions[0].sha256,
        requiredFiles: runtime.companions[0].requiredFiles,
    }];

    const receipt = await recordPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath,
        runtime,
        archiveSha256: runtime.sha256,
        companionInstallations,
        now: () => 1000,
    });

    assert.equal(receipt.companions.length, 1);
    assert.equal(receipt.companions[0].files.length, 3);

    const good = await inspectPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath,
        runtime,
    });
    assert.equal(good.integrityVerified, true);
    assert.equal(good.companionReceiptMatch, true);
    assert.equal(good.supportFilesVerified, true);

    fs.writeFileSync(path.join(f.binDir, 'cublas64_12.dll'), 'tampered');
    const changed = await inspectPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath,
        runtime,
    });
    assert.equal(changed.integrityVerified, false);
    assert.equal(changed.reason, 'RUNTIME_SUPPORT_FILE_CHANGED_AFTER_INSTALL');
});

test('P1C52 refuses to create a CUDA receipt without verified companion evidence', async (t) => {
    const f = tempFixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const runtime = resolvePinnedRuntime({
        platform: 'win32',
        arch: 'x64',
        env: { OPEN_GENERATIVE_AI_SD_BACKEND: 'cuda12' },
    });
    const binaryPath = path.join(f.binDir, 'sd-cli.exe');
    fs.writeFileSync(binaryPath, 'binary');

    await assert.rejects(
        recordPinnedRuntimeInstallation({
            binDir: f.binDir,
            binaryPath,
            runtime,
            archiveSha256: runtime.sha256,
        }),
        /companion count/,
    );
});

test('P1C52 local installer can repair an existing runtime instead of returning bundled early', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    assert.ok(source.includes('!fs.existsSync(BINARY_PATH) && ensureBundledBinaryInstalled()'));
    assert.ok(source.includes('installPinnedRuntimeCompanions({'));
    assert.ok(source.includes('companionInstallations,'));
    assert.ok(source.includes('promoteExtractedRuntime({'));
});
