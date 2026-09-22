'use strict';

const crypto = require('node:crypto');

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const BACKENDS = new Set(['cpu', 'cuda12']);

function plain(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validIso(value) {
    return typeof value === 'string'
        && Number.isFinite(Date.parse(value))
        && new Date(Date.parse(value)).toISOString() === value;
}

function authorityValid(value) {
    return value?.productionProfilePromoted === false
        && value?.routingEligible === false
        && value?.cutoverAuthorized === false
        && value?.executionAuthority === 'legacy-dispatcher-only';
}

function sanitizeResolution(value) {
    if (!plain(value)
        || !Number.isInteger(value.width)
        || value.width <= 0
        || !Number.isInteger(value.height)
        || value.height <= 0) {
        throw new TypeError('hardware pilot resolution is invalid');
    }
    return Object.freeze({ width: value.width, height: value.height });
}

function sanitizeTarget(value) {
    if (!plain(value)
        || typeof value.modelId !== 'string'
        || !value.modelId.trim()
        || !BACKENDS.has(value.backend)
        || !Number.isInteger(value.width)
        || value.width <= 0
        || !Number.isInteger(value.height)
        || value.height <= 0) {
        throw new TypeError('hardware pilot target is invalid');
    }
    return Object.freeze({
        modelId: value.modelId,
        backend: value.backend,
        width: value.width,
        height: value.height,
    });
}

function sanitizeAuxiliary(value) {
    if (!Array.isArray(value)) {
        throw new TypeError('hardware pilot auxiliary artifacts are invalid');
    }
    return Object.freeze(value.map((artifact) => {
        if (!plain(artifact)
            || typeof artifact.role !== 'string'
            || !artifact.role.trim()
            || typeof artifact.sha256 !== 'string'
            || !SHA256.test(artifact.sha256)) {
            throw new TypeError('hardware pilot auxiliary artifact is invalid');
        }
        return Object.freeze({ role: artifact.role, sha256: artifact.sha256 });
    }));
}

function sameAuxiliary(left, right) {
    return left.length === right.length
        && left.every((artifact, index) => (
            artifact.role === right[index].role
            && artifact.sha256 === right[index].sha256
        ));
}

function sanitizeSample(sample, target, expectedRunIndex) {
    if (!plain(sample)
        || sample.schemaVersion !== 1
        || sample.protocolVersion !== 'p1c5-v1'
        || sample.runIndex !== expectedRunIndex
        || sample.modelId !== target.modelId
        || sample.backend !== target.backend
        || sample.resolution?.width !== target.width
        || sample.resolution?.height !== target.height
        || typeof sample.harnessVersion !== 'string'
        || !sample.harnessVersion.trim()
        || typeof sample.sourceCommit !== 'string'
        || !COMMIT.test(sample.sourceCommit)
        || typeof sample.runtimeIdentity !== 'string'
        || !sample.runtimeIdentity.trim()
        || typeof sample.runtimeVersion !== 'string'
        || !sample.runtimeVersion.trim()
        || typeof sample.runtimeBinarySha256 !== 'string'
        || !SHA256.test(sample.runtimeBinarySha256)
        || typeof sample.modelArtifactSha256 !== 'string'
        || !SHA256.test(sample.modelArtifactSha256)
        || !validIso(sample.measuredAt)
        || !Number.isFinite(sample.peakSystemRamMiB)
        || sample.peakSystemRamMiB <= 0) {
        throw new TypeError('hardware pilot sample is invalid');
    }

    if (target.backend === 'cuda12'
        && (!Number.isFinite(sample.peakVramMiB) || sample.peakVramMiB <= 0)) {
        throw new TypeError('hardware pilot CUDA VRAM sample is invalid');
    }

    return Object.freeze({
        schemaVersion: 1,
        protocolVersion: sample.protocolVersion,
        runIndex: sample.runIndex,
        modelId: sample.modelId,
        backend: sample.backend,
        resolution: sanitizeResolution(sample.resolution),
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        measuredAt: sample.measuredAt,
        peakSystemRamMiB: sample.peakSystemRamMiB,
        ...(target.backend === 'cuda12'
            ? { peakVramMiB: sample.peakVramMiB }
            : {}),
    });
}

function contextFromRun(run) {
    const sample = run.sample;
    return Object.freeze({
        protocolVersion: sample.protocolVersion,
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        auxiliaryArtifacts: run.auxiliaryArtifacts,
    });
}

function sameContext(left, right) {
    return left.protocolVersion === right.protocolVersion
        && left.harnessVersion === right.harnessVersion
        && left.sourceCommit === right.sourceCommit
        && left.runtimeIdentity === right.runtimeIdentity
        && left.runtimeVersion === right.runtimeVersion
        && left.runtimeBinarySha256 === right.runtimeBinarySha256
        && left.modelArtifactSha256 === right.modelArtifactSha256
        && sameAuxiliary(left.auxiliaryArtifacts, right.auxiliaryArtifacts);
}

function sanitizeRunEvidence(value, target, expectedRunIndex) {
    if (!plain(value)
        || value.schemaVersion !== 1
        || value.evidenceType !== 'p1c7-benchmark-run-evidence'
        || value.benchmarkOnly !== true
        || !authorityValid(value)) {
        throw new TypeError('hardware pilot run envelope is invalid');
    }

    const sample = sanitizeSample(value.sample, target, expectedRunIndex);
    const auxiliaryArtifacts = sanitizeAuxiliary(value.auxiliaryArtifacts);

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c7-benchmark-run-evidence',
        sample,
        auxiliaryArtifacts,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateProofContext(proof, run) {
    const sample = run.sample;
    const context = proof.context;
    const benchmark = proof.benchmarkContext;

    return context?.modelId === sample.modelId
        && context?.backend === sample.backend
        && context?.resolution?.width === sample.resolution.width
        && context?.resolution?.height === sample.resolution.height
        && context?.runIndex === sample.runIndex
        && benchmark?.harnessVersion === sample.harnessVersion
        && benchmark?.sourceCommit === sample.sourceCommit
        && benchmark?.runtimeIdentity === sample.runtimeIdentity
        && benchmark?.runtimeVersion === sample.runtimeVersion
        && benchmark?.runtimeBinarySha256 === sample.runtimeBinarySha256
        && benchmark?.modelArtifactSha256 === sample.modelArtifactSha256;
}

function sanitizeProvenance(value, run) {
    if (!plain(value)
        || value.schemaVersion !== 1
        || value.proofType !== 'p1c31-real-benchmark-acquisition-proof'
        || value.origin !== 'electron-main-controlled-benchmark'
        || value.evidenceClass !== 'real-runtime-measurement'
        || value.trustedMainProcess !== true
        || value.runtimeIntegrityVerified !== true
        || value.runtimeManifestPinned !== true
        || value.modelStateResolved !== true
        || value.buildIdentityResolved !== true
        || value.benchmarkProcessExecuted !== true
        || value.fixture !== false
        || value.synthetic !== false
        || value.demo !== false
        || value.cryptographicAuthenticityVerified !== false
        || !authorityValid(value)
        || !validateProofContext(value, run)) {
        throw new TypeError('hardware pilot provenance is invalid');
    }

    const auxiliaryArtifacts = sanitizeAuxiliary(value.benchmarkContext.auxiliaryArtifacts);
    if (!sameAuxiliary(auxiliaryArtifacts, run.auxiliaryArtifacts)) {
        throw new TypeError('hardware pilot provenance auxiliary context mismatch');
    }

    return Object.freeze({
        schemaVersion: 1,
        proofType: value.proofType,
        origin: value.origin,
        evidenceClass: value.evidenceClass,
        trustedMainProcess: true,
        runtimeIntegrityVerified: true,
        runtimeManifestPinned: true,
        modelStateResolved: true,
        buildIdentityResolved: true,
        benchmarkProcessExecuted: true,
        fixture: false,
        synthetic: false,
        demo: false,
        context: Object.freeze({
            modelId: run.sample.modelId,
            backend: run.sample.backend,
            resolution: Object.freeze({ ...run.sample.resolution }),
            runIndex: run.sample.runIndex,
        }),
        benchmarkContext: Object.freeze({
            harnessVersion: run.sample.harnessVersion,
            sourceCommit: run.sample.sourceCommit,
            runtimeIdentity: run.sample.runtimeIdentity,
            runtimeVersion: run.sample.runtimeVersion,
            runtimeBinarySha256: run.sample.runtimeBinarySha256,
            modelArtifactSha256: run.sample.modelArtifactSha256,
            auxiliaryArtifacts,
        }),
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sanitizePerformance(value, run) {
    const sample = run.sample;
    if (!plain(value)
        || value.schemaVersion !== 1
        || value.evidenceType !== 'p1c57-backend-performance-observation'
        || value.protocolVersion !== sample.protocolVersion
        || value.runIndex !== sample.runIndex
        || value.modelId !== sample.modelId
        || value.backend !== sample.backend
        || value.resolution?.width !== sample.resolution.width
        || value.resolution?.height !== sample.resolution.height
        || value.harnessVersion !== sample.harnessVersion
        || value.sourceCommit !== sample.sourceCommit
        || value.runtimeIdentity !== sample.runtimeIdentity
        || value.runtimeVersion !== sample.runtimeVersion
        || value.runtimeBinarySha256 !== sample.runtimeBinarySha256
        || value.modelArtifactSha256 !== sample.modelArtifactSha256
        || value.measuredAt !== sample.measuredAt
        || !Number.isFinite(value.durationMs)
        || value.durationMs <= 0
        || value.benchmarkOnly !== true
        || !authorityValid(value)) {
        throw new TypeError('hardware pilot performance evidence is invalid');
    }

    const auxiliaryArtifacts = sanitizeAuxiliary(value.auxiliaryArtifacts);
    if (!sameAuxiliary(auxiliaryArtifacts, run.auxiliaryArtifacts)) {
        throw new TypeError('hardware pilot performance auxiliary context mismatch');
    }

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: value.evidenceType,
        protocolVersion: value.protocolVersion,
        runIndex: value.runIndex,
        modelId: value.modelId,
        backend: value.backend,
        resolution: Object.freeze({ ...run.sample.resolution }),
        harnessVersion: value.harnessVersion,
        sourceCommit: value.sourceCommit,
        runtimeIdentity: value.runtimeIdentity,
        runtimeVersion: value.runtimeVersion,
        runtimeBinarySha256: value.runtimeBinarySha256,
        modelArtifactSha256: value.modelArtifactSha256,
        auxiliaryArtifacts,
        measuredAt: value.measuredAt,
        durationMs: value.durationMs,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sanitizeBenchmarkContext(value, expected) {
    const auxiliaryArtifacts = sanitizeAuxiliary(value?.auxiliaryArtifacts);
    if (!plain(value)
        || value.protocolVersion !== expected.protocolVersion
        || value.harnessVersion !== expected.harnessVersion
        || value.sourceCommit !== expected.sourceCommit
        || value.runtimeIdentity !== expected.runtimeIdentity
        || value.runtimeVersion !== expected.runtimeVersion
        || value.runtimeBinarySha256 !== expected.runtimeBinarySha256
        || value.modelArtifactSha256 !== expected.modelArtifactSha256
        || !sameAuxiliary(auxiliaryArtifacts, expected.auxiliaryArtifacts)) {
        throw new TypeError('hardware pilot benchmark context is invalid');
    }

    return Object.freeze({
        protocolVersion: expected.protocolVersion,
        harnessVersion: expected.harnessVersion,
        sourceCommit: expected.sourceCommit,
        runtimeIdentity: expected.runtimeIdentity,
        runtimeVersion: expected.runtimeVersion,
        runtimeBinarySha256: expected.runtimeBinarySha256,
        modelArtifactSha256: expected.modelArtifactSha256,
        auxiliaryArtifacts,
    });
}

function sanitizeHardwarePilotBundle(bundle) {
    if (!plain(bundle)
        || bundle.schemaVersion !== 1
        || bundle.evidenceType !== 'p1c62-hardware-pilot-evidence-bundle'
        || bundle.evidenceClass !== 'real-runtime-hardware-pilot'
        || bundle.sampleCount !== 3
        || !Array.isArray(bundle.runIndexes)
        || bundle.runIndexes.length !== 3
        || bundle.runIndexes[0] !== 1
        || bundle.runIndexes[1] !== 2
        || bundle.runIndexes[2] !== 3
        || !validIso(bundle.capturedFrom)
        || !validIso(bundle.capturedTo)
        || bundle.localPathsIncluded !== false
        || bundle.hardwareIdentityIncluded !== false
        || bundle.promptContentIncluded !== false
        || bundle.cryptographicAuthenticityVerified !== false
        || bundle.pilotEvidenceOnly !== true
        || bundle.requiresHumanReview !== true
        || !authorityValid(bundle)
        || !Array.isArray(bundle.runEvidence)
        || !Array.isArray(bundle.provenance)
        || !Array.isArray(bundle.performanceEvidence)
        || bundle.runEvidence.length !== 3
        || bundle.provenance.length !== 3
        || bundle.performanceEvidence.length !== 3) {
        throw new TypeError('hardware pilot bundle is invalid');
    }

    const target = sanitizeTarget(bundle.target);
    const runEvidence = Object.freeze(
        bundle.runEvidence.map((run, index) => sanitizeRunEvidence(run, target, index + 1)),
    );
    const baselineContext = contextFromRun(runEvidence[0]);
    for (const run of runEvidence.slice(1)) {
        if (!sameContext(baselineContext, contextFromRun(run))) {
            throw new TypeError('hardware pilot run context drift');
        }
    }

    const provenance = Object.freeze(
        bundle.provenance.map((proof, index) => sanitizeProvenance(proof, runEvidence[index])),
    );
    const performanceEvidence = Object.freeze(
        bundle.performanceEvidence.map((perf, index) => sanitizePerformance(perf, runEvidence[index])),
    );
    const benchmarkContext = sanitizeBenchmarkContext(bundle.benchmarkContext, baselineContext);

    const timestamps = runEvidence.map((run) => run.sample.measuredAt).sort();
    if (bundle.capturedFrom !== timestamps[0]
        || bundle.capturedTo !== timestamps[timestamps.length - 1]) {
        throw new TypeError('hardware pilot capture window is invalid');
    }

    const sanitized = Object.freeze({
        schemaVersion: 1,
        evidenceType: bundle.evidenceType,
        evidenceClass: bundle.evidenceClass,
        target,
        sampleCount: 3,
        runIndexes: Object.freeze([1, 2, 3]),
        capturedFrom: bundle.capturedFrom,
        capturedTo: bundle.capturedTo,
        benchmarkContext,
        runEvidence,
        provenance,
        performanceEvidence,
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
    });

    const serialized = JSON.stringify(sanitized);
    for (const forbidden of [
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        '"description"',
        '"prompt"',
        '"apiKey"',
        'C:\\',
        '/internal/',
    ]) {
        if (serialized.includes(forbidden)) {
            throw new TypeError('hardware pilot bundle privacy boundary invalid');
        }
    }

    return sanitized;
}

function safeSegment(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'unknown';
}

function createDefaultFilename(bundle) {
    const stamp = bundle.capturedTo.replace(/[^0-9]/g, '').slice(0, 14);
    return [
        'orbi-hardware-pilot',
        safeSegment(bundle.target.modelId),
        safeSegment(bundle.target.backend),
        `${bundle.target.width}x${bundle.target.height}`,
        stamp || 'capture',
    ].join('-') + '.json';
}

function createHardwarePilotExportPlan(bundle) {
    const sanitized = sanitizeHardwarePilotBundle(bundle);
    const serialized = `${JSON.stringify(sanitized, null, 2)}\n`;
    const sha256 = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');

    return Object.freeze({
        schemaVersion: 1,
        status: 'HARDWARE_PILOT_EXPORT_PLAN_READY',
        serialized,
        sha256,
        bytes: Buffer.byteLength(serialized, 'utf8'),
        defaultFilename: createDefaultFilename(sanitized),
        bundle: sanitized,
        createOnly: true,
        overwriteAllowed: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    createDefaultFilename,
    createHardwarePilotExportPlan,
    sanitizeHardwarePilotBundle,
};
