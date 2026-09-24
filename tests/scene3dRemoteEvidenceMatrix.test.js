const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const MATRIX = JSON.parse(
    fs.readFileSync(
        'docs/orbi/qb23/scene3d_remote_evidence_matrix.v1.json',
        'utf8',
    ),
);

test('QB-23 remote evidence matrix keeps all product-side phases GREEN', () => {
    assert.equal(
        MATRIX.schema,
        'orbi.scene3d-remote-evidence-matrix/v1',
    );

    for (const phase of ['qb16','qb17','qb18','qb19','qb20','qb21','qb22','qb23']) {
        assert.match(
            MATRIX.creative_studio_remote_evidence[phase].head,
            /^[0-9a-f]{40}$/,
        );
        assert.equal(
            MATRIX.creative_studio_remote_evidence[phase].ci,
            'GREEN',
        );
    }
});

test('QB-23 remote evidence matrix never upgrades pending lab dependencies', () => {
    for (const phase of ['qb12','qb13','qb14','qb15']) {
        assert.notEqual(
            MATRIX.lab_dependency_state[phase].status,
            'CERTIFIED',
        );
        assert.match(
            MATRIX.lab_dependency_state[phase].head,
            /^[0-9a-f]{40}$/,
        );
    }

    assert.equal(
        MATRIX.checkpoint_state,
        'REMOTE_PRODUCT_STACK_GREEN__LAB_CERTIFICATION_PENDING',
    );
});

test('QB-23 remote evidence checkpoint cannot authorize activation or cutover', () => {
    const authority = MATRIX.authority_state;

    assert.equal(authority.pilotDefaultOff, true);
    assert.equal(authority.executionDefaultOff, true);
    assert.equal(authority.automaticR2Retry, false);
    assert.equal(authority.featureEnableAuthorized, false);
    assert.equal(authority.productionCutoverAuthorized, false);
    assert.equal(authority.computeRouterAuthorityChanged, false);
    assert.equal(authority.mhsActuationEnabled, false);
});
