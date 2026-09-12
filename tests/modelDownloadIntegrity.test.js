const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    getIntegritySpecForCatalogEntry,
    verifyAndPromoteFile,
} = require('../electron/lib/modelDownloadIntegrity');
const {
    LOCAL_MODEL_CATALOG,
    ZIMAGE_AUXILIARY,
} = require('../electron/lib/modelCatalog');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-model-integrity-'));
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

test('every current sd.cpp catalog asset resolves to governed integrity metadata', () => {
    const entries = [
        ...LOCAL_MODEL_CATALOG,
        ZIMAGE_AUXILIARY.llm,
        ZIMAGE_AUXILIARY.vae,
    ];

    for (const entry of entries) {
        const spec = getIntegritySpecForCatalogEntry(entry);
        assert.equal(spec.localFilename, entry.filename);
        assert.equal(spec.expectedBytes, entry.sizeBytes);
        assert.equal(spec.sha256, entry.sha256);
    }
});

test('verified staged file is promoted only after exact size and SHA-256 match', async (t) => {
    const dir = tempDir();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const stagedPath = path.join(dir, 'asset.pending-verification');
    const destinationPath = path.join(dir, 'asset.bin');
    const payload = Buffer.from('ORBI verified model asset');
    fs.writeFileSync(stagedPath, payload);

    const result = await verifyAndPromoteFile({
        stagedPath,
        destinationPath,
        expectedBytes: payload.length,
        expectedSha256: sha256(payload),
    });

    assert.equal(result.ok, true);
    assert.equal(result.bytes, payload.length);
    assert.equal(result.sha256, sha256(payload));
    assert.equal(fs.existsSync(stagedPath), false);
    assert.equal(fs.readFileSync(destinationPath, 'utf8'), payload.toString('utf8'));
});

test('size mismatch fails closed and never creates the usable destination', async (t) => {
    const dir = tempDir();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const stagedPath = path.join(dir, 'asset.pending-verification');
    const destinationPath = path.join(dir, 'asset.bin');
    const payload = Buffer.from('wrong-size');
    fs.writeFileSync(stagedPath, payload);

    await assert.rejects(
        verifyAndPromoteFile({
            stagedPath,
            destinationPath,
            expectedBytes: payload.length + 1,
            expectedSha256: sha256(payload),
        }),
        (error) => error.code === 'MODEL_ASSET_SIZE_MISMATCH'
    );

    assert.equal(fs.existsSync(stagedPath), false);
    assert.equal(fs.existsSync(destinationPath), false);
});

test('SHA-256 mismatch fails closed and removes the complete unverified stage', async (t) => {
    const dir = tempDir();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const stagedPath = path.join(dir, 'asset.pending-verification');
    const destinationPath = path.join(dir, 'asset.bin');
    const payload = Buffer.from('tampered-model');
    fs.writeFileSync(stagedPath, payload);

    await assert.rejects(
        verifyAndPromoteFile({
            stagedPath,
            destinationPath,
            expectedBytes: payload.length,
            expectedSha256: sha256(Buffer.from('expected-model')),
        }),
        (error) => error.code === 'MODEL_ASSET_SHA256_MISMATCH'
    );

    assert.equal(fs.existsSync(stagedPath), false);
    assert.equal(fs.existsSync(destinationPath), false);
});

test('promotion refuses to overwrite an existing usable asset', async (t) => {
    const dir = tempDir();
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const stagedPath = path.join(dir, 'asset.pending-verification');
    const destinationPath = path.join(dir, 'asset.bin');
    const payload = Buffer.from('new-model');
    fs.writeFileSync(stagedPath, payload);
    fs.writeFileSync(destinationPath, 'existing-model');

    await assert.rejects(
        verifyAndPromoteFile({
            stagedPath,
            destinationPath,
            expectedBytes: payload.length,
            expectedSha256: sha256(payload),
        }),
        (error) => error.code === 'MODEL_ASSET_DESTINATION_EXISTS'
    );

    assert.equal(fs.existsSync(stagedPath), false);
    assert.equal(fs.readFileSync(destinationPath, 'utf8'), 'existing-model');
});
