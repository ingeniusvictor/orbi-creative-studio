const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PHASES = Array.from({ length: 17 }, (_, index) => 32 + index);

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function listFiles(dir, predicate) {
    return fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return listFiles(full, predicate);
            return predicate(full) ? [full.replace(/\\/g, '/')] : [];
        });
}

test('P1C49 confirms the documented upstream-governance chain is contiguous from P1C32 through P1C48', () => {
    const docs = fs.readdirSync('docs');
    for (const phase of PHASES) {
        const prefix = `PHASE-1C${phase}-`;
        assert.ok(
            docs.some((name) => name.startsWith(prefix) && name.endsWith('.md')),
            `missing governance documentation for P1C${phase}`,
        );
    }
});

test('P1C49 forbids authority-escalating true flags across upstream governance modules', () => {
    const modules = listFiles(
        'src/lib',
        (file) => /\/upstream.*\.mjs$/i.test(file),
    );

    assert.ok(modules.length >= 10, 'expected the upstream governance module family');

    const forbiddenTrue = /\b(?:directReplacementAllowed|sourceMutationAllowed|policyMutationAllowed|policyPrCreationAllowed|automaticMergeAllowed|mergeExecutionAllowed|mergeAllowed)\s*:\s*true\b/g;

    const violations = [];
    for (const file of modules) {
        const source = read(file);
        const matches = [...source.matchAll(forbiddenTrue)];
        for (const match of matches) {
            violations.push(`${file}: ${match[0]}`);
        }
    }

    assert.deepEqual(
        violations,
        [],
        `governance authority escalation detected:\n${violations.join('\n')}`,
    );
});

test('P1C49 confirms direct upstream replacement remains globally disabled', async () => {
    const policy = await import('../src/lib/upstreamDriftPolicy.mjs');

    for (const sample of [
        'electron/main.js',
        'src/components/ImageStudio.js',
        'packages/studio/src/klingModels.js',
        'README.md',
    ]) {
        assert.equal(
            policy.directUpstreamReplacementAllowed(sample),
            false,
            `direct upstream replacement unexpectedly enabled for ${sample}`,
        );
    }
});

test('P1C49 confirms governance workflows keep repository permissions read-only', () => {
    const workflowFiles = fs.readdirSync('.github/workflows')
        .filter((name) => /^orbi-upstream-.*\.yml$/.test(name));

    assert.ok(workflowFiles.length >= 8, 'expected upstream governance workflows');

    const violations = [];
    for (const name of workflowFiles) {
        const source = read(`.github/workflows/${name}`);
        if (!/permissions:\s*\n\s+contents:\s*read\b/.test(source)) {
            violations.push(`${name}: missing contents: read permission boundary`);
        }
        if (/\bcontents:\s*write\b/.test(source)) {
            violations.push(`${name}: contents write permission`);
        }
        if (/\bpull-requests:\s*write\b/.test(source)) {
            violations.push(`${name}: pull-request write permission`);
        }
        if (/\bactions:\s*write\b/.test(source)) {
            violations.push(`${name}: actions write permission`);
        }
    }

    assert.deepEqual(violations, []);
});

test('P1C49 confirms Foundation can certify policy PRs pre-merge without write authority', () => {
    const foundation = read('.github/workflows/orbi-foundation-certification.yml');

    assert.match(foundation, /pull_request:\s*\n\s+paths:/);
    assert.match(foundation, /src\/lib\/upstreamDriftPolicy\.mjs/);
    assert.match(foundation, /permissions:\s*\n\s+contents:\s*read\b/);
    assert.equal(/\bcontents:\s*write\b/.test(foundation), false);

    for (const job of ['core-linux:', 'windows-desktop:', 'macos-package:']) {
        assert.ok(foundation.includes(job), `missing Foundation certification job ${job}`);
    }
});

test('P1C49 confirms final decision validation does not execute repository merge', () => {
    const decision = read('src/lib/upstreamPolicyMergeDecision.mjs');
    const evidence = read('src/lib/upstreamPolicyMergeEvidence.mjs');
    const request = read('src/lib/upstreamPolicyPrRequest.mjs');

    for (const [name, source] of [
        ['P1C44 request', request],
        ['P1C47 evidence', evidence],
        ['P1C48 decision', decision],
    ]) {
        assert.equal(source.includes('merge_pull_request'), false, `${name} must not invoke merge`);
        assert.equal(source.includes('mergePullRequest'), false, `${name} must not invoke merge`);
        assert.equal(source.includes('policyPrCreationAllowed: true'), false, `${name} must not authorize automatic PR creation`);
        assert.equal(source.includes('automaticMergeAllowed: true'), false, `${name} must not authorize automatic merge`);
        assert.equal(source.includes('mergeExecutionAllowed: true'), false, `${name} must not authorize merge execution`);
    }

    assert.ok(decision.includes('requiresSeparateRepositoryMergeAction: approved'));
    assert.ok(decision.includes('mergeMustRemainUnperformed: true'));
});
