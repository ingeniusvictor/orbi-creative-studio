const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/orbi-foundation-certification.yml', 'utf8');

test('P1C46 keeps canonical push certification and adds governed policy PR certification', () => {
    assert.match(workflow, /push:\n\s+branches:\n\s+- integration\/orbi-foundation/);
    assert.match(workflow, /pull_request:\n\s+paths:/);
    assert.match(workflow, /src\/lib\/upstreamDriftPolicy\.mjs/);
    assert.match(workflow, /\.github\/workflows\/orbi-foundation-certification\.yml/);
});

test('P1C46 preserves all three Foundation platform jobs', () => {
    for (const job of ['core-linux:', 'windows-desktop:', 'macos-package:']) {
        assert.ok(workflow.includes(job), `missing Foundation job: ${job}`);
    }

    assert.ok(workflow.includes('Docker HTTP runtime smoke'));
    assert.ok(workflow.includes('Linux desktop child-process smoke'));
    assert.ok(workflow.includes('Install launch and uninstall'));
    assert.ok(workflow.includes('Verify DMGs and hashes'));
});

test('P1C46 keeps Foundation certification read-only at repository permission level', () => {
    assert.match(workflow, /permissions:\n\s+contents: read/);
    assert.equal(workflow.includes('contents: write'), false);
    assert.equal(workflow.includes('pull-requests: write'), false);
});
