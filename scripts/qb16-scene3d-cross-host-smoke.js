'use strict';

const { randomUUID } = require('node:crypto');

const {
    resolveScene3DPilotConfig,
} = require('../electron/lib/scene3dPilotConfig');
const {
    createScene3DSidecarClient,
} = require('../electron/lib/scene3dSidecarClient');

const NAME = 'ORBI_QB16_Cube';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function unwrap(response, label) {
    assert(response && response.ok === true, `${label}: sidecar transport failed: ${JSON.stringify(response)}`);
    return response.result;
}

async function main() {
    const config = resolveScene3DPilotConfig({
        env: process.env,
        userDataPath: process.env.APPDATA || process.cwd(),
        platform: process.platform,
    });

    assert(config.enabled, 'Set ORBI_SCENE3D_PILOT_ENABLED=1 for the QB-16 smoke');
    assert(['native', 'wsl'].includes(config.mode), 'QB-16 smoke requires native or wsl launch mode');

    const diagnostics = [];
    const client = createScene3DSidecarClient({
        config,
        onDiagnostic: (message) => {
            diagnostics.push(String(message));
            process.stderr.write(String(message));
        },
    });

    let created = false;

    try {
        console.log('=== QB-16 SIDECAR STATUS ===');
        const status = unwrap(await client.request('status', {}), 'status');
        console.log(status);
        assert(status.transport === 'stdio-jsonl', 'unexpected sidecar transport');
        assert(status.public_listener === false, 'sidecar must not expose a public listener');
        assert(status.automatic_r2_retry === false, 'R2 automatic retry must be disabled');

        console.log('\n=== QB-16 PREEXISTING OBJECT GUARD ===');
        const pre = unwrap(await client.request(
            'object_info',
            { object_name: NAME },
            { requestId: randomUUID() },
        ), 'precheck');
        console.log(pre);
        assert(pre.ok === false, `${NAME} already exists; refusing to touch it`);
        assert(
            pre.error && String(pre.error.message).includes('Object not found'),
            'precheck failed for an unexpected reason',
        );

        const recipe = {
            recipe_id: 'orbi.blender.create_cube.v1',
            parameters: {
                name: NAME,
                size: 1.0,
                location: [7.0, 0.0, 0.5],
            },
        };

        console.log('\n=== QB-16 CROSS-HOST DRY RUN ===');
        const dry = unwrap(await client.request(
            'dry_run_recipe',
            recipe,
            { requestId: randomUUID() },
        ), 'dry-run');
        console.log(dry);
        assert(dry.ok === true, 'dry-run ORBI request failed');
        assert(dry.data && dry.data.execution === 'dry-run', 'dry-run did not remain dry');
        assert(dry.audit && dry.audit.provider_called === false, 'dry-run reached provider');

        console.log('\n=== QB-16 CROSS-HOST GOVERNED CREATE ===');
        const createRequestId = randomUUID();
        const create = unwrap(await client.request(
            'execute_recipe',
            recipe,
            { requestId: createRequestId },
        ), 'create');
        console.log(create);
        assert(create.ok === true, 'governed create failed');
        assert(create.request_id === createRequestId, 'main-owned request id was not preserved');
        assert(create.audit && create.audit.provider_called === true, 'provider call evidence missing');
        created = true;

        console.log('\n=== QB-16 CROSS-HOST OBJECT READ ===');
        const object = unwrap(await client.request(
            'object_info',
            { object_name: NAME },
            { requestId: randomUUID() },
        ), 'object-info');
        console.log(object);
        assert(object.ok === true, 'created object cannot be read');
        assert(object.data && object.data[0] && object.data[0].text.includes(NAME), 'object name missing');
        assert(object.data[0].text.includes('MESH'), 'object is not a Blender MESH');

        console.log('\n=== QB-16 RECOVERY INSPECTION ===');
        const pending = unwrap(await client.request('pending_recoveries', {}), 'pending');
        const history = unwrap(await client.request('reconciliation_history', {}), 'history');
        console.log({ pending, history });
        assert(Array.isArray(pending), 'pending recovery result must be an array');
        assert(Array.isArray(history), 'reconciliation history must be an array');

    } finally {
        if (created) {
            console.log('\n=== QB-16 CROSS-HOST CLEANUP ===');
            const cleanup = unwrap(await client.request(
                'execute_recipe',
                {
                    recipe_id: 'orbi.blender.delete_object.v1',
                    parameters: { name: NAME },
                },
                { requestId: randomUUID() },
            ), 'cleanup');
            console.log(cleanup);
            assert(cleanup.ok === true, 'cleanup failed');
        }

        client.close();
    }

    console.log('\nQB-16 CROSS-HOST SCENE3D PILOT BRIDGE: PASS');
    return 0;
}

main().then(
    () => process.exitCode = 0,
    (error) => {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    },
);
