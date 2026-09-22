const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveSourceBinDir, stageLocalAiBinary } = require('../scripts/stage-local-ai-binary');

const repoRoot = path.resolve(__dirname, '..');

function makeSourceDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-sd-stage-'));
    for (const [name, contents] of Object.entries(files)) {
        const full = path.join(dir, name);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, contents);
    }
    return dir;
}

function cleanup(sourceDir, platform, arch) {
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, 'build', 'local-ai', `${platform}-${arch}`), {
        recursive: true,
        force: true,
    });
}

test('P1C51 stages the complete Windows runtime payload', () => {
    const sourceDir = makeSourceDir({
        'sd-cli.exe': 'exe',
        'stable-diffusion.dll': 'dll',
        'ggml.dll': 'dll',
        'ggml-base.dll': 'dll',
        'ggml-cpu-haswell.dll': 'dll',
        'libwebp.dll': 'dll',
        'nested/backend-extra.dll': 'dll',
    });

    try {
        const stageDir = stageLocalAiBinary({
            platform: 'win32',
            arch: 'x64',
            sourcePath: sourceDir,
        });

        assert.equal(fs.readFileSync(path.join(stageDir, 'sd-cli.exe'), 'utf8'), 'exe');
        assert.equal(fs.readFileSync(path.join(stageDir, 'stable-diffusion.dll'), 'utf8'), 'dll');
        assert.equal(fs.readFileSync(path.join(stageDir, 'ggml.dll'), 'utf8'), 'dll');
        assert.equal(fs.readFileSync(path.join(stageDir, 'nested', 'backend-extra.dll'), 'utf8'), 'dll');
    } finally {
        cleanup(sourceDir, 'win32', 'x64');
    }
});

test('P1C51 rejects a Windows source missing stable-diffusion.dll', () => {
    const sourceDir = makeSourceDir({ 'sd-cli.exe': 'exe' });

    try {
        assert.throws(
            () => stageLocalAiBinary({ platform: 'win32', arch: 'x64', sourcePath: sourceDir }),
            /Missing required files.*stable-diffusion\.dll/s,
        );
    } finally {
        cleanup(sourceDir, 'win32', 'x64');
    }
});

test('P1C51 preserves nested bin source resolution', () => {
    const sourceDir = makeSourceDir({ 'bin/sd-cli': 'bin' });

    try {
        assert.equal(resolveSourceBinDir(sourceDir), path.join(path.resolve(sourceDir), 'bin'));
    } finally {
        fs.rmSync(sourceDir, { recursive: true, force: true });
    }
});
