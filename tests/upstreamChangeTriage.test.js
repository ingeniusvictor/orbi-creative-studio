const test = require('node:test');
const assert = require('node:assert/strict');

test('P1C35 preserves authority while adding semantic triage', async () => {
    const {
        buildUpstreamTriageReport,
    } = await import('../src/lib/upstreamChangeTriage.mjs');

    const report = buildUpstreamTriageReport({
        upstream: { repository: 'Anil-matcha/Open-Generative-AI', branch: 'main' },
        observedAt: '2026-09-21T03:00:00Z',
        baselineSha: 'base',
        headSha: 'head',
        hasDrift: true,
        files: [
            { path: 'electron/main.js', classification: 'ORBI_OWNED' },
            { path: 'src/components/ImageStudio.js', classification: 'SECURITY_REVIEW' },
            { path: 'packages/studio/src/klingModels.js', classification: 'UPSTREAM_CANDIDATE' },
            { path: 'README.md', classification: 'REVIEW' },
        ],
    }, [
        { sha: '1', message: 'fix: avoid replay regression', date: '2026-09-20T01:00:00Z' },
        { sha: '2', message: 'feat: add Kling model support', date: '2026-09-20T02:00:00Z' },
    ]);

    assert.equal(report.automaticAdoptionAllowed, false);
    assert.equal(report.files[0].triageKind, 'ORBI_CONFLICT');
    assert.equal(report.files[0].triageAction, 'MANUAL_ADAPT');
    assert.equal(report.files[1].triageKind, 'UI');
    assert.equal(report.files[1].triageAction, 'SECURITY_REVIEW');
    assert.equal(report.files[2].triageKind, 'NEW_MODEL');
    assert.equal(report.files[2].triageAction, 'CANDIDATE_REVIEW');
    assert.equal(report.files[3].triageKind, 'DOCUMENTATION');
    assert.equal(report.files[3].triageAction, 'REVIEW_ONLY');
    assert.ok(report.files.every((file) => file.automaticAdoptionAllowed === false));

    assert.equal(report.commits[0].kind, 'BUGFIX');
    assert.equal(report.commits[1].kind, 'NEW_MODEL');
});

test('P1C35 security commit semantics outrank generic bugfix semantics', async () => {
    const { classifyUpstreamCommitTriage } = await import('../src/lib/upstreamChangeTriage.mjs');

    const result = classifyUpstreamCommitTriage({
        sha: 'abc',
        message: 'fix(security): sanitize XSS history rendering',
        date: '2026-09-20T03:00:00Z',
    });

    assert.equal(result.kind, 'SECURITY');
});

test('P1C35 formats an empty drift triage without inventing candidates', async () => {
    const {
        buildUpstreamTriageReport,
        formatUpstreamTriageMarkdown,
    } = await import('../src/lib/upstreamChangeTriage.mjs');

    const report = buildUpstreamTriageReport({
        upstream: { repository: 'Anil-matcha/Open-Generative-AI', branch: 'main' },
        observedAt: '2026-09-21T03:00:00Z',
        baselineSha: 'same',
        headSha: 'same',
        hasDrift: false,
        files: [],
    }, []);

    const markdown = formatUpstreamTriageMarkdown(report);
    assert.match(markdown, /Drift detected: \*\*NO\*\*/);
    assert.match(markdown, /Automatic adoption: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /No changed paths to triage/);
    assert.match(markdown, /No upstream commits beyond the reviewed baseline/);
});
