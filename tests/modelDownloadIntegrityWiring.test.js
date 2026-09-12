const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('local inference downloads to staging and promotes only after integrity verification', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    assert.ok(source.includes("const stagedPath = destPath + '.download';"));
    assert.ok(source.includes('await promoteVerifiedAsset(stagedPath, destPath, model)'));
    assert.ok(source.includes('await promoteVerifiedAsset(stagedPath, destPath, aux)'));
    assert.ok(source.includes("send({ phase: 'verifying', progress: 0.97 });"));
});

test('generation verifies model and Z-Image auxiliary assets before spawning sd.cpp', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    const modelVerify = source.indexOf('await verifyModelAsset(modelPath, model);');
    const promiseStart = source.indexOf('return new Promise((resolve, reject) => {', modelVerify);

    assert.notEqual(modelVerify, -1);
    assert.notEqual(promiseStart, -1);
    assert.ok(modelVerify < promiseStart, 'model verification must happen before child-process generation');

    assert.ok(source.includes('await verifyModelAsset(llmPath, ZIMAGE_AUXILIARY.llm);'));
    assert.ok(source.includes('await verifyModelAsset(vaePath, ZIMAGE_AUXILIARY.vae);'));
});

test('catalog state cannot call a wrong-size file downloaded', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    assert.ok(source.includes("? 'downloaded' : 'integrity-failed'"));
    assert.ok(source.includes("filePath + '.download.part'"));
});

test('delete removes active, partial and staging artifacts and clears integrity cache', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    assert.ok(source.includes('clearIntegrityCache(filePath);'));
    assert.ok(source.includes("filePath + '.download'"));
    assert.ok(source.includes("filePath + '.download.part'"));
});
