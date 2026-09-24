const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DECISIONS,
    digest,
    normalizeJson,
    validateManualPilotReview,
} = require('../scripts/lib/scene3dManualPilotReview');
const { main } = require('../scripts/qb23-scene3d-manual-pilot-review');

function record(decision = 'APPROVE_MANUAL_PILOT_REVIEW') {
    return {
        schema: 'orbi.scene3d-manual-pilot-review/v1',
        decision,
        reviewer: 'operator@example',
        rationale: 'All required evidence was reviewed manually.',
        readinessEvidenceSha256: 'a'.repeat(64),
        readinessState: 'EVIDENCE_COMPLETE_FOR_MANUAL_PILOT_REVIEW',
        reviewedCommit: 'b'.repeat(40),
    };
}

function capture() {
    let text = '';
    return {
        stream: { write(value) { text += String(value); } },
        value() { return text; },
    };
}

test('QB-23 supports explicit approve/reject decisions only', () => {
    assert.deepEqual(DECISIONS, [
        'APPROVE_MANUAL_PILOT_REVIEW',
        'REJECT_MANUAL_PILOT_REVIEW',
    ]);

    assert.throws(
        () => validateManualPilotReview({
            ...record(),
            decision: 'ENABLE_PRODUCTION',
        }),
        /decision is not supported/,
    );
});

test('QB-23 approval records manual review but never feature/cutover authority', () => {
    const result = validateManualPilotReview(record());

    assert.equal(result.valid, true);
    assert.equal(result.manualPilotReviewApproved, true);
    assert.equal(result.featureEnableAuthorized, false);
    assert.equal(result.productionCutoverAuthorized, false);
    assert.equal(result.computeRouterAuthorityChanged, false);
    assert.equal(result.mhsActuationEnabled, false);
    assert.equal(result.reviewSha256.length, 64);
});

test('QB-23 rejection remains non-authoritative and traceable', () => {
    const result = validateManualPilotReview(
        record('REJECT_MANUAL_PILOT_REVIEW')
    );

    assert.equal(result.manualPilotReviewApproved, false);
    assert.equal(result.featureEnableAuthorized, false);
    assert.equal(result.productionCutoverAuthorized, false);
    assert.equal(result.reviewSha256.length, 64);
});

test('QB-23 requires readiness-complete evidence digest and immutable commit', () => {
    assert.throws(
        () => validateManualPilotReview({
            ...record(),
            readinessState: 'BLOCKED',
        }),
        /not complete for manual review/,
    );
    assert.throws(
        () => validateManualPilotReview({
            ...record(),
            readinessEvidenceSha256: 'deadbeef',
        }),
        /lowercase SHA-256/,
    );
    assert.throws(
        () => validateManualPilotReview({
            ...record(),
            reviewedCommit: 'deadbeef',
        }),
        /40-character Git SHA/,
    );
});

test('QB-23 digest is deterministic and prototype-safe', () => {
    const a = record();
    const b = {
        reviewedCommit: a.reviewedCommit,
        readinessState: a.readinessState,
        readinessEvidenceSha256: a.readinessEvidenceSha256,
        rationale: a.rationale,
        reviewer: a.reviewer,
        decision: a.decision,
        schema: a.schema,
    };
    assert.equal(digest(a), digest(b));

    const raw = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const normalized = normalizeJson(raw);
    assert.equal(Object.getPrototypeOf(normalized), null);
    assert.equal(Object.prototype.polluted, undefined);
});

test('QB-23 CLI emits validated record and never mutates source', () => {
    const out = capture();
    const err = capture();
    const input = JSON.stringify(record());
    let reads = 0;

    const code = main(['review.json'], {
        readFileSync(path, encoding) {
            reads += 1;
            assert.equal(path, 'review.json');
            assert.equal(encoding, 'utf8');
            return input;
        },
        stdout: out.stream,
        stderr: err.stream,
    });

    assert.equal(code, 0);
    assert.equal(reads, 1);
    assert.equal(err.value(), '');
    const result = JSON.parse(out.value());
    assert.equal(result.manualPilotReviewApproved, true);
    assert.equal(result.featureEnableAuthorized, false);
    assert.equal(result.productionCutoverAuthorized, false);
});

test('QB-23 invalid CLI input fails closed', () => {
    const out = capture();
    const err = capture();

    const code = main(['review.json'], {
        readFileSync: () => '{}',
        stdout: out.stream,
        stderr: err.stream,
    });

    assert.equal(code, 1);
    assert.equal(out.value(), '');
    assert.equal(JSON.parse(err.value()).error.code, 'SCENE3D_MANUAL_REVIEW_INVALID');
});

test('QB-23 review tooling has no runtime execution authority', () => {
    const fs = require('node:fs');
    const source = [
        fs.readFileSync('scripts/lib/scene3dManualPilotReview.js', 'utf8'),
        fs.readFileSync('scripts/qb23-scene3d-manual-pilot-review.js', 'utf8'),
    ].join('\n');

    for (const forbidden of [
        "require('electron')",
        'ipcMain',
        'ipcRenderer',
        'child_process',
        'executeRecipe',
        'dryRunRecipe',
        'setExecutionEnabled',
        'ORBI_SCENE3D_EXECUTION_ENABLED',
        'orbiComputeRouter',
        'mhsWrite',
        'mhsActuate',
        'mhsReset',
        'window.orbiHardware',
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }
});
