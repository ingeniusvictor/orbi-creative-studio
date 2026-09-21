const test = require('node:test');
const assert = require('node:assert/strict');

test('P1C36 creates pending review entries without mutation authority', async () => {
    const {
        buildUpstreamAdoptionManifest,
        validateUpstreamAdoptionManifest,
    } = await import('../src/lib/upstreamAdoptionManifest.mjs');

    const manifest = buildUpstreamAdoptionManifest({
        upstream: { repository: 'Anil-matcha/Open-Generative-AI', branch: 'main' },
        observedAt: '2026-09-21T03:15:00Z',
        baselineSha: 'base',
        headSha: 'head',
        hasDrift: true,
        files: [
            {
                path: 'electron/main.js',
                classification: 'ORBI_OWNED',
                triageKind: 'ORBI_CONFLICT',
                triageAction: 'MANUAL_ADAPT',
            },
            {
                path: 'packages/studio/src/klingModels.js',
                classification: 'UPSTREAM_CANDIDATE',
                triageKind: 'NEW_MODEL',
                triageAction: 'CANDIDATE_REVIEW',
            },
            {
                path: 'src/components/ImageStudio.js',
                classification: 'SECURITY_REVIEW',
                triageKind: 'UI',
                triageAction: 'SECURITY_REVIEW',
            },
        ],
    });

    assert.equal(manifest.state, 'REVIEW_REQUIRED');
    assert.equal(manifest.automaticAdoptionAllowed, false);
    assert.equal(manifest.sourceMutationAllowed, false);
    assert.equal(manifest.baselineAdvanceEligible, false);
    assert.ok(manifest.entries.every((entry) => entry.decision === 'PENDING_REVIEW'));
    assert.ok(manifest.entries.every((entry) => entry.sourceMutationAllowed === false));

    assert.equal(manifest.entries[0].directAdoptionCandidate, false);
    assert.deepEqual(manifest.entries[0].requiredReviews, ['TECHNICAL']);

    assert.equal(manifest.entries[1].directAdoptionCandidate, true);
    assert.deepEqual(manifest.entries[1].requiredReviews, ['TECHNICAL', 'LICENSE', 'PRODUCT']);

    assert.equal(manifest.entries[2].directAdoptionCandidate, false);
    assert.deepEqual(manifest.entries[2].requiredReviews, ['TECHNICAL', 'SECURITY', 'PRODUCT']);

    assert.deepEqual(validateUpstreamAdoptionManifest(manifest), { valid: true, errors: [] });
});

test('P1C36 creates an empty NO_DRIFT manifest at an identical baseline', async () => {
    const {
        buildUpstreamAdoptionManifest,
        formatUpstreamAdoptionManifestMarkdown,
    } = await import('../src/lib/upstreamAdoptionManifest.mjs');

    const manifest = buildUpstreamAdoptionManifest({
        upstream: { repository: 'Anil-matcha/Open-Generative-AI', branch: 'main' },
        observedAt: '2026-09-21T03:15:00Z',
        baselineSha: 'same',
        headSha: 'same',
        hasDrift: false,
        files: [],
    });

    assert.equal(manifest.state, 'NO_DRIFT');
    assert.deepEqual(manifest.entries, []);

    const markdown = formatUpstreamAdoptionManifestMarkdown(manifest);
    assert.match(markdown, /State: \*\*NO_DRIFT\*\*/);
    assert.match(markdown, /No drift; no adoption entries were created/);
    assert.match(markdown, /Source mutation: \*\*FORBIDDEN\*\*/);
});

test('P1C36 validator rejects generated manifests that authorize mutation', async () => {
    const { validateUpstreamAdoptionManifest } = await import('../src/lib/upstreamAdoptionManifest.mjs');

    const result = validateUpstreamAdoptionManifest({
        automaticAdoptionAllowed: true,
        sourceMutationAllowed: true,
        baselineAdvanceEligible: true,
        headSha: 'head',
        entries: [{
            path: 'electron/main.js',
            upstreamHeadSha: 'head',
            authorityClass: 'ORBI_OWNED',
            decision: 'ADOPT',
            requiredReviews: [],
            directAdoptionCandidate: true,
            automaticAdoptionAllowed: true,
            sourceMutationAllowed: true,
            baselineAdvanceEligible: true,
        }],
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 6);
});
