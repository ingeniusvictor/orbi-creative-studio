const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function validSnapshot(capturedAt = '2026-09-16T08:00:00.000Z') {
    return {
        schemaVersion: 1,
        snapshotType: 'p1c10-shadow-compatibility-diagnostics',
        capturedAt,
        mode: 'shadow-diagnostic-only',
        context: {
            modelId: 'z-image-turbo',
            backend: 'cuda12',
            width: 1024,
            height: 1024,
        },
        registry: {
            match: true,
            certifiedProfile: true,
            profileStatus: 'RESOURCE_PROFILE_CERTIFIED',
        },
        compatibility: {
            status: 'COMPATIBILITY_CANDIDATE',
            candidate: true,
            reasons: [],
        },
        hardware: {
            backendState: 'supported',
        },
        resources: {
            systemRam: {
                state: 'sufficient',
                requiredMiB: 10200,
                observedMiB: 32768,
            },
            vram: {
                state: 'sufficient',
                requiredMiB: 7440,
                observedMiB: 12288,
            },
        },
        boundaries: {
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        },
    };
}

test('P1C12 handoff accepts only validated snapshots and stores a detached deep-frozen copy', async () => {
    const handoffModule = await import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs');
    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();
    const source = validSnapshot();

    assert.equal(handoff.read(), null);

    const accepted = handoff.publish(source);
    assert.equal(accepted.status, 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED');
    assert.equal(accepted.routingEligible, false);
    assert.equal(accepted.cutoverAuthorized, false);
    assert.equal(accepted.executionAuthority, 'legacy-dispatcher-only');

    source.context.modelId = 'tampered-after-publish';
    source.resources.systemRam.requiredMiB = 1;
    source.compatibility.reasons.push('INSUFFICIENT_SYSTEM_RAM');

    const stored = handoff.read();
    assert.equal(stored.context.modelId, 'z-image-turbo');
    assert.equal(stored.resources.systemRam.requiredMiB, 10200);
    assert.deepEqual(stored.compatibility.reasons, []);
    assert.equal(Object.isFrozen(stored), true);
    assert.equal(Object.isFrozen(stored.context), true);
    assert.equal(Object.isFrozen(stored.compatibility.reasons), true);
    assert.equal(Object.isFrozen(stored.resources.systemRam), true);
});

test('P1C12 handoff rejects invalid snapshots without changing current state', async () => {
    const handoffModule = await import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs');
    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();
    const invalid = validSnapshot();
    invalid.reviewer = { id: 'not-allowed' };

    const result = handoff.publish(invalid);
    assert.equal(result.status, 'SHADOW_SNAPSHOT_HANDOFF_REJECTED');
    assert.equal(result.reason, 'SNAPSHOT_SHAPE_INVALID');
    assert.equal(handoff.read(), null);
});

test('P1C12 handoff is idempotent and fails closed on stale or conflicting timestamps', async () => {
    const handoffModule = await import('../src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs');
    const handoff = handoffModule.createShadowCompatibilitySnapshotHandoff();

    assert.equal(
        handoff.publish(validSnapshot('2026-09-16T08:00:00.000Z')).status,
        'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED',
    );
    assert.equal(
        handoff.publish(validSnapshot('2026-09-16T08:00:00.000Z')).status,
        'SHADOW_SNAPSHOT_HANDOFF_UNCHANGED',
    );

    const conflict = validSnapshot('2026-09-16T08:00:00.000Z');
    conflict.resources.systemRam.observedMiB = 30000;
    const conflictResult = handoff.publish(conflict);
    assert.equal(conflictResult.status, 'SHADOW_SNAPSHOT_HANDOFF_CONFLICT');
    assert.equal(conflictResult.reason, 'HANDOFF_TIMESTAMP_CONFLICT');

    const staleResult = handoff.publish(validSnapshot('2026-09-16T07:59:59.000Z'));
    assert.equal(staleResult.status, 'SHADOW_SNAPSHOT_HANDOFF_STALE');
    assert.equal(staleResult.reason, 'HANDOFF_SNAPSHOT_OLDER_THAN_CURRENT');

    const newer = validSnapshot('2026-09-16T08:00:01.000Z');
    newer.resources.systemRam.observedMiB = 33000;
    assert.equal(handoff.publish(newer).status, 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED');
    assert.equal(handoff.read().capturedAt, '2026-09-16T08:00:01.000Z');
    assert.equal(handoff.read().resources.systemRam.observedMiB, 33000);
});

test('P1C12 Settings connects only the handoff reader to Router Diagnostics', () => {
    const settings = read('src/components/SettingsModal.js');
    const panel = read('src/components/RouterDiagnosticsPanel.js');

    assert.ok(settings.includes('readShadowCompatibilitySnapshot'));
    assert.ok(settings.includes('shadowCompatibilitySnapshotProvider: readShadowCompatibilitySnapshot'));
    assert.equal(settings.includes('publishShadowCompatibilitySnapshot'), false);

    assert.ok(panel.includes('shadowCompatibilitySnapshotProvider = null'));
    assert.ok(panel.includes('resolveShadowCompatibilitySnapshot('));
    assert.ok(panel.includes('return provider();'));
    assert.ok(panel.includes('refresh.onclick = render'));
    assert.ok(settings.includes('shadowDiagnosticRefresh: runUserShadowDiagnosticRefresh'));
    assert.ok(panel.includes('refreshButton.onclick = onRefresh'));
    assert.equal((panel.match(/\.onclick\s*=/g) || []).length, 2);
});

test('P1C12 writer is not connected to startup or generation surfaces', () => {
    const handoff = read('src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');
    const main = read('src/main.js');
    const settings = read('src/components/SettingsModal.js');

    for (const token of [
        'node:fs',
        "from 'fs'",
        'fetch(',
        'ipcMain',
        'ipcRenderer',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'routeGenerationRequest',
        'certifiedResourceProfileRegistry',
    ]) {
        assert.equal(handoff.includes(token), false, `unexpected P1C12 handoff capability: ${token}`);
    }

    for (const source of [image, video, main, settings]) {
        assert.equal(source.includes('publishShadowCompatibilitySnapshot'), false);
    }
    assert.equal(image.includes('shadowCompatibilitySnapshotHandoff'), false);
    assert.equal(video.includes('shadowCompatibilitySnapshotHandoff'), false);
    assert.equal(main.includes('shadowCompatibilitySnapshotHandoff'), false);
});

test('P1C12 handoff source cannot authorize routing or cutover', () => {
    const handoff = read('src/lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs');

    assert.ok(handoff.includes('diagnosticOnly: true'));
    assert.ok(handoff.includes('routingEligible: false'));
    assert.ok(handoff.includes('cutoverAuthorized: false'));
    assert.ok(handoff.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.equal(handoff.includes('routingEligible: true'), false);
    assert.equal(handoff.includes('cutoverAuthorized: true'), false);
});
