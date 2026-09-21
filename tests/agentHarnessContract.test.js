const test = require('node:test');
const assert = require('node:assert/strict');

function validObservation() {
    return {
        schemaVersion: 1,
        status: 'success',
        summary: 'Focused tests and integrated gate passed.',
        nextActions: [],
        artifacts: [
            { type: 'commit', ref: 'abc123', note: 'Validated head' },
        ],
        evidence: [
            { type: 'test', ref: 'node --test tests/example.test.js', outcome: 'pass' },
            { type: 'workflow', ref: 'run-123', outcome: 'pass' },
        ],
        authorityImpact: {
            affected: false,
            domains: [],
            note: 'No governed authority surface changed.',
        },
    };
}

test('P8 accepts a structured non-authorizing success observation', async () => {
    const validator = await import('../scripts/validate-agent-observation.mjs');
    const result = validator.validateAgentObservation(validObservation());

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});

test('P8 requires explicit recovery information for error observations', async () => {
    const validator = await import('../scripts/validate-agent-observation.mjs');
    const observation = validObservation();
    observation.status = 'error';
    observation.summary = 'Build failed.';

    const result = validator.validateAgentObservation(observation);

    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('recovery is required when status is error'));

    observation.recovery = {
        rootCauseHint: 'The build step returned a non-zero exit status.',
        safeRetry: 'Inspect the failing build output and retry only after a targeted change.',
        stopCondition: 'Stop after the same root cause repeats without new evidence.',
    };

    const recovered = validator.validateAgentObservation(observation);
    assert.equal(recovered.valid, true);
});

test('P8 fails closed when authority impact is inconsistent', async () => {
    const validator = await import('../scripts/validate-agent-observation.mjs');
    const observation = validObservation();

    observation.authorityImpact = {
        affected: false,
        domains: ['cutover'],
        note: 'Contradictory on purpose.',
    };

    const result = validator.validateAgentObservation(observation);

    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('authorityImpact.domains must be empty when affected is false'));
});

test('P8 rejects unknown top-level fields instead of silently widening the contract', async () => {
    const validator = await import('../scripts/validate-agent-observation.mjs');
    const observation = validObservation();
    observation.executeShell = true;

    const result = validator.validateAgentObservation(observation);

    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('observation contains unsupported key: executeShell'));
});
