const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
    createHardwarePilotExportPlan,
    sanitizeHardwarePilotBundle,
} = require('../electron/lib/hardwarePilotFileExportCore');

const TARGET = Object.freeze({
    modelId: 'z-image-turbo',
    backend: 'cuda12',
    width: 1024,
    height: 1024,
});

const SOURCE_COMMIT = 'a'.repeat(40);
const RUNTIME_SHA = 'b'.repeat(64);
const MODEL_SHA = 'c'.repeat(64);
const LLM_SHA = 'd'.repeat(64);
const VAE_SHA = 'e'.repeat(64);

function runEvidence(runIndex) {
    return {
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample: {
            schemaVersion: 1,
            protocolVersion: 'p1c5-v1',
            runIndex,
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
            harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
            sourceCommit: SOURCE_COMMIT,
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            runtimeBinarySha256: RUNTIME_SHA,
            modelArtifactSha256: MODEL_SHA,
            measuredAt: `2026-09-22T02:0${runIndex}:00.000Z`,
            peakSystemRamMiB: 12000 + runIndex,
            peakVramMiB: 7000 + runIndex,
        },
        auxiliaryArtifacts: [
            { role: 'llm', sha256: LLM_SHA },
            { role: 'vae', sha256: VAE_SHA },
        ],
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

function provenance(runIndex) {
    const run = runEvidence(runIndex);
    return {
        schemaVersion: 1,
        proofType: 'p1c31-real-benchmark-acquisition-proof',
        origin: 'electron-main-controlled-benchmark',
        evidenceClass: 'real-runtime-measurement',
        trustedMainProcess: true,
        runtimeIntegrityVerified: true,
        runtimeManifestPinned: true,
        modelStateResolved: true,
        buildIdentityResolved: true,
        benchmarkProcessExecuted: true,
        fixture: false,
        synthetic: false,
        demo: false,
        context: {
            modelId: TARGET.modelId,
            backend: TARGET.backend,
            resolution: { width: TARGET.width, height: TARGET.height },
            runIndex,
        },
        benchmarkContext: {
            harnessVersion: run.sample.harnessVersion,
            sourceCommit: run.sample.sourceCommit,
            runtimeIdentity: run.sample.runtimeIdentity,
            runtimeVersion: run.sample.runtimeVersion,
            runtimeBinarySha256: run.sample.runtimeBinarySha256,
            modelArtifactSha256: run.sample.modelArtifactSha256,
            auxiliaryArtifacts: run.auxiliaryArtifacts.map((item) => ({ ...item })),
        },
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

function performance(runIndex) {
    const run = runEvidence(runIndex);
    const sample = run.sample;
    return {
        schemaVersion: 1,
        evidenceType: 'p1c57-backend-performance-observation',
        protocolVersion: sample.protocolVersion,
        runIndex,
        modelId: sample.modelId,
        backend: sample.backend,
        resolution: { ...sample.resolution },
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        auxiliaryArtifacts: run.auxiliaryArtifacts.map((item) => ({ ...item })),
        measuredAt: sample.measuredAt,
        durationMs: 1500 + runIndex,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

function bundle() {
    const runs = [1, 2, 3].map(runEvidence);
    return {
        schemaVersion: 1,
        evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
        evidenceClass: 'real-runtime-hardware-pilot',
        target: { ...TARGET },
        sampleCount: 3,
        runIndexes: [1, 2, 3],
        capturedFrom: runs[0].sample.measuredAt,
        capturedTo: runs[2].sample.measuredAt,
        benchmarkContext: {
            protocolVersion: runs[0].sample.protocolVersion,
            harnessVersion: runs[0].sample.harnessVersion,
            sourceCommit: runs[0].sample.sourceCommit,
            runtimeIdentity: runs[0].sample.runtimeIdentity,
            runtimeVersion: runs[0].sample.runtimeVersion,
            runtimeBinarySha256: runs[0].sample.runtimeBinarySha256,
            modelArtifactSha256: runs[0].sample.modelArtifactSha256,
            auxiliaryArtifacts: runs[0].auxiliaryArtifacts.map((item) => ({ ...item })),
        },
        runEvidence: runs,
        provenance: [1, 2, 3].map(provenance),
        performanceEvidence: [1, 2, 3].map(performance),
        localPathsIncluded: false,
        hardwareIdentityIncluded: false,
        promptContentIncluded: false,
        cryptographicAuthenticityVerified: false,
        pilotEvidenceOnly: true,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    };
}

test('P1C63 creates deterministic JSON bytes and SHA-256 for a valid P1C62 bundle', () => {
    const plan = createHardwarePilotExportPlan(bundle());

    assert.equal(plan.status, 'HARDWARE_PILOT_EXPORT_PLAN_READY');
    assert.match(plan.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
        plan.sha256,
        crypto.createHash('sha256').update(plan.serialized, 'utf8').digest('hex'),
    );
    assert.equal(plan.bytes, Buffer.byteLength(plan.serialized, 'utf8'));
    assert.ok(plan.serialized.endsWith('\n'));
    assert.match(plan.defaultFilename, /^orbi-hardware-pilot-z-image-turbo-cuda12-1024x1024-/);
    assert.equal(plan.createOnly, true);
    assert.equal(plan.overwriteAllowed, false);
    assert.equal(plan.routingEligible, false);
});

test('P1C63 serializer whitelists evidence and drops injected renderer fields', () => {
    const forged = bundle();
    forged.apiKey = 'SECRET_TOP_LEVEL';
    forged.runEvidence[0].sample.prompt = 'PRIVATE_PROMPT';
    forged.performanceEvidence[0].selectedDeviceName = 'CUDA0';
    forged.provenance[0].description = 'GPU MODEL';

    const plan = createHardwarePilotExportPlan(forged);
    for (const sentinel of [
        'SECRET_TOP_LEVEL',
        'PRIVATE_PROMPT',
        'CUDA0',
        'GPU MODEL',
        'apiKey',
        'selectedDeviceName',
    ]) {
        assert.equal(plan.serialized.includes(sentinel), false, `serializer leaked ${sentinel}`);
    }
});

test('P1C63 rejects forged authority and privacy claims', () => {
    assert.throws(
        () => createHardwarePilotExportPlan({
            ...bundle(),
            routingEligible: true,
        }),
        /bundle is invalid/,
    );

    assert.throws(
        () => createHardwarePilotExportPlan({
            ...bundle(),
            localPathsIncluded: true,
        }),
        /bundle is invalid/,
    );

    const forgedPerformance = bundle();
    forgedPerformance.performanceEvidence[1] = {
        ...forgedPerformance.performanceEvidence[1],
        routingEligible: true,
    };
    assert.throws(
        () => createHardwarePilotExportPlan(forgedPerformance),
        /performance evidence is invalid/,
    );
});

test('P1C63 rejects cross-run context drift and tampered capture windows', () => {
    const drift = bundle();
    drift.runEvidence[1] = {
        ...drift.runEvidence[1],
        sample: {
            ...drift.runEvidence[1].sample,
            runtimeBinarySha256: 'f'.repeat(64),
        },
    };
    assert.throws(
        () => sanitizeHardwarePilotBundle(drift),
        /run context drift|provenance is invalid|performance evidence is invalid/,
    );

    assert.throws(
        () => sanitizeHardwarePilotBundle({
            ...bundle(),
            capturedTo: '2026-09-22T09:09:09.000Z',
        }),
        /capture window is invalid/,
    );
});
