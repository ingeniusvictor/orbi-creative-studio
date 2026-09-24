'use strict';

const path = require('node:path');

const {
    CHANNELS,
    register,
} = require('../electron/lib/scene3dPilotBridge');

const NAME = 'ORBI_QB21_Cube';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createIpcHarness() {
    const handlers = new Map();
    return {
        handlers,
        removeHandler(channel) {
            handlers.delete(channel);
        },
        handle(channel, handler) {
            handlers.set(channel, handler);
        },
        async invoke(channel, ...args) {
            const handler = handlers.get(channel);
            assert(typeof handler === 'function', `Missing IPC handler: ${channel}`);
            return handler(
                { senderFrame: {}, sender: { mainFrame: {} } },
                ...args,
            );
        },
    };
}

async function main() {
    const ipc = createIpcHarness();
    const userDataPath = process.env.APPDATA
        || process.env.XDG_CONFIG_HOME
        || path.join(process.cwd(), '.qb21-user-data');

    const registration = register({
        appImpl: {
            getPath(name) {
                assert(name === 'userData', 'QB-21 expected Electron userData path request');
                return userDataPath;
            },
        },
        env: process.env,
        ipcMainImpl: ipc,
        assertTrustedSenderImpl: () => {},
        diagnostic: (message) => process.stderr.write(String(message)),
    });

    let created = false;

    try {
        console.log('=== QB-21 STATUS ===');
        const status = await ipc.invoke(CHANNELS.status);
        console.log(status);
        assert(status.ok === true, 'Scene3D status failed');
        assert(status.status.enabled === true, 'Scene3D pilot must be enabled');
        assert(status.status.executionEnabled === true, 'Scene3D execution authority must be enabled');
        assert(status.status.automaticR2Retry === false, 'R2 automatic retry must remain disabled');
        assert(status.status.processStarted === false, 'status must not pre-start the sidecar');

        console.log('\n=== QB-21 PREEXISTING OBJECT GUARD ===');
        const pre = await ipc.invoke(CHANNELS.objectInfo, NAME);
        console.log(pre);
        assert(pre.ok === false, `${NAME} already exists; refusing to touch it`);
        assert(
            pre.error && String(pre.error.message).includes('Scene3D provider operation failed'),
            'Precheck failed for an unexpected reason',
        );

        const createPayload = {
            recipeId: 'orbi.blender.create_cube.v1',
            parameters: {
                name: NAME,
                size: 1.0,
                location: [8.0, 0.0, 0.5],
            },
        };

        console.log('\n=== QB-21 DRY RUN + REVIEW ===');
        const dry = await ipc.invoke(CHANNELS.dryRunRecipe, createPayload);
        console.log(dry);
        assert(dry.ok === true, 'dry-run failed');
        assert(dry.data && dry.data.execution === 'dry-run', 'dry-run did not remain dry');
        assert(dry.data.providerCalled === false, 'dry-run reached provider execution');
        assert(dry.review && typeof dry.review.token === 'string', 'review token missing');
        assert(dry.review.oneShot === true, 'review token is not one-shot');
        assert(typeof dry.review.fingerprint === 'string' && dry.review.fingerprint.length === 64, 'review fingerprint missing');

        console.log('\n=== QB-21 MUTATION AFTER REVIEW MUST FAIL ===');
        const mismatch = await ipc.invoke(CHANNELS.executeRecipe, {
            recipeId: createPayload.recipeId,
            parameters: {
                ...createPayload.parameters,
                size: 2.0,
            },
            confirmed: true,
            reviewToken: dry.review.token,
        });
        console.log(mismatch);
        assert(mismatch.ok === false, 'mutated reviewed payload unexpectedly executed');
        assert(mismatch.error && mismatch.error.code === 'SCENE3D_REVIEW_MISMATCH', 'expected review mismatch');

        const afterMismatch = await ipc.invoke(CHANNELS.objectInfo, NAME);
        console.log(afterMismatch);
        assert(afterMismatch.ok === false, 'mismatch unexpectedly created the object');

        console.log('\n=== QB-21 CONSUMED TOKEN MUST NOT BE REUSABLE ===');
        const reused = await ipc.invoke(CHANNELS.executeRecipe, {
            ...createPayload,
            confirmed: true,
            reviewToken: dry.review.token,
        });
        console.log(reused);
        assert(reused.ok === false, 'consumed review token was reusable');
        assert(reused.error && reused.error.code === 'SCENE3D_REVIEW_REQUIRED', 'expected consumed-token denial');

        console.log('\n=== QB-21 FRESH REVIEW + GOVERNED CREATE ===');
        const dry2 = await ipc.invoke(CHANNELS.dryRunRecipe, createPayload);
        console.log(dry2);
        assert(dry2.ok === true && dry2.review?.token, 'fresh dry-run review failed');

        const create = await ipc.invoke(CHANNELS.executeRecipe, {
            ...createPayload,
            confirmed: true,
            reviewToken: dry2.review.token,
        });
        console.log(create);
        assert(create.ok === true, 'reviewed governed create failed');
        assert(create.data && create.data.execution === 'executed', 'create did not execute');
        assert(create.audit && create.audit.provider_called === true, 'provider-call audit missing');
        created = true;

        console.log('\n=== QB-21 LIVE READ-BACK ===');
        const object = await ipc.invoke(CHANNELS.objectInfo, NAME);
        console.log(object);
        assert(object.ok === true, 'created object is not readable');
        assert(object.data && object.data[0] && object.data[0].text.includes(NAME), 'object name missing from read-back');
        assert(object.data[0].text.includes('MESH'), 'created object is not a MESH');

        console.log('\n=== QB-21 RECOVERY INSPECTION ===');
        const pending = await ipc.invoke(CHANNELS.pendingRecoveries);
        const history = await ipc.invoke(CHANNELS.reconciliationHistory);
        console.log({ pending, history });
        assert(Array.isArray(pending), 'pending recovery result must be an array');
        assert(Array.isArray(history), 'reconciliation history must be an array');

    } finally {
        if (created) {
            console.log('\n=== QB-21 GOVERNED DELETE REVIEW ===');
            const deletePayload = {
                recipeId: 'orbi.blender.delete_object.v1',
                parameters: { name: NAME },
            };

            const dryDelete = await ipc.invoke(CHANNELS.dryRunRecipe, deletePayload);
            console.log(dryDelete);
            assert(dryDelete.ok === true && dryDelete.review?.token, 'delete dry-run review failed');

            const cleanup = await ipc.invoke(CHANNELS.executeRecipe, {
                ...deletePayload,
                confirmed: true,
                reviewToken: dryDelete.review.token,
            });
            console.log(cleanup);
            assert(cleanup.ok === true, 'governed cleanup failed');
        }

        registration.shutdown();
    }

    console.log('\n=== QB-21 POST-CLEANUP PROCESS RESTART READ-BACK ===');

    // New registration proves review capabilities are in-memory/ephemeral while durable
    // execution history remains in the QB-15/QB-12 ledger.
    const ipc2 = createIpcHarness();
    const registration2 = register({
        appImpl: {
            getPath() {
                return userDataPath;
            },
        },
        env: process.env,
        ipcMainImpl: ipc2,
        assertTrustedSenderImpl: () => {},
        diagnostic: (message) => process.stderr.write(String(message)),
    });

    try {
        const gone = await ipc2.invoke(CHANNELS.objectInfo, NAME);
        console.log(gone);
        assert(gone.ok === false, 'QB-21 cleanup did not remove the object');

        const finalStatus = await ipc2.invoke(CHANNELS.status);
        console.log(finalStatus);
        assert(finalStatus.ok === true, 'final status failed');
        assert(finalStatus.status.automaticR2Retry === false, 'automatic R2 retry changed');
    } finally {
        registration2.shutdown();
    }

    console.log('\nQB-21 GOVERNED SCENE3D END-TO-END: PASS');
    return 0;
}

main().then(
    () => {
        process.exitCode = 0;
    },
    (error) => {
        console.error(error && error.stack ? error.stack : error);
        process.exitCode = 1;
    },
);
