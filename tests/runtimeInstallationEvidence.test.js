const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    RUNTIME_INSTALLATION_EVIDENCE_FILE,
    inspectPinnedRuntimeInstallation,
    recordPinnedRuntimeInstallation,
} = require('../electron/lib/runtimeInstallationEvidence');

const RUNTIME = Object.freeze({
    backend: 'cpu',
    release: 'test-release',
    upstreamCommit: 'a'.repeat(40),
    assetName: 'runtime.zip',
    sha256: 'b'.repeat(64),
});

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-runtime-evidence-'));
    const binDir = path.join(root, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const binaryPath = path.join(binDir, process.platform === 'win32' ? 'sd-cli.exe' : 'sd-cli');
    fs.writeFileSync(binaryPath, 'PINNED_RUNTIME_BINARY');
    return { root, binDir, binaryPath };
}

test('verified pinned archive installation records and re-verifies current binary integrity', async (t) => {
    const f = fixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const receipt = await recordPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
        archiveSha256: RUNTIME.sha256,
        now: () => 1_000_000,
    });

    assert.equal(receipt.source, 'pinned-archive');
    assert.equal(receipt.archiveSha256, RUNTIME.sha256);
    assert.equal(receipt.authenticityVerified, false);
    assert.match(receipt.binarySha256, /^[a-f0-9]{64}$/);

    const inspected = await inspectPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
    });

    assert.equal(inspected.integrityVerified, true);
    assert.equal(inspected.authenticityVerified, false);
    assert.equal(inspected.archiveManifestMatch, true);
    assert.equal(inspected.binaryReceiptMatch, true);
    assert.equal(inspected.tamperResistance, 'local-receipt-not-tamper-proof');
});

test('archive must already match pinned manifest before receipt can be created', async (t) => {
    const f = fixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    await assert.rejects(
        recordPinnedRuntimeInstallation({
            binDir: f.binDir,
            binaryPath: f.binaryPath,
            runtime: RUNTIME,
            archiveSha256: 'c'.repeat(64),
        }),
        /does not match pinned runtime manifest/,
    );
    assert.equal(fs.existsSync(path.join(f.binDir, RUNTIME_INSTALLATION_EVIDENCE_FILE)), false);
});

test('changed binary fails closed after installation receipt was created', async (t) => {
    const f = fixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    await recordPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
        archiveSha256: RUNTIME.sha256,
    });
    fs.writeFileSync(f.binaryPath, 'MUTATED_RUNTIME_BINARY');

    const inspected = await inspectPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
    });

    assert.equal(inspected.integrityVerified, false);
    assert.equal(inspected.reason, 'RUNTIME_BINARY_CHANGED_AFTER_INSTALL');
});

test('receipt bound to a different manifest fails closed', async (t) => {
    const f = fixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    await recordPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
        archiveSha256: RUNTIME.sha256,
    });

    const inspected = await inspectPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: { ...RUNTIME, release: 'different-release' },
    });

    assert.equal(inspected.integrityVerified, false);
    assert.equal(inspected.reason, 'INSTALLATION_RECEIPT_MANIFEST_MISMATCH');
});

test('manual or bundled runtime without receipt remains unverified', async (t) => {
    const f = fixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    const inspected = await inspectPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
    });

    assert.equal(inspected.integrityVerified, false);
    assert.equal(inspected.authenticityVerified, false);
    assert.equal(inspected.reason, 'INSTALLATION_RECEIPT_MISSING');
});

test('receipt never stores absolute local paths', async (t) => {
    const f = fixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));

    await recordPinnedRuntimeInstallation({
        binDir: f.binDir,
        binaryPath: f.binaryPath,
        runtime: RUNTIME,
        archiveSha256: RUNTIME.sha256,
    });

    const raw = fs.readFileSync(path.join(f.binDir, RUNTIME_INSTALLATION_EVIDENCE_FILE), 'utf8');
    assert.equal(raw.includes(f.root), false);
    assert.equal(raw.includes(f.binaryPath), false);
});

test('local inference binds receipt creation after pinned archive verification', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');
    const archiveVerification = source.indexOf('await verifyFileSha256(zipPath, runtime.sha256)');
    const receiptCreation = source.indexOf('await recordPinnedRuntimeInstallation({');
    const receiptInspection = source.indexOf('await inspectPinnedRuntimeInstallation({', receiptCreation);

    assert.ok(archiveVerification >= 0);
    assert.ok(receiptCreation > archiveVerification);
    assert.ok(receiptInspection > receiptCreation);
    assert.ok(source.includes('installationIntegrityVerified: true'));
});

test('readiness exports only sanitized installation integrity facts', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');
    const snapshotSource = fs.readFileSync('electron/lib/providerReadinessSnapshotCore.js', 'utf8');

    assert.ok(source.includes('installationIntegrityVerified: binaryStatus.installationIntegrity?.integrityVerified === true'));
    assert.ok(snapshotSource.includes('installationIntegrityVerified: evidence.binaryStatus.runtime.installationIntegrityVerified === true'));
    assert.equal(snapshotSource.includes('binarySha256'), false);
    assert.equal(snapshotSource.includes('archiveSha256'), false);
});
