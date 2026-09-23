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

function createHarness({ enabled = true, responses = [] } = {}) {
    const ipc = createIpc();
    const requests = [];
    let createClientCalls = 0;
    let trustedCalls = 0;
    let uuid = 0;

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
        resolveConfigImpl: () => ({
            enabled,
            mode: enabled ? 'native' : 'disabled',
            command: enabled ? '/opt/python' : null,
            args: [],
            cwd: null,
            ledgerPath: enabled ? '/private/ledger.sqlite3' : null,
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
