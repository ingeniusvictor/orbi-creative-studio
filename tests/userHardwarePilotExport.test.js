const test = require('node:test');
const assert = require('node:assert/strict');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const READY_BUNDLE_RESULT = Object.freeze({
    schemaVersion: 1,
    evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
    status: 'HARDWARE_PILOT_EVIDENCE_READY',
    reason: null,
    target: TARGET,
    bundle: Object.freeze({ evidenceType: 'opaque-test-bundle' }),
    pilotEvidenceOnly: true,
    requiresHumanReview: true,
    productionProfilePromoted: false,
    routingEligible: false,
    cutoverAuthorized: false,
    executionAuthority: 'legacy-dispatcher-only',
});

async function loadModule() {
    return import('../src/lib/computeRouter/userHardwarePilotExport.mjs');
}

test('P1C64 exports a ready hardware pilot through the narrow Electron benchmark bridge', async () => {
    const mod = await loadModule();
    const bridgeCalls = [];

    const result = await mod.exportUserHardwarePilotEvidence(TARGET, {
        buildBundle: () => READY_BUNDLE_RESULT,
        getBridge: () => ({
            isElectron: true,
            exportPilotBundle: async (bundle) => {
                bridgeCalls.push(bundle);
                return {
                    status: 'HARDWARE_PILOT_EXPORT_WRITTEN',
                    reason: null,
                    fileName: 'orbi-hardware-pilot-z-image-turbo.json',
                    sha256: 'a'.repeat(64),
                    bytes: 1234,
                    routingEligible: false,
                    cutoverAuthorized: false,
                    executionAuthority: 'legacy-dispatcher-only',
                };
            },
        }),
    });

    assert.equal(result.status, 'USER_HARDWARE_PILOT_EXPORT_WRITTEN');
    assert.equal(result.reason, null);
    assert.deepEqual(result.context, TARGET);
    assert.equal(result.summary.fileName, 'orbi-hardware-pilot-z-image-turbo.json');
    assert.equal(result.summary.sha256, 'a'.repeat(64));
    assert.equal(result.summary.bytes, 1234);
    assert.equal(result.exportOnly, true);
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
    assert.deepEqual(bridgeCalls, [READY_BUNDLE_RESULT.bundle]);
});

test('P1C64 preserves explicit user cancellation without treating it as failure', async () => {
    const mod = await loadModule();

    const result = await mod.exportUserHardwarePilotEvidence(TARGET, {
        buildBundle: () => READY_BUNDLE_RESULT,
        getBridge: () => ({
            isElectron: true,
            exportPilotBundle: async () => ({
                status: 'HARDWARE_PILOT_EXPORT_CANCELED',
                reason: null,
                fileName: null,
                sha256: null,
                bytes: 0,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            }),
        }),
    });

    assert.equal(result.status, 'USER_HARDWARE_PILOT_EXPORT_CANCELED');
    assert.equal(result.reason, null);
    assert.equal(result.summary, null);
    assert.equal(result.routingEligible, false);
});

test('P1C64 refuses to invoke the bridge before P1C62 evidence is ready', async () => {
    const mod = await loadModule();
    let called = false;

    const result = await mod.exportUserHardwarePilotEvidence(TARGET, {
        buildBundle: () => ({
            ...READY_BUNDLE_RESULT,
            status: 'HARDWARE_PILOT_EVIDENCE_REJECTED',
            reason: 'missing-performance',
            bundle: null,
        }),
        getBridge: () => ({
            isElectron: true,
            exportPilotBundle: async () => {
                called = true;
                return null;
            },
        }),
    });

    assert.equal(result.status, 'USER_HARDWARE_PILOT_EXPORT_REJECTED');
    assert.equal(result.reason, 'USER_HARDWARE_PILOT_EXPORT_BUNDLE_NOT_READY');
    assert.equal(called, false);
});

test('P1C64 rejects path-bearing or malformed export results from the bridge', async () => {
    const mod = await loadModule();

    const pathBearing = await mod.exportUserHardwarePilotEvidence(TARGET, {
        buildBundle: () => READY_BUNDLE_RESULT,
        getBridge: () => ({
            isElectron: true,
            exportPilotBundle: async () => ({
                status: 'HARDWARE_PILOT_EXPORT_WRITTEN',
                reason: null,
                fileName: 'pilot.json',
                filePath: 'C:\\private\\pilot.json',
                sha256: 'b'.repeat(64),
                bytes: 100,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            }),
        }),
    });

    assert.equal(pathBearing.status, 'USER_HARDWARE_PILOT_EXPORT_REJECTED');
    assert.equal(pathBearing.reason, 'USER_HARDWARE_PILOT_EXPORT_RESULT_INVALID');

    const badHash = await mod.exportUserHardwarePilotEvidence(TARGET, {
        buildBundle: () => READY_BUNDLE_RESULT,
        getBridge: () => ({
            isElectron: true,
            exportPilotBundle: async () => ({
                status: 'HARDWARE_PILOT_EXPORT_WRITTEN',
                reason: null,
                fileName: 'pilot.json',
                sha256: 'not-a-hash',
                bytes: 100,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            }),
        }),
    });

    assert.equal(badHash.status, 'USER_HARDWARE_PILOT_EXPORT_REJECTED');
});

test('P1C64 requires the Electron benchmark capability and never grants routing authority', async () => {
    const mod = await loadModule();

    for (const bridge of [null, {}, { isElectron: false }, { isElectron: true }]) {
        const result = await mod.exportUserHardwarePilotEvidence(TARGET, {
            buildBundle: () => READY_BUNDLE_RESULT,
            getBridge: () => bridge,
        });

        assert.equal(result.status, 'USER_HARDWARE_PILOT_EXPORT_REJECTED');
        assert.equal(result.routingEligible, false);
        assert.equal(result.cutoverAuthorized, false);
    }
});
