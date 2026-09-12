const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function extractModelBlock(source, id) {
    const token = `id: '${id}'`;
    const start = source.indexOf(token);
    assert.notEqual(start, -1, `missing model ${id}`);
    const next = source.indexOf("\n    {", start + token.length);
    return source.slice(start, next === -1 ? source.length : next);
}

function readNumber(block, field) {
    const match = block.match(new RegExp(`\\b${field}:\\s*([0-9.]+)`));
    assert.ok(match, `missing ${field}`);
    return Number(match[1]);
}

test('Z-Image certified weight sizes stay aligned across desktop and renderer catalogs', () => {
    const desktop = fs.readFileSync('electron/lib/modelCatalog.js', 'utf8');
    const renderer = fs.readFileSync('src/lib/localModels.js', 'utf8');

    const expected = {
        'z-image-turbo': { sizeBytes: 3864250304, sizeGB: 3.86 },
        'z-image-base': { sizeBytes: 5066995776, sizeGB: 5.07 },
    };

    for (const [id, values] of Object.entries(expected)) {
        const desktopBlock = extractModelBlock(desktop, id);
        const rendererBlock = extractModelBlock(renderer, id);

        assert.equal(readNumber(desktopBlock, 'sizeBytes'), values.sizeBytes);
        assert.equal(readNumber(rendererBlock, 'sizeBytes'), values.sizeBytes);
        assert.equal(readNumber(desktopBlock, 'sizeGB'), values.sizeGB);
        assert.equal(readNumber(rendererBlock, 'sizeGB'), values.sizeGB);
    }
});
