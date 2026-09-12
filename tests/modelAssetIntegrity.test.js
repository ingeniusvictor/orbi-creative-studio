const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
    clearIntegrityCache,
    getFileSizeState,
    promoteVerifiedAsset,
    verifyModelAsset,
} = require('../electron/lib/modelAssetIntegrity');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-model-integrity-'));
}

function metadata(bytes) {
    return {
        id: 'fixture-model',
        filename: 'fixture.bin',
        sizeBytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    };
}

test('size state rejects same-path assets with wrong byte count', () => {
    const dir = tempDir();
    const file = path.join(dir, 'fixture.bin');
    fs.writeFileSync(file, Buffer.from('abc'));

    const state = getFileSizeState(file, {
        sizeBytes: 4,
        sha256: '0'.repeat(64),
    });

    assert.equal(state.exists, true);
    assert.equal(state.sizeMatches, false);
    assert.equal(state.size, 3);
});

test('verifyModelAsset checks exact size before hashing', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'fixture.bin');
    fs.writeFileSync(file, Buffer.from('abc'));

    let hashCalls = 0;
    await assert.rejects(
        verifyModelAsset(file, {
            id: 'fixture',
            sizeBytes: 4,
            sha256: '0'.repeat(64),
        }, {
            verifyFileSha256Impl: async () => {
                hashCalls += 1;
                return { ok: true };
            },
        }),
        (error) => error.code === 'MODEL_ASSET_SIZE_MISMATCH',
    );

    assert.equal(hashCalls, 0);
});

test('verifyModelAsset rejects a same-size file with the wrong SHA-256', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'fixture.bin');
    const bytes = Buffer.from('correct');
    const asset = metadata(bytes);
    fs.writeFileSync(file, Buffer.from('WRONG!!'));

    await assert.rejects(
        verifyModelAsset(file, asset),
        (error) => error.code === 'MODEL_ASSET_HASH_MISMATCH',
    );
});

test('successful verification is cached for unchanged file metadata during the session', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'fixture.bin');
    const bytes = Buffer.from('verified-content');
    const asset = metadata(bytes);
    fs.writeFileSync(file, bytes);

    let hashCalls = 0;
    const verifyFileSha256Impl = async (_filePath, expected) => {
        hashCalls += 1;
        return { ok: true, expected, actual: expected };
    };

    const first = await verifyModelAsset(file, asset, { verifyFileSha256Impl });
    const second = await verifyModelAsset(file, asset, { verifyFileSha256Impl });

    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(hashCalls, 1);

    clearIntegrityCache(file);
});

test('promoteVerifiedAsset verifies staging before atomically promoting it', async () => {
    const dir = tempDir();
    const staged = path.join(dir, 'model.staged');
    const final = path.join(dir, 'model.gguf');
    const bytes = Buffer.from('good-model');
    const asset = metadata(bytes);
    fs.writeFileSync(staged, bytes);

    const result = await promoteVerifiedAsset(staged, final, asset);

    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(staged), false);
    assert.equal(fs.readFileSync(final).toString(), 'good-model');
});

test('failed staging verification deletes staging and never creates final asset', async () => {
    const dir = tempDir();
    const staged = path.join(dir, 'model.staged');
    const final = path.join(dir, 'model.gguf');
    const good = Buffer.from('good-model');
    const asset = metadata(good);
    fs.writeFileSync(staged, Buffer.from('bad-model!'));

    await assert.rejects(
        promoteVerifiedAsset(staged, final, asset),
        (error) => error.code === 'MODEL_ASSET_HASH_MISMATCH',
    );

    assert.equal(fs.existsSync(staged), false);
    assert.equal(fs.existsSync(final), false);
});
