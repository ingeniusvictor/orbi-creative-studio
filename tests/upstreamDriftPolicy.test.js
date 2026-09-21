const test = require('node:test');
const assert = require('node:assert/strict');

test('P1C32 pins the reviewed Open-Generative-AI upstream baseline', async () => {
    const policy = await import('../src/lib/upstreamDriftPolicy.mjs');

    assert.equal(policy.OPEN_GENERATIVE_AI_UPSTREAM.repository, 'Anil-matcha/Open-Generative-AI');
    assert.equal(policy.OPEN_GENERATIVE_AI_UPSTREAM.branch, 'main');
    assert.equal(policy.OPEN_GENERATIVE_AI_UPSTREAM.baselineSha, '69b7fccaa946161473c765facebdb7c5f3f74d5d');
    assert.equal(policy.OPEN_GENERATIVE_AI_UPSTREAM.license, 'MIT');
});

test('P1C32 classifies ORBI authority boundaries conservatively', async () => {
    const policy = await import('../src/lib/upstreamDriftPolicy.mjs');
    const C = policy.UPSTREAM_INTAKE_CLASS;

    assert.equal(policy.classifyUpstreamPath('electron/main.js'), C.ORBI_OWNED);
    assert.equal(policy.classifyUpstreamPath('electron/lib/localInference.js'), C.ORBI_OWNED);
    assert.equal(policy.classifyUpstreamPath('src/lib/computeRouter/contracts.mjs'), C.ORBI_OWNED);
    assert.equal(policy.classifyUpstreamPath('.github/workflows/orbi-integrated-pr-gate.yml'), C.ORBI_OWNED);
    assert.equal(policy.classifyUpstreamPath('src/components/RouterDiagnosticsPanel.js'), C.ORBI_OWNED);

    assert.equal(policy.classifyUpstreamPath('src/components/ImageStudio.js'), C.SECURITY_REVIEW);
    assert.equal(policy.classifyUpstreamPath('packages/studio/src/components/ImageStudio.jsx'), C.SECURITY_REVIEW);
    assert.equal(policy.classifyUpstreamPath('app/api/v1/upload-binary/route.js'), C.SECURITY_REVIEW);
    assert.equal(policy.classifyUpstreamPath('src/lib/muapi.js'), C.SECURITY_REVIEW);

    assert.equal(policy.classifyUpstreamPath('packages/studio/src/klingModels.js'), C.UPSTREAM_CANDIDATE);
    assert.equal(policy.classifyUpstreamPath('packages/studio/src/groupedVideoRegistry.js'), C.UPSTREAM_CANDIDATE);
    assert.equal(policy.classifyUpstreamPath('packages/studio/src/messages/en/imageStudio.json'), C.UPSTREAM_CANDIDATE);

    assert.equal(policy.classifyUpstreamPath('README.md'), C.REVIEW);
    assert.equal(policy.directUpstreamReplacementAllowed('packages/studio/src/klingModels.js'), false);
    assert.equal(policy.directUpstreamReplacementAllowed('README.md'), false);
});

test('P1C32 normalizes Windows-style repository paths before classification', async () => {
    const policy = await import('../src/lib/upstreamDriftPolicy.mjs');
    assert.equal(
        policy.classifyUpstreamPath('electron\\lib\\modelCatalog.js'),
        policy.UPSTREAM_INTAKE_CLASS.ORBI_OWNED,
    );
});
