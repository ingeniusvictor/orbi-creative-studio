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

test('QB-23 remote evidence matrix records QB-12 through QB-15 certifications', () => {
    for (const phase of ['qb12', 'qb13', 'qb14', 'qb15']) {
        const item = MATRIX.lab_dependency_state[phase];
        assert.equal(item.status, 'CERTIFIED');
        assert.match(item.implementation_candidate, /^[0-9a-f]{40}$/);
        assert.match(item.certification_head, /^[0-9a-f]{40}$/);
    }

    assert.equal(MATRIX.lab_dependency_state.qb12.regression_count, 62);
    assert.equal(MATRIX.lab_dependency_state.qb13.regression_count, 78);
    assert.equal(MATRIX.lab_dependency_state.qb14.regression_count, 90);
    assert.equal(MATRIX.lab_dependency_state.qb14.contract_validator, 'PASS');

    assert.equal(MATRIX.lab_dependency_state.qb15.regression_count, 107);
    assert.equal(MATRIX.lab_dependency_state.qb15.regression_result, 'PASS');
    assert.equal(MATRIX.lab_dependency_state.qb15.live_observed, 'PASS');
    assert.equal(MATRIX.lab_dependency_state.qb15.live_sidecar_result, 'PASS');
    assert.equal(MATRIX.lab_dependency_state.qb15.sqlite_concurrent_init_hardening, true);
    assert.equal(
        MATRIX.lab_dependency_state.qb15.implementation_candidate,
        '044a2059d63ecbc99a5bbd2562d7d82bafd91109',
    );
    assert.equal(
        MATRIX.lab_dependency_state.qb15.certification_head,
        '09edd9f3d0d1b4201f1257bc55e67e76f96c9f38',
    );

    assert.equal(
        MATRIX.checkpoint_state,
        'REMOTE_PRODUCT_STACK_GREEN__QB12_QB15_CERTIFIED__QB16_QB23_DRAFT_CI_GREEN',
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
