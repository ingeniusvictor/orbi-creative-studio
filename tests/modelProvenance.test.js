const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOCAL_MODEL_CATALOG, ZIMAGE_AUXILIARY } = require('../electron/lib/modelCatalog');
const provenance = require('../electron/lib/modelProvenance.json');

const HASH_RE = /^[a-f0-9]{64}$/;
const COMMERCIAL = new Set(['unreviewed', 'allowed', 'blocked']);
const REDISTRIBUTION = new Set(['unreviewed', 'allowed', 'blocked']);

function byId(id) {
    return provenance.assets.find((asset) => asset.id === id);
}

function expectedSourceFragment(asset) {
    return `huggingface.co/${asset.source.repo}/resolve/main/${asset.source.path}`;
}

function rendererBlock(source, id) {
    const token = `id: '${id}'`;
    const start = source.indexOf(token);
    assert.notEqual(start, -1, `renderer catalog missing ${id}`);
    const next = source.indexOf('\n    {', start + token.length);
    return source.slice(start, next === -1 ? source.length : next);
}

test('provenance manifest has unique, fully verified asset identities', () => {
    assert.equal(provenance.schemaVersion, 1);
    assert.ok(Array.isArray(provenance.assets));
    assert.ok(provenance.assets.length >= 8);

    const ids = provenance.assets.map((asset) => asset.id);
    assert.equal(new Set(ids).size, ids.length, 'provenance IDs must be unique');

    for (const asset of provenance.assets) {
        assert.ok(asset.id);
        assert.ok(['model', 'text-encoder', 'vae'].includes(asset.role));
        assert.equal(asset.runtime, 'stable-diffusion.cpp');
        assert.ok(asset.source?.repo);
        assert.ok(asset.source?.revision);
        assert.ok(asset.source?.path);
        assert.ok(Number.isSafeInteger(asset.expectedBytes) && asset.expectedBytes > 0);
        assert.match(asset.sha256, HASH_RE);
        assert.ok(asset.license?.declared);
        assert.ok(asset.license?.reviewStatus);
        assert.ok(COMMERCIAL.has(asset.commercialUse));
        assert.ok(REDISTRIBUTION.has(asset.redistribution));
        assert.equal(asset.minimumTestedRamMiB, null);
        assert.equal(asset.minimumTestedVramMiB, null);
    }
});

test('every desktop sd.cpp model is governed by matching provenance', () => {
    for (const model of LOCAL_MODEL_CATALOG) {
        const asset = byId(model.id);
        assert.ok(asset, `missing provenance for ${model.id}`);
        assert.equal(asset.role, 'model');
        assert.equal(asset.localFilename, model.filename);
        assert.equal(asset.expectedBytes, model.sizeBytes);
        assert.equal(asset.sha256, model.sha256);
        assert.ok(model.downloadUrl.includes(expectedSourceFragment(asset)));
    }
});

test('Z-Image auxiliary files are governed by exact provenance', () => {
    const mappings = [
        ['llm', 'z-image-text-encoder'],
        ['vae', 'z-image-vae'],
    ];

    for (const [catalogKey, assetId] of mappings) {
        const item = ZIMAGE_AUXILIARY[catalogKey];
        const asset = byId(assetId);
        assert.ok(asset, `missing provenance for ${assetId}`);
        assert.equal(item.filename, asset.localFilename);
        assert.equal(item.sizeBytes, asset.expectedBytes);
        assert.equal(item.sha256, asset.sha256);
        assert.ok(item.downloadUrl.includes(expectedSourceFragment(asset)));
    }
});

test('renderer catalog mirrors governed model hash and exact byte size', () => {
    const source = fs.readFileSync('src/lib/localModels.js', 'utf8');

    for (const model of LOCAL_MODEL_CATALOG) {
        const block = rendererBlock(source, model.id);
        assert.ok(block.includes(`sizeBytes: ${model.sizeBytes}`), `${model.id} sizeBytes drifted`);
        assert.ok(block.includes(`sha256: '${model.sha256}'`), `${model.id} sha256 drifted`);
    }
});

test('DreamShaper remains blocked for redistribution pending license clarification', () => {
    const dreamshaper = byId('dreamshaper-8');
    assert.equal(dreamshaper.license.declared, 'other');
    assert.equal(dreamshaper.license.reviewStatus, 'clarification-required');
    assert.equal(dreamshaper.redistribution, 'blocked');
    assert.equal(dreamshaper.distributionGate, 'blocked-pending-license-clarification');
});

test('manifest never turns a declared upstream license into an implicit legal approval', () => {
    for (const asset of provenance.assets) {
        if (asset.id === 'dreamshaper-8') continue;
        assert.equal(asset.commercialUse, 'unreviewed');
        assert.equal(asset.redistribution, 'unreviewed');
    }
});
