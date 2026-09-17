const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

function readyCollected() {
    return Object.freeze({
        status: 'SHADOW_EVIDENCE_COLLECTOR_READY',
        reason: null,
        evidence: Object.freeze({
            schemaVersion: 1,
            evidenceType: 'p1c14-shadow-compatibility-evidence',
            capturedAt: '2026-09-16T11:00:00.000Z',
            context: Object.freeze({
                modelId: 'z-image-turbo',
                backend: 'cuda12',
                width: 1024,
                height: 1024,
            }),
            runtime: Object.freeze({
                exists: true,
                backend: 'cuda12',
                manifestPinned: true,
                installedIntegrityVerified: true,
            }),
            model: Object.freeze({
                id: 'z-image-turbo',
                state: 'downloaded',
                requiresAuxiliary: true,
                auxiliaryStatus: Object.freeze({ llm: 'downloaded', vae: 'downloaded' }),
            }),
            hardware: Object.freeze({
                platform: 'win32',
                arch: 'x64',
                totalMemoryMiB: 32768,
                nvidiaAvailable: true,
                nvidiaMaxVramMiB: 12288,
            }),
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function published() {
    return Object.freeze({
        status: 'SHADOW_SNAPSHOT_PRODUCER_PUBLISHED',
        reason: null,
        capturedAt: '2026-09-16T11:00:00.000Z',
        compatibilityStatus: 'COMPATIBILITY_CANDIDATE',
        handoffStatus: 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED',
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

test('P1C15 composes P1C14 evidence into P1C13 producer with exact context', async () => {
    const module = await import('../src/lib/computeRouter/shadowDiagnosticOrchestrator.mjs');
    const calls = [];
    const orchestrator = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async (input) => {
            calls.push(['collect', input]);
            return readyCollected();
        },
        produceSnapshot: (input) => {
            calls.push(['produce', input]);
            return published();
        },
    });

    const registry = { id: 'registry' };
    const result = await orchestrator.run({
        registry,
        modelId: 'z-image-turbo',
        backend: 'cuda12',
        width: 1024,
        height: 1024,
    });

    assert.equal(result.status, 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_PUBLISHED');
    assert.equal(result.stage, 'complete');
    assert.equal(result.compatibilityStatus, 'COMPATIBILITY_CANDIDATE');
    assert.equal(result.handoffStatus, 'SHADOW_SNAPSHOT_HANDOFF_ACCEPTED');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);

    assert.deepEqual(calls[0], ['collect', {
        modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    }]);
    assert.equal(calls[1][0], 'produce');
    assert.equal(calls[1][1].registry, registry);
    assert.deepEqual(calls[1][1].runtime, readyCollected().evidence.runtime);
    assert.deepEqual(calls[1][1].model, readyCollected().evidence.model);
    assert.deepEqual(calls[1][1].hardware, readyCollected().evidence.hardware);
    assert.equal(calls[1][1].capturedAt, '2026-09-16T11:00:00.000Z');
});

test('P1C15 rejects manipulated collector context before producer invocation', async () => {
    const module = await import('../src/lib/computeRouter/shadowDiagnosticOrchestrator.mjs');
    let producerCalled = false;
    const collected = readyCollected();
    const forged = {
        ...collected,
        evidence: {
            ...collected.evidence,
            context: { ...collected.evidence.context, width: 512 },
        },
    };
    const orchestrator = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => forged,
        produceSnapshot: () => {
            producerCalled = true;
            return published();
        },
    });

    const result = await orchestrator.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.equal(result.reason, 'ORCHESTRATOR_EVIDENCE_CONTEXT_INVALID');
    assert.equal(result.stage, 'collect');
    assert.equal(producerCalled, false);
});

test('P1C15 rejects forged collector or producer authority', async () => {
    const module = await import('../src/lib/computeRouter/shadowDiagnosticOrchestrator.mjs');

    const forgedCollector = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => ({ ...readyCollected(), routingEligible: true }),
        produceSnapshot: () => published(),
    });
    assert.equal((await forgedCollector.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'ORCHESTRATOR_COLLECTOR_AUTHORITY_INVALID');

    const forgedProducer = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => readyCollected(),
        produceSnapshot: () => ({ ...published(), cutoverAuthorized: true }),
    });
    assert.equal((await forgedProducer.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'ORCHESTRATOR_PRODUCER_AUTHORITY_INVALID');
});

test('P1C15 preserves allowlisted rejection reasons and suppresses arbitrary errors', async () => {
    const module = await import('../src/lib/computeRouter/shadowDiagnosticOrchestrator.mjs');

    const rejectedCollector = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => ({
            status: 'SHADOW_EVIDENCE_COLLECTOR_REJECTED',
            reason: 'COLLECTOR_BRIDGE_UNAVAILABLE',
            evidence: null,
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
        produceSnapshot: () => published(),
    });
    assert.equal((await rejectedCollector.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'COLLECTOR_BRIDGE_UNAVAILABLE');

    const arbitraryCollector = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => ({
            status: 'SHADOW_EVIDENCE_COLLECTOR_REJECTED',
            reason: '<script>secret</script>',
            evidence: null,
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        }),
        produceSnapshot: () => published(),
    });
    assert.equal((await arbitraryCollector.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).reason, 'ORCHESTRATOR_COLLECTOR_REJECTED');

    const throws = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => { throw new Error('collector secret'); },
        produceSnapshot: () => published(),
    });
    const thrown = await throws.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.equal(thrown.reason, 'ORCHESTRATOR_COLLECTOR_FAILED');
    assert.equal(JSON.stringify(thrown).includes('collector secret'), false);
});

