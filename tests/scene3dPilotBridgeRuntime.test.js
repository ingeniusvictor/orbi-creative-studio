const test = require('node:test');
const assert = require('node:assert/strict');

const {
    CHANNELS,
    register,
} = require('../electron/lib/scene3dPilotBridge');

function createIpc() {
    const handlers = new Map();
    return {
        handlers,
        removeHandler(channel) {
            handlers.delete(channel);
        },
        handle(channel, handler) {
            handlers.set(channel, handler);
        },
    };
}

function providerResult({
    ok = true,
    requestId = 'provider-request',
    operation = 'scene_info',
    data = [{ kind: 'text', text: '{"objects":[]}' }],
    audit = null,
    error = undefined,
} = {}) {
    const result = {
        ok,
        request_id: requestId,
        interface: 'orbi.scene3d.v1',
        operation,
        provider: {
            family: 'qwen-mm-plugins',
            capability: 'blender',
            version: '1.1.0',
        },
        provenance: {
            provider: 'qwen-mm-plugins',
            provider_version: '1.1.0',
        },
        data,
        policy: {
            risk_class: operation === 'execute_recipe'
                ? 'R2_EXECUTE_SANDBOXED'
                : 'R0_READ_LOCAL',
            decision: ok ? 'allow' : 'error',
        },
        audit,
    };
    if (error) result.error = error;
    return result;
}

function createHarness({ enabled = true, executionEnabled = true, responses = [] } = {}) {
    const ipc = createIpc();
    const requests = [];
    let createClientCalls = 0;
    let trustedCalls = 0;
    let uuid = 0;
    let reviewId = 0;
    const issuedReviews = [];
    const consumedReviews = [];

    const client = {
        request: async (operation, input, options = {}) => {
            requests.push({ operation, input, options });
            if (responses.length > 0) return responses.shift();

            return {
                protocol: 'orbi.scene3d-sidecar/v1',
                id: 'transport',
                ok: true,
                result: providerResult({
                    requestId: options.requestId,
                    operation: operation === 'scene_info' || operation === 'object_info'
                        ? operation
                        : 'execute_recipe',
                }),
            };
        },
        close() {},
        isStarted: () => requests.length > 0,
    };

    const registration = register({
        appImpl: {
            getPath(name) {
                assert.equal(name, 'userData');
                return '/tmp/orbi';
            },
        },
        env: {},
        ipcMainImpl: ipc,
        assertTrustedSenderImpl: () => {
            trustedCalls += 1;
        },
        randomUUIDImpl: () => `main-id-${++uuid}`,
        createClientImpl: () => {
            createClientCalls += 1;
            return client;
        },
        createReviewRegistryImpl: () => ({
            issue({ recipeId, parameters }) {
                const review = Object.freeze({
                    token: `review-${++reviewId}`,
                    recipeId,
                    fingerprint: `fingerprint-${reviewId}`,
                    codeSha256: 'a'.repeat(64),
                    expiresAt: 999999,
                    oneShot: true,
                });
                issuedReviews.push({ recipeId, parameters, review });
                return review;
            },
            consume(value) {
                consumedReviews.push(value);
                if (!value || typeof value.token !== 'string' || !value.token.startsWith('review-')) {
                    const error = new Error('review required');
                    error.code = 'SCENE3D_REVIEW_REQUIRED';
                    throw error;
                }
                return {
                    recipeId: value.recipeId,
                    fingerprint: 'fake',
                    codeSha256: 'a'.repeat(64),
                };
            },
            invalidateAll() {},
        }),
        resolveConfigImpl: () => ({
            enabled,
            mode: enabled ? 'native' : 'disabled',
            command: enabled ? '/opt/python' : null,
            args: [],
            cwd: null,
            ledgerPath: enabled ? '/private/ledger.sqlite3' : null,
            executionEnabled: enabled && executionEnabled,
        }),
        diagnostic: () => {},
    });

    async function invoke(channel, ...args) {
        const handler = ipc.handlers.get(channel);
        assert.equal(typeof handler, 'function', `missing handler ${channel}`);
        return handler({ senderFrame: {}, sender: { mainFrame: {} } }, ...args);
    }

    return {
        ipc,
        requests,
        registration,
        invoke,
        get createClientCalls() { return createClientCalls; },
        get trustedCalls() { return trustedCalls; },
        issuedReviews,
        consumedReviews,
    };
}

