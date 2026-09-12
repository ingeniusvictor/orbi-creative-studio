const test = require('node:test');
const assert = require('node:assert/strict');

async function certification() {
    return import('../src/lib/computeRouter/parityCertification.mjs');
}

function report({
    operation = 't2i',
    modelId = 'z-image-turbo',
    expectedProviderId = 'sdcpp-device',
    selectedProviderId = expectedProviderId,
    parity = 'match',
} = {}) {
    return {
        schemaVersion: 1,
        mode: 'shadow-only',
        operation,
        modelId,
        expectedProviderId,
        selectedProviderId,
        parity,
        reason: selectedProviderId ? 'SELECTED' : 'NO_ELIGIBLE_PROVIDER',
        rejected: [],
    };
}

test('certification refuses to pass without explicit targets', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    const result = ledger.evaluate([]);
    assert.equal(result.certified, false);
    assert.equal(result.reason, 'NO_CERTIFICATION_TARGETS');
    assert.deepEqual(result.routes, []);
});

test('a route certifies only after the configured number of all-match samples', async () => {
    const { createParityCertificationLedger } = await certification();
    let clock = 1000;
    const ledger = createParityCertificationLedger({ now: () => clock });

    const target = {
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 3,
    };

    for (let i = 0; i < 2; i += 1) {
        ledger.record(report(), { observedAt: clock });
        clock += 1;
    }

    let result = ledger.evaluate([target]);
    assert.equal(result.certified, false);
    assert.equal(result.routes[0].samples, 2);
    assert.ok(result.routes[0].reasons.includes('samples:2/3'));

    ledger.record(report(), { observedAt: clock });
    result = ledger.evaluate([target]);
    assert.equal(result.certified, true);
    assert.equal(result.reason, 'PARITY_CERTIFIED');
    assert.equal(result.routes[0].matches, 3);
    assert.equal(result.routes[0].blocked, 0);
    assert.equal(result.routes[0].mismatches, 0);
});

test('one blocked observation invalidates a route even when sample threshold is met', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    ledger.record(report());
    ledger.record(report());
    ledger.record(report({
        selectedProviderId: null,
        parity: 'blocked',
    }));

    const result = ledger.evaluate([{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 3,
    }]);

    assert.equal(result.certified, false);
    assert.equal(result.routes[0].blocked, 1);
    assert.ok(result.routes[0].reasons.includes('blocked:1'));
    assert.ok(result.routes[0].reasons.includes('non-match-evidence'));
});

test('one mismatch observation invalidates a route even when sample threshold is met', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    ledger.record(report());
    ledger.record(report());
    ledger.record(report({
        selectedProviderId: 'muapi-cloud',
        parity: 'mismatch',
    }));

    const result = ledger.evaluate([{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 3,
    }]);

    assert.equal(result.certified, false);
    assert.equal(result.routes[0].mismatches, 1);
    assert.ok(result.routes[0].reasons.includes('mismatch:1'));
});

test('model diversity is independently required when target asks for it', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    ledger.record(report({ modelId: 'model-a' }));
    ledger.record(report({ modelId: 'model-a' }));
    ledger.record(report({ modelId: 'model-a' }));

    let result = ledger.evaluate([{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 3,
        minDistinctModels: 2,
    }]);
    assert.equal(result.certified, false);
    assert.ok(result.routes[0].reasons.includes('models:1/2'));

    ledger.record(report({ modelId: 'model-b' }));
    result = ledger.evaluate([{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 3,
        minDistinctModels: 2,
    }]);
    assert.equal(result.certified, true);
    assert.equal(result.routes[0].distinctModels, 2);
});

test('stale evidence expires and cannot certify current behavior', async () => {
    const {
        createParityCertificationLedger,
    } = await certification();

    let clock = 10_000;
    const ledger = createParityCertificationLedger({
        maxEvidenceAgeMs: 100,
        now: () => clock,
    });

    ledger.record(report(), { observedAt: clock });
    ledger.record(report(), { observedAt: clock + 1 });
    clock += 200;

    const result = ledger.evaluate([{
        expectedProviderId: 'sdcpp-device',
        operation: 't2i',
        minSamples: 2,
    }]);

    assert.equal(result.certified, false);
    assert.equal(result.routes[0].samples, 0);
    assert.deepEqual(ledger.snapshot(), []);
});

test('evidence normalization rejects impossible parity reports', async () => {
    const {
        normalizeEvidence,
    } = await certification();

    assert.throws(
        () => normalizeEvidence(report({
            selectedProviderId: 'muapi-cloud',
            parity: 'match',
        }), 1000),
        (error) => error.code === 'INVALID_PARITY_EVIDENCE',
    );

    assert.throws(
        () => normalizeEvidence(report({
            selectedProviderId: 'sdcpp-device',
            parity: 'blocked',
        }), 1000),
        (error) => error.code === 'INVALID_PARITY_EVIDENCE',
    );

    assert.throws(
        () => normalizeEvidence({
            ...report(),
            mode: 'execution',
        }, 1000),
        (error) => error.code === 'INVALID_PARITY_EVIDENCE',
    );
});

test('duplicate certification targets fail closed', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    assert.throws(
        () => ledger.evaluate([
            {
                expectedProviderId: 'sdcpp-device',
                operation: 't2i',
            },
            {
                expectedProviderId: 'sdcpp-device',
                operation: 't2i',
            },
        ]),
        (error) => error.code === 'INVALID_CERTIFICATION_TARGET',
    );
});

test('certification evaluates routes independently and requires every requested route', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    for (let i = 0; i < 2; i += 1) {
        ledger.record(report({
            operation: 't2i',
            modelId: 'z-image-turbo',
            expectedProviderId: 'sdcpp-device',
            selectedProviderId: 'sdcpp-device',
        }));
    }
    ledger.record(report({
        operation: 't2v',
        modelId: 'wan2gp:wan22-t2v',
        expectedProviderId: 'wan2gp-lan',
        selectedProviderId: 'wan2gp-lan',
    }));

    const result = ledger.evaluate([
        {
            expectedProviderId: 'sdcpp-device',
            operation: 't2i',
            minSamples: 2,
        },
        {
            expectedProviderId: 'wan2gp-lan',
            operation: 't2v',
            minSamples: 2,
        },
    ]);

    assert.equal(result.certified, false);
    assert.equal(result.routes[0].certified, true);
    assert.equal(result.routes[1].certified, false);
    assert.ok(result.routes[1].reasons.includes('samples:1/2'));
});

test('ledger snapshot contains routing evidence only', async () => {
    const { createParityCertificationLedger } = await certification();
    const ledger = createParityCertificationLedger();

    ledger.record({
        ...report(),
        prompt: 'private',
        apiKey: 'secret',
        image_url: 'https://private.invalid/file',
    });

    const snapshot = ledger.snapshot();
    const serialized = JSON.stringify(snapshot);
    assert.equal(snapshot.length, 1);
    assert.equal(serialized.includes('private'), false);
    assert.equal(serialized.includes('secret'), false);
    assert.equal(serialized.includes('image_url'), false);
    assert.deepEqual(Object.keys(snapshot[0]).sort(), [
        'expectedProviderId',
        'modelId',
        'observedAt',
        'operation',
        'parity',
        'routeKey',
        'selectedProviderId',
    ].sort());
});