test('P1C15 maps unchanged and producer rejection without adding authority', async () => {
    const module = await import('../src/lib/computeRouter/shadowDiagnosticOrchestrator.mjs');

    const unchanged = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => readyCollected(),
        produceSnapshot: () => ({ ...published(), status: 'SHADOW_SNAPSHOT_PRODUCER_UNCHANGED' }),
    });
    assert.equal((await unchanged.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    })).status, 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_UNCHANGED');

    const rejected = module.createShadowDiagnosticOrchestrator({
        collectEvidence: async () => readyCollected(),
        produceSnapshot: () => ({
            ...published(),
            status: 'SHADOW_SNAPSHOT_PRODUCER_REJECTED',
            reason: 'HANDOFF_TIMESTAMP_CONFLICT',
        }),
    });
    const result = await rejected.run({
        registry: {}, modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024,
    });
    assert.equal(result.status, 'SHADOW_DIAGNOSTIC_ORCHESTRATOR_REJECTED');
    assert.equal(result.reason, 'HANDOFF_TIMESTAMP_CONFLICT');
    assert.equal(result.routingEligible, false);
    assert.equal(result.cutoverAuthorized, false);
});

test('P1C15 remains off startup, Settings and generation surfaces', () => {
    const orchestrator = read('src/lib/computeRouter/shadowDiagnosticOrchestrator.mjs');
    const main = read('src/main.js');
    const settings = read('src/components/SettingsModal.js');
    const image = read('src/components/ImageStudio.js');
    const video = read('src/components/VideoStudio.js');

    for (const token of [
        'fetch(', 'ipcRenderer', 'ipcMain', 'localStorage', 'sessionStorage', 'indexedDB',
        'setInterval', 'setTimeout', 'routeGenerationRequest', 'generate(',
    ]) {
        assert.equal(orchestrator.includes(token), false, `unexpected P1C15 capability: ${token}`);
    }

    for (const source of [main, settings, image, video]) {
        assert.equal(source.includes('shadowDiagnosticOrchestrator'), false);
        assert.equal(source.includes('runShadowCompatibilityDiagnostic'), false);
    }

    assert.ok(orchestrator.includes('routingEligible: false'));
    assert.ok(orchestrator.includes('cutoverAuthorized: false'));
    assert.ok(orchestrator.includes("executionAuthority: 'legacy-dispatcher-only'"));
    assert.equal(orchestrator.includes('routingEligible: true'), false);
    assert.equal(orchestrator.includes('cutoverAuthorized: true'), false);
});
