const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const HISTORICAL_PHASE_WORKFLOWS = [
    '.github/workflows/orbi-cutover-eligibility-p1b14.yml',
    '.github/workflows/orbi-cutover-review-report-p1b15.yml',
    '.github/workflows/orbi-release-evidence-manifest-p1b16.yml',
    '.github/workflows/orbi-parity-build-binding-p1b17.yml',
];

test('historical P1B.14-P1B.17 workflows do not fan out on canonical pull requests', () => {
    for (const workflow of HISTORICAL_PHASE_WORKFLOWS) {
        const source = fs.readFileSync(workflow, 'utf8');
        assert.equal(
            source.includes('\n  pull_request:'),
            false,
            `${workflow} must remain push/manual only`,
        );
        assert.ok(source.includes('\n  push:'), `${workflow} must retain its phase push trigger`);
        assert.ok(source.includes('\n  workflow_dispatch:'), `${workflow} must remain manually runnable`);
    }
});

test('the integrated gate remains the canonical pull-request validator', () => {
    const source = fs.readFileSync('.github/workflows/orbi-pr-integrated-gate.yml', 'utf8');
    assert.ok(source.includes('\n  pull_request:'), 'integrated PR gate must retain pull_request trigger');
    assert.ok(source.includes('      - integration/orbi-foundation'), 'integrated PR gate must target canonical branch');
    assert.ok(source.includes('cancel-in-progress: true'), 'integrated PR gate must cancel superseded runs');
});
