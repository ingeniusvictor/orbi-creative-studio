const test = require('node:test');
const assert = require('node:assert/strict');

const {
    sanitizeAudit,
    sanitizeError,
    sanitizeOrbiResponse,
    sanitizePendingRecoveries,
    sanitizeReconciliationHistory,
} = require('../electron/lib/scene3dRendererSanitizer');

test('QB-16 renderer sanitizer removes provider identity and provenance', () => {
    const result = sanitizeOrbiResponse({
        ok: true,
        request_id: 'req-1',
        interface: 'orbi.scene3d.v1',
        operation: 'scene_info',
        provider: {
            family: 'qwen-mm-plugins',
            capability: 'blender',
            version: '1.1.0',
        },
        provenance: {
            provider: 'qwen-mm-plugins',
            provider_version: '1.1.0',
        },
        data: [{ kind: 'text', text: '{"objects":[]}' }],
        policy: { risk_class: 'R0_READ_LOCAL', decision: 'allow' },
        audit: null,
    });

    assert.equal(result.ok, true);
    assert.equal('provider' in result, false);
    assert.equal('provenance' in result, false);
    assert.deepEqual(result.data, [{ kind: 'text', text: '{"objects":[]}' }]);
});

test('QB-16 execution sanitizer drops raw provider result and provider tool name', () => {
    const result = sanitizeOrbiResponse({
        ok: true,
        request_id: 'req-2',
        interface: 'orbi.scene3d.v1',
        operation: 'execute_recipe',
        data: {
            execution: 'executed',
            recipe: {
                recipe_id: 'orbi.blender.create_cube.v1',
                version: '1.0.0',
                parameters: { name: 'Cube' },
                code_sha256: 'a'.repeat(64),
                filesystem_scope: [],
                network_allowed: false,
            },
            provider_result: [
                { kind: 'text', text: 'raw provider output' },
            ],
            audit: {
                provider_tool: 'execute_blender_code',
                provider_called: true,
            },
        },
        policy: { risk_class: 'R2_EXECUTE_SANDBOXED', decision: 'allow' },
        audit: {
            schema: 'orbi.execution-audit/v1',
            request_id: 'req-2',
            provider: {
                family: 'qwen-mm-plugins',
                capability: 'blender',
                version: '1.1.0',
            },
            provider_called: true,
        },
    });

    assert.equal(result.data.execution, 'executed');
    assert.equal(result.data.providerCalled, true);
    assert.equal('provider_result' in result.data, false);
    assert.equal('audit' in result.data, false);
    assert.equal('provider' in result.audit, false);

    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('qwen-mm-plugins'), false);
    assert.equal(serialized.includes('execute_blender_code'), false);
    assert.equal(serialized.includes('raw provider output'), false);
});

test('QB-16 error sanitizer replaces provider raw exception text', () => {
    const result = sanitizeOrbiResponse({
        ok: false,
        request_id: 'req-3',
        interface: 'orbi.scene3d.v1',
        operation: 'scene_info',
        data: null,
        policy: { risk_class: 'R0_READ_LOCAL', decision: 'error' },
        audit: null,
        error: {
            code: 'PROVIDER_FAILURE',
            message: 'Traceback /home/user/private/path qwen_mm_plugins_blender failed',
            retryable: false,
        },
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PROVIDER_FAILURE');
    assert.equal(result.error.message, 'Scene3D provider operation failed');
    assert.equal(JSON.stringify(result).includes('/home/user/private/path'), false);
    assert.equal(JSON.stringify(result).includes('qwen_mm_plugins'), false);
});

test('QB-16 replay errors remain actionable without exposing internals', () => {
    assert.deepEqual(
        sanitizeError({
            code: 'REPLAY_DENIED',
            message: 'internal request fingerprint and storage details',
            retryable: false,
        }),
        {
            code: 'REPLAY_DENIED',
            message: 'Scene3D execution request was already used',
            retryable: false,
        },
    );
});

test('QB-16 audit sanitizer preserves replay evidence but removes provider block', () => {
    const audit = sanitizeAudit({
        schema: 'orbi.execution-audit/v1',
        sequence: 4,
        request_id: 'req-4',
        request_fingerprint: 'f'.repeat(64),
        outcome: 'executed',
        provider_called: true,
        provider: {
            family: 'qwen-mm-plugins',
            capability: 'blender',
            version: '1.1.0',
        },
        retry_semantics: 'new-request-id-required-after-execution-attempt',
    });

    assert.equal(audit.sequence, 4);
    assert.equal(audit.provider_called, true);
    assert.equal('provider' in audit, false);
});

test('QB-16 pending recovery sanitizer strips provider metadata', () => {
    const pending = sanitizePendingRecoveries([
        {
            schema: 'orbi.execution-audit/v1',
            sequence: 5,
            request_id: 'pending-1',
            outcome: 'pending',
            provider_called: null,
            provider: {
                family: '',
                capability: '',
                version: '',
            },
            replay_reserved: true,
        },
    ]);

    assert.equal(pending.length, 1);
    assert.equal(pending[0].outcome, 'pending');
    assert.equal('provider' in pending[0], false);
});

test('QB-16 reconciliation history exposes metadata but hides raw operator evidence', () => {
    const history = sanitizeReconciliationHistory([
        {
            schema: 'orbi.execution-reconciliation/v1',
            reconciliation_sequence: 9,
            execution_sequence: 8,
            request_id: 'pending-1',
            request_fingerprint: 'f'.repeat(64),
            resolution: 'applied',
            actor: 'operator',
            evidence: {
                source: 'blender-object-info',
                exists: true,
                privatePath: '/home/user/private/project.blend',
            },
            evidence_sha256: 'e'.repeat(64),
            final: true,
            reservation_released: false,
            retry_semantics: 'original-request-id-remains-reserved;new-request-id-required',
        },
    ]);

    assert.equal(history[0].resolution, 'applied');
    assert.equal(history[0].evidence_sha256, 'e'.repeat(64));
    assert.equal('evidence' in history[0], false);
    assert.equal(JSON.stringify(history).includes('/home/user/private'), false);
    assert.equal(JSON.stringify(history).includes('qwen'), false);
});

test('QB-16 sanitizer rejects malformed recovery collections', () => {
    assert.throws(() => sanitizePendingRecoveries({}), /array/);
    assert.throws(() => sanitizeReconciliationHistory({}), /array/);
});