test('QB-16 disabled bridge registers status but never creates a client', async () => {
    const harness = createHarness({ enabled: false });

    const status = await harness.invoke(CHANNELS.status);
    const denied = await harness.invoke(CHANNELS.sceneInfo);

    assert.equal(status.ok, true);
    assert.equal(status.status.enabled, false);
    assert.equal(status.status.mode, 'disabled');
    assert.equal(status.status.processStarted, false);
    assert.equal('ledgerPath' in status.status, false);

    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'SCENE3D_PILOT_DISABLED');
    assert.equal(harness.createClientCalls, 0);
    assert.equal(harness.requests.length, 0);
});

test('QB-16 all IPC handlers pass through trusted-sender validation', async () => {
    const harness = createHarness({ enabled: false });

    await harness.invoke(CHANNELS.status);
    await harness.invoke(CHANNELS.sceneInfo);
    await harness.invoke(CHANNELS.objectInfo, 'Cube');
    await harness.invoke(CHANNELS.dryRunRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
    });
    await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
    });
    await harness.invoke(CHANNELS.pendingRecoveries);
    await harness.invoke(CHANNELS.reconciliationHistory);

    assert.equal(harness.trustedCalls, 7);
});

test('QB-16 scene read uses a main-generated request id and strips provider metadata', async () => {
    const harness = createHarness({
        responses: [{
            protocol: 'orbi.scene3d-sidecar/v1',
            id: 'transport',
            ok: true,
            result: providerResult({ requestId: 'main-id-1' }),
        }],
    });

    const response = await harness.invoke(CHANNELS.sceneInfo);

    assert.equal(harness.requests.length, 1);
    assert.deepEqual(harness.requests[0], {
        operation: 'scene_info',
        input: {},
        options: { requestId: 'main-id-1' },
    });

    assert.equal(response.ok, true);
    assert.equal(response.request_id, 'main-id-1');
    assert.equal('provider' in response, false);
    assert.equal('provenance' in response, false);
    assert.equal(JSON.stringify(response).includes('qwen'), false);
});

test('QB-16 invalid object name does not dispatch to the sidecar', async () => {
    const harness = createHarness();

    const response = await harness.invoke(CHANNELS.objectInfo, '');

    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'SCENE3D_PILOT_REQUEST_INVALID');
    assert.equal(harness.requests.length, 0);
});

test('QB-16 dry-run dispatches only recipe id and parameters', async () => {
    const harness = createHarness();

    const response = await harness.invoke(CHANNELS.dryRunRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube' },
    });

    assert.equal(response.ok, true);
    assert.equal(harness.requests.length, 1);
    assert.deepEqual(harness.requests[0].input, {
        recipe_id: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube' },
    });
    assert.equal(harness.requests[0].operation, 'dry_run_recipe');
    assert.equal(harness.requests[0].options.requestId, 'main-id-1');
    assert.equal(response.review.token, 'review-1');
    assert.equal(harness.issuedReviews.length, 1);
});

test('QB-16 delete execution requires confirmation and never forwards it', async () => {
    const harness = createHarness();

    const denied = await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.delete_object.v1',
        parameters: { name: 'Cube' },
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error.code, 'SCENE3D_PILOT_REQUEST_INVALID');
    assert.equal(harness.requests.length, 0);

    const allowed = await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.delete_object.v1',
        parameters: { name: 'Cube' },
        confirmed: true,
        reviewToken: 'review-1',
    });
    assert.equal(allowed.ok, true);
    assert.equal(harness.requests.length, 1);
    assert.deepEqual(harness.requests[0].input, {
        recipe_id: 'orbi.blender.delete_object.v1',
        parameters: { name: 'Cube' },
    });
    assert.equal('confirmed' in harness.requests[0].input, false);
});

