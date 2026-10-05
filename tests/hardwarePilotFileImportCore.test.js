const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
    MAX_IMPORT_BYTES,
    buildHardwarePilotImportIntake,
    sanitizeHardwarePilotImportResult,
} = require('../electron/lib/hardwarePilotFileImportCore');

function bundle() {
    const target = { modelId: 'z-image-turbo', backend: 'cuda12', width: 1024, height: 1024 };
    const aux = [
        { role: 'llm', sha256: 'd'.repeat(64) },
        { role: 'vae', sha256: 'e'.repeat(64) },
    ];
    const run = (runIndex) => ({
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample: {
            schemaVersion: 1,
            protocolVersion: 'p1c5-v1',
            runIndex,
            modelId: target.modelId,
            backend: target.backend,
            resolution: { width: target.width, height: target.height },
            harnessVersion: 'orbi-local-benchmark-harness-0.2.0',
            sourceCommit: 'a'.repeat(40),
            runtimeIdentity: 'stable-diffusion.cpp-win-cuda12.zip',
            runtimeVersion: 'v-test',
            runtimeBinarySha256: 'b'.repeat(64),
            modelArtifactSha256: 'c'.repeat(64),
            measuredAt: '2026-09-22T02:0' + runIndex + ':00.000Z',
            peakSystemRamMiB: 12000 + runIndex,
            peakVramMiB: 7000 + runIndex,
        },
        auxiliaryArtifacts: aux.map((item) => ({ ...item })),
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
    const runs = [1, 2, 3].map(run);
    const provenance = runs.map((entry) => ({
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
            modelId: entry.sample.modelId,
            backend: entry.sample.backend,
            resolution: { ...entry.sample.resolution },
            runIndex: entry.sample.runIndex,
        },
        benchmarkContext: {
            harnessVersion: entry.sample.harnessVersion,
            sourceCommit: entry.sample.sourceCommit,
            runtimeIdentity: entry.sample.runtimeIdentity,
            runtimeVersion: entry.sample.runtimeVersion,
            runtimeBinarySha256: entry.sample.runtimeBinarySha256,
            modelArtifactSha256: entry.sample.modelArtifactSha256,
            auxiliaryArtifacts: aux.map((item) => ({ ...item })),
        },
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    }));
    const performance = runs.map((entry) => ({
        schemaVersion: 1,
        evidenceType: 'p1c57-backend-performance-observation',
        protocolVersion: entry.sample.protocolVersion,
        runIndex: entry.sample.runIndex,
        modelId: entry.sample.modelId,
        backend: entry.sample.backend,
        resolution: { ...entry.sample.resolution },
        harnessVersion: entry.sample.harnessVersion,
        sourceCommit: entry.sample.sourceCommit,
        runtimeIdentity: entry.sample.runtimeIdentity,
        runtimeVersion: entry.sample.runtimeVersion,
        runtimeBinarySha256: entry.sample.runtimeBinarySha256,
        modelArtifactSha256: entry.sample.modelArtifactSha256,
        auxiliaryArtifacts: aux.map((item) => ({ ...item })),
        measuredAt: entry.sample.measuredAt,
        durationMs: 1500 + entry.sample.runIndex,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    }));

    return {
        schemaVersion: 1,
        evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
        evidenceClass: 'real-runtime-hardware-pilot',
        target,
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
            auxiliaryArtifacts: aux.map((item) => ({ ...item })),
        },
        runEvidence: runs,
        provenance,
        performanceEvidence: performance,
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

test('P1C65 revalidates imported bytes and binds them to a file SHA-256', () => {
    const bytes = Buffer.from(JSON.stringify(bundle(), null, 2) + '\n', 'utf8');
    const intake = buildHardwarePilotImportIntake({
        fileName: 'pilot.json',
        bytes,
    });

    assert.equal(intake.status, 'HARDWARE_PILOT_IMPORT_REVIEW_READY');
    assert.equal(
        intake.sha256,
        crypto.createHash('sha256').update(bytes).digest('hex'),
    );
    assert.equal(intake.importedFileHashVerified, true);
    assert.equal(intake.revalidatedAgainstCurrentContract, true);
    assert.equal(intake.sampleCount, 3);
    assert.equal(intake.routingEligible, false);
    assert.equal(intake.cutoverAuthorized, false);
});

test('P1C65 rejects tampered authority, malformed JSON and oversize input', () => {
    const forged = bundle();
    forged.routingEligible = true;

    assert.throws(() => buildHardwarePilotImportIntake({
        fileName: 'forged.json',
        bytes: Buffer.from(JSON.stringify(forged), 'utf8'),
    }), /bundle is invalid/);

    assert.throws(() => buildHardwarePilotImportIntake({
        fileName: 'broken.json',
        bytes: Buffer.from('{bad json', 'utf8'),
    }), /JSON is invalid/);

    assert.throws(() => buildHardwarePilotImportIntake({
        fileName: 'huge.json',
        bytes: Buffer.alloc(MAX_IMPORT_BYTES + 1),
    }), /size is invalid/);
});

test('P1C65 renderer result excludes raw evidence and hardware identity', () => {
    const bytes = Buffer.from(JSON.stringify(bundle()), 'utf8');
    const intake = buildHardwarePilotImportIntake({
        fileName: 'pilot.json',
        bytes,
    });
    const result = sanitizeHardwarePilotImportResult(intake);
    const serialized = JSON.stringify(result);

    assert.equal(Object.hasOwn(result, 'bundle'), false);
    assert.equal(serialized.includes('runtimeBinarySha256'), false);
    assert.equal(serialized.includes('modelArtifactSha256'), false);
    assert.equal(serialized.includes('selectedDeviceName'), false);
    assert.equal(result.cryptographicAuthenticityVerified, false);
    assert.equal(result.requiresHumanReview, true);
});

test('P1C65 accepts only JSON filenames', () => {
    assert.throws(() => buildHardwarePilotImportIntake({
        fileName: 'pilot.txt',
        bytes: Buffer.from('{}'),
    }), /must be a JSON file/);
});
