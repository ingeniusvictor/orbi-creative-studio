const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
    BLOCKED_STATE,
    COMPLETE_STATE,
    REQUIREMENTS,
    REQUIRED_AUTHORITY,
    createBlockedTemplate,
    evaluateScene3DPilotReadiness,
    evidenceDigest,
    normalizeJson,
} = require('../scripts/lib/scene3dPilotReadinessEvidence');
const {
    main,
} = require('../scripts/qb22-scene3d-pilot-readiness');

function completeEvidence() {
    const phases = {};
    let index = 1;
    for (const [phase, gates] of Object.entries(REQUIREMENTS)) {
        const record = {
            status: 'PASS',
            commit: index.toString(16).padStart(40, '0'),
        };
        for (const gate of gates) record[gate] = true;
        phases[phase] = record;
        index += 1;
    }

    return {
        schema: 'orbi.scene3d-pilot-readiness/v1',
        phases,
        authority: { ...REQUIRED_AUTHORITY },
    };
}

function capture() {
    let text = '';
    return {
        stream: {
            write(value) {
                text += String(value);
            },
        },
        value() {
            return text;
        },
    };
}

test('QB-22 blocked template is fail-closed for every required phase', () => {
    const template = createBlockedTemplate();
    const result = evaluateScene3DPilotReadiness(template);

    assert.equal(result.state, BLOCKED_STATE);
    assert.equal(result.complete, false);
    assert.equal(result.manualPilotReviewAllowed, false);
    assert.equal(result.featureEnableAuthorized, false);
    assert.equal(result.productionCutoverAuthorized, false);

    for (const phase of Object.keys(REQUIREMENTS)) {
        assert.equal(template.phases[phase].status, 'PENDING');
    }
});

test('QB-22 complete evidence enables manual review only, never feature or production authority', () => {
    const result = evaluateScene3DPilotReadiness(completeEvidence());

    assert.equal(result.state, COMPLETE_STATE);
    assert.equal(result.complete, true);
    assert.equal(result.manualPilotReviewAllowed, true);
    assert.equal(result.featureEnableAuthorized, false);
    assert.equal(result.productionCutoverAuthorized, false);
    assert.equal(result.computeRouterAuthorityChanged, false);
    assert.equal(result.mhsActuationEnabled, false);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.violations, []);
});

test('QB-22 any missing phase gate blocks manual pilot review', () => {
    const evidence = completeEvidence();
    evidence.phases['QB-15'].livePass = false;

    const result = evaluateScene3DPilotReadiness(evidence);

    assert.equal(result.state, BLOCKED_STATE);
    assert.equal(result.manualPilotReviewAllowed, false);
    assert.ok(result.missing.includes('QB-15.livePass=true'));
});

test('QB-22 PASS status without a valid immutable commit is blocked', () => {
    const evidence = completeEvidence();
    evidence.phases['QB-21'].commit = 'deadbeef';

    const result = evaluateScene3DPilotReadiness(evidence);

    assert.equal(result.complete, false);
    assert.ok(result.violations.some((item) => item.includes('QB-21.commit')));
});

test('QB-22 authority drift fails closed', () => {
    for (const [key, required] of Object.entries(REQUIRED_AUTHORITY)) {
        const evidence = completeEvidence();
        evidence.authority[key] = !required;

        const result = evaluateScene3DPilotReadiness(evidence);

        assert.equal(result.complete, false, key);
        assert.equal(result.manualPilotReviewAllowed, false, key);
        assert.equal(result.featureEnableAuthorized, false, key);
        assert.equal(result.productionCutoverAuthorized, false, key);
        assert.ok(
            result.violations.includes(
                `authority.${key} must equal ${String(required)}`
            ),
            key,
        );
    }
});

test('QB-22 evidence digest is deterministic across object key order', () => {
    const a = completeEvidence();
    const b = {
        authority: { ...a.authority },
        phases: Object.fromEntries(Object.entries(a.phases).reverse()),
        schema: a.schema,
    };

    assert.equal(evidenceDigest(a), evidenceDigest(b));
    assert.equal(evidenceDigest(a).length, 64);
});

test('QB-22 canonical evidence treats __proto__ as data without prototype mutation', () => {
    const raw = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const normalized = normalizeJson(raw);

    assert.equal(Object.getPrototypeOf(normalized), null);
    assert.equal(Object.prototype.polluted, undefined);
    assert.deepEqual(
        JSON.parse(JSON.stringify(normalized)),
        JSON.parse('{"__proto__":{"polluted":true},"safe":1}'),
    );
});

test('QB-22 malformed evidence cannot produce an authorization result', () => {
    for (const value of [null, [], 'text', 42]) {
        assert.throws(
            () => evaluateScene3DPilotReadiness(value),
            /evidence must be an object/,
        );
    }
});

test('QB-22 CLI returns 2 for blocked evidence and never rewrites the evidence file', () => {
    const input = JSON.stringify(createBlockedTemplate());
    const out = capture();
    const err = capture();
    let reads = 0;

    const code = main(['evidence.json'], {
        readFileSync(path, encoding) {
            reads += 1;
            assert.equal(path, 'evidence.json');
            assert.equal(encoding, 'utf8');
            return input;
        },
        stdout: out.stream,
        stderr: err.stream,
    });

    assert.equal(code, 2);
    assert.equal(reads, 1);
    assert.equal(err.value(), '');
    assert.equal(JSON.parse(out.value()).state, BLOCKED_STATE);
});

test('QB-22 CLI returns 0 only for complete manual-review evidence', () => {
    const out = capture();
    const err = capture();

    const code = main(['evidence.json'], {
        readFileSync: () => JSON.stringify(completeEvidence()),
        stdout: out.stream,
        stderr: err.stream,
    });

    const result = JSON.parse(out.value());
    assert.equal(code, 0);
    assert.equal(result.state, COMPLETE_STATE);
    assert.equal(result.manualPilotReviewAllowed, true);
    assert.equal(result.featureEnableAuthorized, false);
    assert.equal(result.productionCutoverAuthorized, false);
    assert.equal(err.value(), '');
});

test('QB-22 readiness tooling has no runtime execution or Electron authority', () => {
    const sources = [
        fs.readFileSync('scripts/lib/scene3dPilotReadinessEvidence.js', 'utf8'),
        fs.readFileSync('scripts/qb22-scene3d-pilot-readiness.js', 'utf8'),
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
        'mhsDiscover',
        'window.orbiHardware',
    ]) {
        assert.equal(sources.includes(forbidden), false, forbidden);
    }
});
