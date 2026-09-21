const test = require('node:test');
const assert = require('node:assert/strict');

test('P1C33 builds a conservative classified drift report', async () => {
    const {
        buildUpstreamDriftReport,
    } = await import('../src/lib/upstreamDriftReport.mjs');

    const report = buildUpstreamDriftReport({
        status: 'ahead',
        ahead_by: 2,
        behind_by: 0,
        total_commits: 2,
        head_commit: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        files: [
            { filename: 'electron/main.js', status: 'modified', additions: 4, deletions: 1, changes: 5 },
            { filename: 'src/components/ImageStudio.js', status: 'modified', additions: 6, deletions: 2, changes: 8 },
            { filename: 'packages/studio/src/klingModels.js', status: 'modified', additions: 8, deletions: 0, changes: 8 },
            { filename: 'README.md', status: 'modified', additions: 2, deletions: 2, changes: 4 },
        ],
    }, { observedAt: '2026-09-20T00:00:00.000Z' });

    assert.equal(report.hasDrift, true);
    assert.equal(report.aheadBy, 2);
    assert.equal(report.changedFiles, 4);
    assert.equal(report.directReplacementAllowed, false);
    assert.deepEqual(report.classifications, {
        ORBI_OWNED: 1,
        SECURITY_REVIEW: 1,
        UPSTREAM_CANDIDATE: 1,
        REVIEW: 1,
    });

    assert.equal(report.files[0].classification, 'ORBI_OWNED');
    assert.equal(report.files[1].classification, 'SECURITY_REVIEW');
    assert.equal(report.files[2].classification, 'UPSTREAM_CANDIDATE');
    assert.equal(report.files[3].classification, 'REVIEW');
    assert.ok(report.files.every((file) => file.directReplacementAllowed === false));
});

test('P1C33 reports a clean baseline when upstream is identical', async () => {
    const policy = await import('../src/lib/upstreamDriftPolicy.mjs');
    const { buildUpstreamDriftReport } = await import('../src/lib/upstreamDriftReport.mjs');

    const report = buildUpstreamDriftReport({
        status: 'identical',
        ahead_by: 0,
        behind_by: 0,
        total_commits: 0,
        head_commit: { sha: policy.OPEN_GENERATIVE_AI_UPSTREAM.baselineSha },
        files: [],
    }, { observedAt: '2026-09-20T00:00:00.000Z' });

    assert.equal(report.hasDrift, false);
    assert.equal(report.changedFiles, 0);
    assert.deepEqual(report.classifications, {});
});

test('P1C33 markdown makes authority and changed paths explicit', async () => {
    const {
        buildUpstreamDriftReport,
        formatUpstreamDriftMarkdown,
    } = await import('../src/lib/upstreamDriftReport.mjs');

    const report = buildUpstreamDriftReport({
        status: 'ahead',
        ahead_by: 1,
        head_commit: { sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        files: [
            { filename: 'electron/preload.js', status: 'modified', additions: 1, deletions: 0, changes: 1 },
        ],
    }, { observedAt: '2026-09-20T00:00:00.000Z' });

    const markdown = formatUpstreamDriftMarkdown(report);
    assert.match(markdown, /Drift detected: \*\*YES\*\*/);
    assert.match(markdown, /Direct replacement: \*\*FORBIDDEN\*\*/);
    assert.match(markdown, /ORBI_OWNED/);
    assert.match(markdown, /electron\/preload\.js/);
});