test('QB-16 pending recovery inspection removes provider metadata', async () => {
    const harness = createHarness({
        responses: [{
            protocol: 'orbi.scene3d-sidecar/v1',
            id: 'transport',
            ok: true,
            result: [{
                schema: 'orbi.execution-audit/v1',
                sequence: 7,
                request_id: 'pending-id',
                outcome: 'pending',
                provider_called: null,
                provider: {
                    family: 'qwen-mm-plugins',
                    capability: 'blender',
                    version: '1.1.0',
                },
                replay_reserved: true,
            }],
        }],
    });

    const response = await harness.invoke(CHANNELS.pendingRecoveries);

    assert.equal(Array.isArray(response), true);
    assert.equal(response[0].request_id, 'pending-id');
    assert.equal('provider' in response[0], false);
    assert.equal(JSON.stringify(response).includes('qwen'), false);
});

test('QB-16 transport exception is sanitized and does not expose local paths', async () => {
    const ipc = createIpc();

    register({
        appImpl: { getPath: () => '/tmp/orbi' },
        ipcMainImpl: ipc,
        assertTrustedSenderImpl: () => {},
        randomUUIDImpl: () => 'main-id',
        resolveConfigImpl: () => ({
            enabled: true,
            mode: 'native',
            command: '/private/python',
            args: [],
            cwd: '/private',
            ledgerPath: '/private/ledger.sqlite3',
        }),
        createClientImpl: () => ({
            request: async () => {
                const error = new Error('spawn /private/python ENOENT');
                error.code = 'SCENE3D_SIDECAR_START_FAILED';
                throw error;
            },
            close() {},
            isStarted: () => false,
        }),
    });

    const response = await ipc.handlers.get(CHANNELS.sceneInfo)({});

    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'SCENE3D_SIDECAR_START_FAILED');
    assert.equal(response.error.message, 'Scene3D sidecar failed to start');
    assert.equal(JSON.stringify(response).includes('/private'), false);
});


test('QB-18 enabled pilot remains read-only when execution authority is OFF', async () => {
    const harness = createHarness({ enabled: true, executionEnabled: false });

    const status = await harness.invoke(CHANNELS.status);
    assert.equal(status.ok, true);
    assert.equal(status.status.enabled, true);
    assert.equal(status.status.executionEnabled, false);

    const scene = await harness.invoke(CHANNELS.sceneInfo);
    assert.equal(scene.ok, true);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0].operation, 'scene_info');

    const dry = await harness.invoke(CHANNELS.dryRunRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
    });
    const execute = await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
    });

    assert.equal(dry.ok, false);
    assert.equal(dry.error.code, 'SCENE3D_EXECUTION_DISABLED');
    assert.equal(execute.ok, false);
    assert.equal(execute.error.code, 'SCENE3D_EXECUTION_DISABLED');
    assert.equal(harness.requests.length, 1);
});

test('QB-18 execution-disabled calls do not create or start the sidecar client', async () => {
    const harness = createHarness({ enabled: true, executionEnabled: false });

    const dry = await harness.invoke(CHANNELS.dryRunRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
    });
    const execute = await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
    });

    assert.equal(dry.error.code, 'SCENE3D_EXECUTION_DISABLED');
    assert.equal(execute.error.code, 'SCENE3D_EXECUTION_DISABLED');
    assert.equal(harness.createClientCalls, 0);
    assert.equal(harness.requests.length, 0);
});

test('QB-18 execution authority must be resolved in main and is never renderer supplied', () => {
    const bridge = require('node:fs').readFileSync('electron/lib/scene3dPilotBridge.js', 'utf8');
    const preload = require('node:fs').readFileSync('electron/preload.js', 'utf8');

    assert.ok(bridge.includes('config.executionEnabled'));
    assert.ok(bridge.includes('SCENE3D_EXECUTION_DISABLED'));
    assert.equal(preload.includes('setExecutionEnabled'), false);
    assert.equal(preload.includes('ORBI_SCENE3D_EXECUTION_ENABLED'), false);
});


