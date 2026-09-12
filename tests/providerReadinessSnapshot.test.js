const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildProviderReadinessSnapshot,
    canProbeMuapiHealth,
} = require('../electron/lib/providerReadinessSnapshotCore');

async function readiness() {
    return import('../src/lib/computeRouter/providerReadiness.mjs');
}

function sampleSnapshot() {
    return buildProviderReadinessSnapshot({
        sdcppEvidence: {
            binaryStatus: {
                exists: true,
                path: '/private/orbi/sd-cli',
                runtime: { sha256: 'should-not-cross-ipc' },
            },
            models: [
                {
                    id: 'z-image-turbo',
                    provider: 'sdcpp',
                    state: 'downloaded',
                    path: '/private/models/z-image.gguf',
                    downloadUrl: 'https://example.invalid/model',
                    requiresAuxiliary: true,
                    auxiliaryStatus: {
                        llm: 'downloaded',
                        vae: 'downloaded',
                        internal: 'drop-me',
                    },
                },
            ],
        },
        wan2gpEvidence: {
            config: {
                configured: true,
                url: 'http://192.168.1.50:7860',
            },
            probe: {
                ok: true,
                error: 'drop-me',
                apiNames: ['private-endpoint'],
            },
            models: [
                {
                    id: 'wan2gp:wan22-t2v',
                    provider: 'wan2gp',
                    ready: true,
                    fn: 'private-fn',
                },
            ],
        },
        muapiCredentialReadiness: {
            available: true,
            secure: true,
            hasSecret: true,
            storeState: 'ready',
            backend: 'os-protected',
            ciphertext: 'never-cross-ipc',
        },
        muapiTransportHealth: {
            ok: true,
            status: 200,
            balance: 999999,
            rawBody: 'never-cross-ipc',
        },
        hardwareSnapshot: {
            platform: 'win32',
            arch: 'x64',
            cpu: {
                model: 'Ryzen Test',
                logicalCores: 16,
                speedMHz: 4200,
            },
            memory: {
                totalMiB: 32768,
                freeMiB: 12000,
            },
            accelerators: {
                nvidia: {
                    available: true,
                    gpus: [
                        {
                            name: 'Private GPU Name',
                            memoryTotalMiB: 12288,
                            driverVersion: 'private-driver',
                        },
                    ],
                },
                cudaToolkit: {
                    available: true,
                    version: '12.4',
                },
                vulkan: {
                    available: true,
                    summaryObserved: true,
                },
                rocm: {
                    available: false,
                },
            },
            probePolicy: {
                commandTimeoutMs: 2500,
            },
            secretRawProbeOutput: 'never-cross-ipc',
        },
    });
}

test('readiness snapshot carries only routing-safe facts', () => {
    const snapshot = sampleSnapshot();
    const serialized = JSON.stringify(snapshot);

    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.sdcpp.binaryStatus.exists, true);
    assert.equal(snapshot.sdcpp.models[0].id, 'z-image-turbo');
    assert.deepEqual(snapshot.sdcpp.models[0].auxiliaryStatus, {
        llm: 'downloaded',
        vae: 'downloaded',
    });

    assert.deepEqual(snapshot.wan2gp.config, { configured: true });
    assert.deepEqual(snapshot.wan2gp.probe, { ok: true });
    assert.deepEqual(snapshot.wan2gp.models[0], {
        id: 'wan2gp:wan22-t2v',
        provider: 'wan2gp',
        ready: true,
    });

    assert.deepEqual(snapshot.muapi.credentialReadiness, {
        available: true,
        secure: true,
        hasSecret: true,
        storeState: 'ready',
    });
    assert.deepEqual(snapshot.muapi.transportHealth, {
        ok: true,
        status: 200,
    });

    assert.equal(snapshot.sdcpp.hardwareSnapshot.accelerators.nvidia.gpus[0].memoryTotalMiB, 12288);
    assert.equal(serialized.includes('/private/'), false);
    assert.equal(serialized.includes('192.168.1.50'), false);
    assert.equal(serialized.includes('ciphertext'), false);
    assert.equal(serialized.includes('private-driver'), false);
    assert.equal(serialized.includes('secretRawProbeOutput'), false);
    assert.equal(serialized.includes('apiNames'), false);
    assert.equal(serialized.includes('999999'), false);
    assert.equal(serialized.includes('rawBody'), false);
});

test('snapshot plugs into P1B.3 readiness composition without generation wiring', async () => {
    const { composeCurrentProviderReadiness } = await readiness();
    const providers = composeCurrentProviderReadiness(sampleSnapshot());

    const sdcpp = providers.find((provider) => provider.id === 'sdcpp-device');
    const wan2gp = providers.find((provider) => provider.id === 'wan2gp-lan');
    const muapi = providers.find((provider) => provider.id === 'muapi-cloud');

    assert.equal(sdcpp.health, 'ready');
    assert.deepEqual(
        sdcpp.capabilities.map((capability) => capability.modelId),
        ['z-image-turbo'],
    );
    assert.equal(sdcpp.capabilities[0].hardware.nvidiaMaxVramMiB, 12288);

    assert.equal(wan2gp.health, 'ready');
    assert.deepEqual(
        wan2gp.capabilities.map((capability) => capability.modelId),
        ['wan2gp:wan22-t2v'],
    );

    assert.equal(muapi.credentials, 'available');
    assert.equal(muapi.health, 'ready');
});

test('explicitly unconfigured Wan2GP remains fail-closed', async () => {
    const { composeWan2gpReadiness } = await readiness();
    const snapshot = buildProviderReadinessSnapshot({
        wan2gpEvidence: {
            config: { configured: false },
        },
    });

    assert.equal(
        composeWan2gpReadiness(snapshot.wan2gp).health,
        'misconfigured',
    );
});

test('readiness snapshot is immutable at its routing boundary', () => {
    const snapshot = sampleSnapshot();
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.sdcpp), true);
    assert.equal(Object.isFrozen(snapshot.wan2gp), true);
    assert.equal(Object.isFrozen(snapshot.muapi), true);
});


test('MuAPI health probe eligibility requires secure usable credential readiness', () => {
    assert.equal(canProbeMuapiHealth({
        available: true,
        secure: true,
        hasSecret: true,
        storeState: 'ready',
    }), true);

    for (const readiness of [
        undefined,
        { available: false, secure: true, hasSecret: true, storeState: 'ready' },
        { available: true, secure: false, hasSecret: true, storeState: 'ready' },
        { available: true, secure: true, hasSecret: false, storeState: 'ready' },
        { available: true, secure: true, hasSecret: true, storeState: 'corrupt' },
    ]) {
        assert.equal(canProbeMuapiHealth(readiness), false);
    }
});
