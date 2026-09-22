const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('P1C51 local inference matches pinned sd.cpp CLI architecture detection', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    assert.equal(source.includes("args.push('--sd-version'"), false);
    assert.equal(source.includes("args.push('--flux'"), false);
    assert.ok(source.includes("'--diffusion-model'"));
});

test('P1C51 SDXL sampler uses the exact pinned sd.cpp identifier', () => {
    const catalog = require('../electron/lib/modelCatalog');
    const sdxl = catalog.LOCAL_MODEL_CATALOG.find((model) => model.id === 'stable-diffusion-xl-base');

    assert.ok(sdxl);
    assert.equal(sdxl.sampler, 'dpm++2m');
});

test('P1C51 does not retain the rejected legacy sampler spelling', () => {
    const source = fs.readFileSync('electron/lib/modelCatalog.js', 'utf8');
    assert.equal(source.includes('dpmpp2m'), false);
});