test('QB-19 execute without reviewed token is rejected before sidecar dispatch', async () => {
    const harness = createHarness();

    const response = await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube' },
        confirmed: true,
    });

    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'SCENE3D_PILOT_REQUEST_INVALID');
    assert.equal(harness.requests.length, 0);
    assert.equal(harness.consumedReviews.length, 0);
});

test('QB-19 reviewed execution consumes token before dispatch and never forwards token', async () => {
    const harness = createHarness();

    const dry = await harness.invoke(CHANNELS.dryRunRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
    });
    assert.equal(dry.ok, true);
    assert.equal(dry.review.token, 'review-1');

    const execute = await harness.invoke(CHANNELS.executeRecipe, {
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
        confirmed: true,
        reviewToken: dry.review.token,
    });

    assert.equal(execute.ok, true);
    assert.equal(harness.consumedReviews.length, 1);
    assert.deepEqual(harness.consumedReviews[0], {
        token: 'review-1',
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
    });

    assert.equal(harness.requests.length, 2);
    assert.equal(harness.requests[0].operation, 'dry_run_recipe');
    assert.equal(harness.requests[1].operation, 'execute_recipe');
    assert.deepEqual(harness.requests[1].input, {
        recipe_id: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
    });
    assert.equal('reviewToken' in harness.requests[1].input, false);
    assert.equal('confirmed' in harness.requests[1].input, false);
});

test('QB-19 review registry failure prevents execution sidecar request', async () => {
    const ipc = createIpc();
    const requests = [];

    register({
        appImpl: { getPath: () => '/tmp/orbi' },
        ipcMainImpl: ipc,
        assertTrustedSenderImpl: () => {},
        randomUUIDImpl: () => 'request-id',
        createClientImpl: () => ({
            request: async (operation, input, options) => {
                requests.push({ operation, input, options });
                return {
                    protocol: 'orbi.scene3d-sidecar/v1',
                    id: 'transport',
                    ok: true,
                    result: providerResult({
                        requestId: options.requestId,
                        operation: 'execute_recipe',
                    }),
                };
            },
            close() {},
            isStarted: () => true,
        }),
        createReviewRegistryImpl: () => ({
            issue() {
                throw new Error('not used');
            },
            consume() {
                const error = new Error('payload mismatch');
                error.code = 'SCENE3D_REVIEW_MISMATCH';
                throw error;
            },
            invalidateAll() {},
        }),
        resolveConfigImpl: () => ({
            enabled: true,
            executionEnabled: true,
            mode: 'native',
            command: '/opt/python',
            args: [],
            cwd: '/opt',
            ledgerPath: '/private/ledger.sqlite3',
        }),
        diagnostic: () => {},
    });

    const response = await ipc.handlers.get(CHANNELS.executeRecipe)(
        {},
        {
            recipeId: 'orbi.blender.create_cube.v1',
            parameters: { name: 'Changed' },
            confirmed: true,
            reviewToken: 'review-token',
        },
    );

    assert.equal(response.ok, false);
    assert.equal(response.error.code, 'SCENE3D_REVIEW_MISMATCH');
    assert.equal(response.error.message, 'Scene3D execution differs from the reviewed dry-run');
    assert.equal(requests.length, 0);
});

test('QB-19 shutdown invalidates outstanding review capabilities', () => {
    const ipc = createIpc();
    let invalidated = 0;

    const registration = register({
        appImpl: { getPath: () => '/tmp/orbi' },
        ipcMainImpl: ipc,
        assertTrustedSenderImpl: () => {},
        createReviewRegistryImpl: () => ({
            issue() { return {}; },
            consume() { return {}; },
            invalidateAll() { invalidated += 1; },
        }),
        resolveConfigImpl: () => ({
            enabled: true,
            executionEnabled: true,
            mode: 'native',
            command: '/opt/python',
            args: [],
            cwd: '/opt',
            ledgerPath: '/private/ledger.sqlite3',
        }),
        diagnostic: () => {},
    });

    registration.shutdown();
    assert.equal(invalidated, 1);
});
