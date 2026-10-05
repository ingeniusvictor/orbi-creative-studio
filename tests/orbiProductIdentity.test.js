const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

const identity = JSON.parse(read('shared/productIdentity.json'));
const pkg = JSON.parse(read('package.json'));

test('Phase 2B defines one canonical ORBI Creative Studio identity', () => {
    assert.equal(identity.name, 'ORBI Creative Studio');
    assert.equal(identity.shortName, 'ORBI Studio');
    assert.equal(identity.brand, 'ORBI');
    assert.equal(identity.surfaceLabel, 'CREATIVE STUDIO');
    assert.equal(identity.repository, 'https://github.com/ingeniusvictor/orbi-creative-studio');
    assert.equal(identity.upstreamProject, 'Open Generative AI');
});

test('Phase 2B applies ORBI identity to Electron and desktop header', () => {
    const main = read('electron/main.js');
    const header = read('src/components/Header.js');

    assert.ok(main.includes("const productIdentity = require('../shared/productIdentity.json')"));
    assert.ok(main.includes('title: productIdentity.name'));
    assert.ok(main.includes('`${productIdentity.name} — Unexpected Error`'));
    assert.equal(main.includes("title: 'Open Generative AI'"), false);
    assert.equal(main.includes('Open Generative AI started'), false);

    assert.ok(header.includes("import productIdentity from '../../shared/productIdentity.json'"));
    assert.ok(header.includes('${productIdentity.brand}'));
    assert.ok(header.includes('${productIdentity.surfaceLabel}'));
    assert.ok(header.includes("logoContainer.onclick = () => {"));
    assert.ok(header.includes("navigate('image')"));
});

test('Phase 2B applies ORBI identity to Vite and Next metadata', () => {
    const vite = read('index.html');
    const nextLayout = read('app/layout.js');
    const studio = read('app/studio/[[...slug]]/page.js');
    const workflow = read('app/workflow/[id]/page.js');
    const agents = read('app/agents/layout.js');
    const zhStudio = read('app/zh/studio/[[...slug]]/page.js');

    assert.ok(vite.includes('<title>ORBI Creative Studio — Cloud + Local AI Creation</title>'));
    assert.ok(vite.includes('ORBI Creative Studio brings image, video, cinema and lip-sync creation together'));
    assert.equal(vite.includes('vite.svg'), false);
    assert.equal(vite.includes('Open Generative AI'), false);

    for (const source of [nextLayout, studio, workflow, agents, zhStudio]) {
        assert.ok(source.includes('ORBI Creative Studio'));
        assert.equal(source.includes('Open Generative AI'), false);
    }
});

test('Phase 2B updates package narrative but freezes storage-sensitive legacy identifiers', () => {
    assert.ok(pkg.description.startsWith('ORBI Creative Studio'));
    assert.equal(pkg.homepage, 'https://github.com/ingeniusvictor/orbi-creative-studio');

    // Intentional compatibility lock: do not change these until user-data migration is proven.
    assert.equal(pkg.name, 'open-generative-ai');
    assert.equal(pkg.build.productName, 'Open Generative AI');
    assert.equal(pkg.build.appId, 'ai.generative.open');

    const localInference = read('electron/lib/localInference.js');
    const credentials = read('electron/lib/providerCredentials.js');
    assert.ok(localInference.includes("app.getPath('userData')"));
    assert.ok(credentials.includes("app.getPath('userData')"));
});

test('Phase 2B preserves explicit upstream attribution and Phase 1C lock', () => {
    const license = read('LICENSE');
    const phase2b = read('docs/PHASE-2B-ORBI-IDENTITY-FOUNDATION.md');
    const master = read('ORBI-CREATIVE-STUDIO-MASTER-STATUS.md');

    assert.ok(license.includes('MIT License'));
    assert.ok(phase2b.includes('Open Generative AI'));
    assert.ok(phase2b.includes('upstream project reference'));
    assert.ok(master.includes('P1C70 — Phase 1C Final Lock'));
    assert.ok(master.includes('There is no P1C71 continuation'));
    assert.ok(master.includes('Do not create `P1C71`, `P1C72`'));
});
