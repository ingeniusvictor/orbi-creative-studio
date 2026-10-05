const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const header = fs.readFileSync('src/components/Header.js', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');

function extractPrimaryPages(source) {
    const match = source.match(/const primaryDesktopItems = \[([\s\S]*?)\n    \];/);
    assert.ok(match, 'Header must define an explicit primaryDesktopItems capability list');
    return [...match[1].matchAll(/page:\s*'([^']+)'/g)].map((entry) => entry[1]);
}

test('Phase 2C desktop primary navigation exposes only implemented creative surfaces', () => {
    assert.deepEqual(extractPrimaryPages(header), [
        'image',
        'video',
        'cinema',
        'lipsync',
    ]);

    for (const deferred of ['workflows', 'agents', 'mcp-cli', 'audio', 'scene3d']) {
        assert.equal(
            extractPrimaryPages(header).includes(deferred),
            false,
            `${deferred} must not be advertised as a primary Electron creative surface`,
        );
    }
});

test('Phase 2C keeps deferred desktop routes in code for future governed convergence', () => {
    assert.ok(main.includes("page === 'workflows'"), 'workflow route must remain available internally');
    assert.ok(main.includes("page === 'agents'"), 'agent route must remain available internally');
    assert.ok(main.includes("page === 'mcp-cli'"), 'MCP/CLI route must remain available internally');

    assert.ok(main.includes("import('./components/WorkflowStudio.js')"));
    assert.ok(main.includes("import('./components/AgentStudio.js')"));
    assert.ok(main.includes("import('./components/McpCliStudio.js')"));
});

test('Phase 2C navigation has a truthful moving active indicator', () => {
    assert.ok(header.includes("const setActivePage = (activePage) =>"));
    assert.ok(header.includes("dot.style.opacity = active ? '1' : '0'"));
    assert.ok(header.includes("link.setAttribute('aria-current', active ? 'page' : 'false')"));
    assert.ok(header.includes("menu.setAttribute('aria-label', 'Desktop creative tools')"));
});

test('Phase 2C does not expose engineering diagnostics in primary navigation', () => {
    const primaryBlock = header.match(/const primaryDesktopItems = \[([\s\S]*?)\n    \];/)?.[1] || '';
    assert.equal(primaryBlock.includes('Router Diagnostics'), false);
    assert.equal(primaryBlock.includes('Local Models'), false);
    assert.equal(primaryBlock.includes('Settings'), false);
});
