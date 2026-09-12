const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

test('runtime build identity validator accepts only exact SHA and version', () => {
    const { validateIdentity } = require('../electron/lib/buildIdentity');
    const valid = validateIdentity({
        schemaVersion: 1,
        sourceCommit: 'A'.repeat(40),
        appVersion: '2.0.0',
    });

    assert.equal(valid.available, true);
    assert.equal(valid.sourceCommit, 'a'.repeat(40));
    assert.equal(valid.appVersion, '2.0.0');
    assert.equal(valid.reason, null);

    const invalid = validateIdentity({
        schemaVersion: 1,
        sourceCommit: 'short',
        appVersion: '2.0.0',
    });
    assert.equal(invalid.available, false);
    assert.equal(invalid.sourceCommit, null);
});

test('build identity writer resolves checked-out git HEAD and emits exact immutable metadata', () => {
    const script = fs.readFileSync('scripts/write-build-identity.js', 'utf8');

    assert.ok(script.includes("execFileSync('git', ['rev-parse', 'HEAD']"));
    assert.ok(script.includes('ORBI_BUILD_SHA'));
    assert.ok(script.includes('GITHUB_SHA'));
    assert.ok(script.includes('VERCEL_GIT_COMMIT_SHA'));
    assert.ok(script.includes('CI_COMMIT_SHA'));
    assert.ok(script.includes('ORBI_BUILD_SHA does not match checked-out git HEAD'));
    assert.ok(script.includes("schemaVersion: 1"));
    assert.ok(script.includes('appVersion: readAppVersion()'));
    assert.equal(script.includes('Date.now()'), false);
});

test('generated build identity for this checkout matches git HEAD', () => {
    execFileSync(process.execPath, ['scripts/write-build-identity.js'], {
        cwd: ROOT,
        stdio: 'pipe',
    });

    const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
    }).trim().toLowerCase();

    const generatedPath = path.join(ROOT, 'electron', 'generated', 'buildIdentity.js');
    delete require.cache[require.resolve(generatedPath)];
    const generated = require(generatedPath);

    assert.equal(generated.schemaVersion, 1);
    assert.equal(generated.sourceCommit, gitHead);
    assert.match(generated.sourceCommit, /^[0-9a-f]{40}$/);
    assert.equal(generated.appVersion, require('../package.json').version);
    assert.equal(Object.isFrozen(generated), true);
});

test('explicit ORBI_BUILD_SHA mismatch with git HEAD fails closed', () => {
    const wrong = 'f'.repeat(40);
    const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
    }).trim().toLowerCase();
    const mismatch = wrong === gitHead ? 'e'.repeat(40) : wrong;

    assert.throws(
        () => execFileSync(process.execPath, ['scripts/write-build-identity.js'], {
            cwd: ROOT,
            env: { ...process.env, ORBI_BUILD_SHA: mismatch },
            stdio: 'pipe',
        }),
        (error) => {
            const stderr = String(error.stderr || '');
            return stderr.includes('ORBI_BUILD_SHA does not match checked-out git HEAD');
        },
    );
});

test('preload exposes build identity as static metadata without IPC', () => {
    const preload = fs.readFileSync('electron/preload.js', 'utf8');

    assert.ok(preload.includes("const { getBuildIdentity } = require('./lib/buildIdentity');"));
    assert.ok(preload.includes("contextBridge.exposeInMainWorld('orbiBuildIdentity', getBuildIdentity());"));
    assert.equal(preload.includes("ipcRenderer.invoke('build-identity"), false);
});

test('all Vite and Electron packaging scripts pass through build identity generation', () => {
    const pkg = require('../package.json');

    assert.equal(pkg.scripts['build:identity'], 'node scripts/write-build-identity.js');
    assert.equal(pkg.scripts['vite:dev'], 'npm run build:identity && vite');
    assert.equal(pkg.scripts['vite:build'], 'npm run build:identity && vite build');

    for (const name of [
        'electron:dev',
        'electron:build',
        'electron:build:win',
        'electron:build:linux',
        'electron:build:linux:dir',
        'electron:build:linux:arm64:dir',
        'electron:build:all',
    ]) {
        assert.ok(pkg.scripts[name].startsWith('npm run vite:build &&'), `${name} bypasses vite:build`);
    }
});

test('generated identity is ignored by git but packaged under electron files', () => {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const pkg = require('../package.json');

    assert.ok(gitignore.includes('electron/generated/buildIdentity.js'));
    assert.ok(pkg.build.files.includes('electron/**/*'));
});

test('P1B.19 does not wire build identity into generation components', () => {
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');
    const main = fs.readFileSync('src/main.js', 'utf8');

    assert.equal(image.includes('orbiBuildIdentity'), false);
    assert.equal(video.includes('orbiBuildIdentity'), false);
    assert.equal(main.includes('orbiBuildIdentity'), false);
});
