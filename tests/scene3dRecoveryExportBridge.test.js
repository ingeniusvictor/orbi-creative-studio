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

function harness({
    enabled = true,
    pendingResponse = { protocol: 'orbi.scene3d-sidecar/v1', id: 'p', ok: true, result: [] },
    historyResponse = { protocol: 'orbi.scene3d-sidecar/v1', id: 'h', ok: true, result: [] },
} = {}) {
    const ipc = createIpc();
    const sidecarRequests = [];
    const exportCalls = [];
    let trusted = 0;

    const client = {
        async request(operation, input) {
            sidecarRequests.push({ operation, input });
            if (operation === 'pending_recoveries') return pendingResponse;
            if (operation === 'reconciliation_history') return historyResponse;
            throw new Error('unexpected operation');
        },
        close() {},
        isStarted: () => sidecarRequests.length > 0,
    };

    register({
        appImpl: { getPath: () => '/tmp/orbi' },
        ipcMainImpl: ipc,
        env: {},
        assertTrustedSenderImpl: () => {
            trusted += 1;
        },
        randomUUIDImpl: () => 'main-id',
        createClientImpl: () => client,
        resolveConfigImpl: () => ({
            enabled,
            mode: enabled ? 'native' : 'disabled',
            command: enabled ? '/opt/python' : null,
            args: [],
            cwd: null,
            ledgerPath: enabled ? '/private/ledger.sqlite3' : null,
        }),
        exportRecoveryEvidenceImpl: async (snapshot) => {
            exportCalls.push(snapshot);
            return {
                status: 'SCENE3D_RECOVERY_EXPORT_WRITTEN',
                reason: null,
                fileName: 'recovery.json',
                sha256: 'a'.repeat(64),
                bytes: 100,
                readOnlyEvidence: true,
                executionAuthorized: false,
                retryAuthorized: false,
                reconciliationAuthorized: false,
                requestIdReleaseAuthorized: false,
                productionCutoverAuthorized: false,
            };
        },
        clockImpl: () => new Date('2026-09-23T05:20:00.000Z'),
        diagnostic: () => {},
    });

    async function invoke(...args) {
        return ipc.handlers.get(CHANNELS.recoveryExport)({}, ...args);
    }

    return {
        invoke,
        sidecarRequests,
        exportCalls,
        get trusted() { return trusted; },
    };
}

test('QB-19 recovery export channel is namespaced and trusted', async () => {
    assert.equal(CHANNELS.recoveryExport, 'orbi-scene3d:recovery-export');

    const h = harness();
    await h.invoke();

    assert.equal(h.trusted, 1);
});

test('QB-19 disabled pilot cannot capture or export recovery evidence', async () => {
    const h = harness({ enabled: false });

    const result = await h.invoke();

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SCENE3D_PILOT_DISABLED');
    assert.deepEqual(h.sidecarRequests, []);
    assert.deepEqual(h.exportCalls, []);
});

test('QB-19 Electron main captures fresh pending/history and owns capture time', async () => {
    const pending = [{
        sequence: 1,
        request_id: 'pending-1',
        outcome: 'pending',
        provider_called: null,
        replay_reserved: true,
    }];
    const history = [{
        reconciliation_sequence: 2,
        request_id: 'pending-1',
        resolution: 'inconclusive',
        actor: 'operator',
        final: false,
        reservation_released: false,
    }];

    const h = harness({
        pendingResponse: {
            protocol: 'orbi.scene3d-sidecar/v1',
            id: 'p',
            ok: true,
            result: pending,
        },
        historyResponse: {
            protocol: 'orbi.scene3d-sidecar/v1',
            id: 'h',
            ok: true,
            result: history,
        },
    });

    const result = await h.invoke({ forged: 'renderer-payload-must-be-ignored' });

    assert.equal(result.status, 'SCENE3D_RECOVERY_EXPORT_WRITTEN');
    assert.deepEqual(h.sidecarRequests, [
        { operation: 'pending_recoveries', input: {} },
        { operation: 'reconciliation_history', input: {} },
    ]);
    assert.deepEqual(h.exportCalls, [{
        capturedAt: '2026-09-23T05:20:00.000Z',
        pending,
        history,
    }]);
});

test('QB-19 unavailable source blocks export plan/write', async () => {
    const h = harness({
        pendingResponse: {
            protocol: 'orbi.scene3d-sidecar/v1',
            id: 'p',
            ok: false,
            error: { code: 'SOURCE_FAILED', message: 'internal path' },
        },
    });

    const result = await h.invoke();

    assert.equal(result.status, 'SCENE3D_RECOVERY_EXPORT_REJECTED');
    assert.equal(result.reason, 'SCENE3D_RECOVERY_EXPORT_SOURCE_UNAVAILABLE');
    assert.deepEqual(h.exportCalls, []);
});

test('QB-19 preload exposes no-argument export and no path/payload variant', () => {
    const fs = require('node:fs');
    const preload = fs.readFileSync('electron/preload.js', 'utf8');

    assert.ok(preload.includes(
        "exportRecoveryEvidence: () =>\n        ipcRenderer.invoke('orbi-scene3d:recovery-export')"
    ));
    assert.equal(preload.includes('exportRecoveryEvidence: (path'), false);
    assert.equal(preload.includes('exportRecoveryEvidence: (payload'), false);
    assert.equal(preload.includes("ipcRenderer.invoke('orbi-scene3d:recovery-export',"), false);
});
