const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const {
    PROTOCOL,
    createScene3DSidecarClient,
} = require('../electron/lib/scene3dSidecarClient');

function createFakeChild() {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.killCalls = 0;
    child.kill = () => {
        child.killed = true;
        child.killCalls += 1;
        child.emit('exit', null, 'SIGTERM');
    };
    return child;
}

function createHarness({ timeoutMs = 100 } = {}) {
    const children = [];
    const spawnCalls = [];
    let id = 0;

    const spawnImpl = (command, args, options) => {
        const child = createFakeChild();
        children.push(child);
        spawnCalls.push({ command, args, options });
        return child;
    };

    const client = createScene3DSidecarClient({
        config: {
            enabled: true,
            mode: 'native',
            command: '/opt/python',
            args: ['/opt/sidecar.py', '--ledger', '/tmp/ledger.sqlite3'],
            cwd: '/opt',
        },
        spawnImpl,
        randomUUIDImpl: () => `transport-${++id}`,
        timeoutMs,
    });

    return { client, children, spawnCalls };
}

function respondToNext(child, mutate = (x) => x) {
    return new Promise((resolve) => {
        child.stdin.once('data', (chunk) => {
            const request = JSON.parse(chunk.toString('utf8').trim());
            const response = mutate({
                protocol: PROTOCOL,
                id: request.id,
                ok: true,
                result: { echo: request },
            });
            child.stdout.write(JSON.stringify(response) + '\n');
            resolve(request);
        });
    });
}

test('QB-16 sidecar client is lazy and spawns without shell', async () => {
    const { client, children, spawnCalls } = createHarness();
    assert.equal(client.isStarted(), false);
    assert.equal(spawnCalls.length, 0);

    const requestPromise = client.request('status', {});
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, '/opt/python');
    assert.deepEqual(spawnCalls[0].args, [
        '/opt/sidecar.py',
        '--ledger',
        '/tmp/ledger.sqlite3',
    ]);
    assert.equal(spawnCalls[0].options.shell, false);
    assert.equal(client.isStarted(), true);

    const observed = respondToNext(children[0]);
    const [response, request] = await Promise.all([requestPromise, observed]);

    assert.equal(response.ok, true);
    assert.equal(request.protocol, PROTOCOL);
});

test('QB-16 sidecar client preserves main-generated request id', async () => {
    const { client, children } = createHarness();

    const promise = client.request(
        'execute_recipe',
        { recipe_id: 'orbi.blender.create_cube.v1', parameters: {} },
        { requestId: 'main-owned-request-id' },
    );
    const observed = respondToNext(children[0]);
    const [response, request] = await Promise.all([promise, observed]);

    assert.equal(response.ok, true);
    assert.equal(request.request_id, 'main-owned-request-id');
});

test('QB-16 sidecar client reuses one process for multiple requests', async () => {
    const { client, children, spawnCalls } = createHarness();

    const first = client.request('status', {});
    const observed1 = respondToNext(children[0]);
    await Promise.all([first, observed1]);

    const second = client.request('status', {});
    const observed2 = respondToNext(children[0]);
    await Promise.all([second, observed2]);

    assert.equal(spawnCalls.length, 1);
});

test('QB-16 sidecar timeout does not retry or spawn another process', async () => {
    const { client, children, spawnCalls } = createHarness({ timeoutMs: 10 });
    let writes = 0;

    const promise = client.request(
        'execute_recipe',
        { recipe_id: 'orbi.blender.create_cube.v1', parameters: {} },
        { requestId: 'timeout-id' },
    );
    children[0].stdin.on('data', () => {
        writes += 1;
    });

    await assert.rejects(
        promise,
        (error) => error && error.code === 'SCENE3D_SIDECAR_TIMEOUT',
    );

    assert.equal(spawnCalls.length, 1);
    assert.equal(writes, 1);
    assert.equal(client.automaticRetry, false);
});

test('QB-16 invalid sidecar JSON rejects pending requests', async () => {
    const { client, children } = createHarness();

    const promise = client.request('scene_info', {}, { requestId: 'read-id' });
    children[0].stdin.once('data', () => {
        children[0].stdout.write('not-json\n');
    });

    await assert.rejects(
        promise,
        (error) => error && error.code === 'SCENE3D_SIDECAR_PROTOCOL_ERROR',
    );
});

test('QB-16 unmatched response does not resolve another request', async () => {
    const diagnostics = [];
    const child = createFakeChild();

    const client = createScene3DSidecarClient({
        config: {
            enabled: true,
            command: '/opt/python',
            args: ['/opt/sidecar.py'],
            cwd: '/opt',
        },
        spawnImpl: () => child,
        randomUUIDImpl: () => 'expected-id',
        timeoutMs: 20,
        onDiagnostic: (value) => diagnostics.push(value),
    });

    const promise = client.request('status', {});
    child.stdin.once('data', () => {
        child.stdout.write(JSON.stringify({
            protocol: PROTOCOL,
            id: 'wrong-id',
            ok: true,
            result: {},
        }) + '\n');
    });

    await assert.rejects(
        promise,
        (error) => error && error.code === 'SCENE3D_SIDECAR_TIMEOUT',
    );
    assert.ok(diagnostics.some((item) => item.includes('wrong-id')));
});

test('QB-16 close uses stdin EOF rather than force-killing healthy sidecar', async () => {
    const { client, children } = createHarness();

    const promise = client.request('status', {});
    const observed = respondToNext(children[0]);
    await Promise.all([promise, observed]);

    let ended = false;
    children[0].stdin.once('finish', () => {
        ended = true;
    });

    client.close();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(ended, true);
    assert.equal(children[0].killCalls, 0);
});

test('QB-16 client rejects outbound messages above the bounded size without spawn', async () => {
    const { client, spawnCalls } = createHarness();

    await assert.rejects(
        client.request('execute_recipe', {
            recipe_id: 'orbi.blender.create_cube.v1',
            parameters: { huge: 'x'.repeat(300000) },
        }, { requestId: 'too-large' }),
        (error) => error && error.code === 'SCENE3D_REQUEST_TOO_LARGE',
    );

    assert.equal(spawnCalls.length, 0);
});
