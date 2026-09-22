import { validateRunEnvelope } from './benchmarkSessionEvidence.mjs';
import {
    clonePerformanceEvidence,
    cloneProvenance,
    cloneRunEvidence,
    readUserBenchmarkSessionEvidence,
    readUserBenchmarkSessionPerformance,
    readUserBenchmarkSessionProvenance,
    sameEvidenceContext,
    validateBridgePerformanceEvidence,
    validateBridgeProvenance,
    validateTarget,
} from './userBenchmarkSession.mjs';

export const HARDWARE_PILOT_EVIDENCE_STATUS = Object.freeze({
    READY: 'HARDWARE_PILOT_EVIDENCE_READY',
    REJECTED: 'HARDWARE_PILOT_EVIDENCE_REJECTED',
});

function authorityFields() {
    return Object.freeze({
        pilotEvidenceOnly: true,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason, target = null) {
    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
        status: HARDWARE_PILOT_EVIDENCE_STATUS.REJECTED,
        reason,
        target: target ? Object.freeze({ ...target }) : null,
        bundle: null,
        ...authorityFields(),
    });
}

function sortByRunIndex(items, getRunIndex) {
    return [...items].sort((left, right) => getRunIndex(left) - getRunIndex(right));
}

function exactRunIndexes(items, getRunIndex) {
    if (items.length !== 3) return false;
    const indexes = items.map(getRunIndex);
    return indexes[0] === 1 && indexes[1] === 2 && indexes[2] === 3;
}

function validMeasuredAt(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function matchesTarget(runEvidence, target) {
    const sample = runEvidence?.sample;
    return Boolean(
        sample
        && sample.modelId === target.modelId
        && sample.backend === target.backend
        && sample.resolution?.width === target.width
        && sample.resolution?.height === target.height
    );
}

function cloneBenchmarkContext(runEvidence) {
    const sample = runEvidence.sample;
    return Object.freeze({
        protocolVersion: sample.protocolVersion,
        harnessVersion: sample.harnessVersion,
        sourceCommit: sample.sourceCommit,
        runtimeIdentity: sample.runtimeIdentity,
        runtimeVersion: sample.runtimeVersion,
        runtimeBinarySha256: sample.runtimeBinarySha256,
        modelArtifactSha256: sample.modelArtifactSha256,
        auxiliaryArtifacts: Object.freeze(
            runEvidence.auxiliaryArtifacts.map((artifact) => Object.freeze({ ...artifact })),
        ),
    });
}

export function buildHardwarePilotEvidenceBundle({
    target,
    readEvidence = readUserBenchmarkSessionEvidence,
    readProvenance = readUserBenchmarkSessionProvenance,
    readPerformance = readUserBenchmarkSessionPerformance,
} = {}) {
    const targetValidation = validateTarget(target);
    if (!targetValidation.ok) return rejected(targetValidation.reason);
    const normalizedTarget = targetValidation.target;

    if (typeof readEvidence !== 'function'
        || typeof readProvenance !== 'function'
        || typeof readPerformance !== 'function') {
        return rejected('HARDWARE_PILOT_READER_INVALID', normalizedTarget);
    }

    let runEvidence;
    let provenance;
    let performance;
    try {
        runEvidence = readEvidence(normalizedTarget);
        provenance = readProvenance(normalizedTarget);
        performance = readPerformance(normalizedTarget);
    } catch {
        return rejected('HARDWARE_PILOT_EVIDENCE_UNAVAILABLE', normalizedTarget);
    }

    if (!Array.isArray(runEvidence)
        || !Array.isArray(provenance)
        || !Array.isArray(performance)
        || runEvidence.length !== 3
        || provenance.length !== 3
        || performance.length !== 3) {
        return rejected('HARDWARE_PILOT_SAMPLE_COUNT_INVALID', normalizedTarget);
    }

    const sortedRuns = sortByRunIndex(runEvidence, (entry) => entry?.sample?.runIndex ?? 0);
    const sortedProvenance = sortByRunIndex(provenance, (entry) => entry?.context?.runIndex ?? 0);
    const sortedPerformance = sortByRunIndex(performance, (entry) => entry?.runIndex ?? 0);

    if (!exactRunIndexes(sortedRuns, (entry) => entry?.sample?.runIndex ?? 0)
        || !exactRunIndexes(sortedProvenance, (entry) => entry?.context?.runIndex ?? 0)
        || !exactRunIndexes(sortedPerformance, (entry) => entry?.runIndex ?? 0)) {
        return rejected('HARDWARE_PILOT_RUN_INDEX_INVALID', normalizedTarget);
    }

    for (let index = 0; index < 3; index += 1) {
        const run = sortedRuns[index];
        const proof = sortedProvenance[index];
        const perf = sortedPerformance[index];

        const runValidation = validateRunEnvelope(run);
        if (!runValidation.ok || !matchesTarget(run, normalizedTarget)) {
            return rejected('HARDWARE_PILOT_RUN_EVIDENCE_INVALID', normalizedTarget);
        }

        const provenanceValidation = validateBridgeProvenance(proof, run);
        if (!provenanceValidation.ok || !provenanceValidation.provenance) {
            return rejected('HARDWARE_PILOT_PROVENANCE_INVALID', normalizedTarget);
        }

        const performanceValidation = validateBridgePerformanceEvidence(perf, run, { required: true });
        if (!performanceValidation.ok || !performanceValidation.performanceEvidence) {
            return rejected('HARDWARE_PILOT_PERFORMANCE_INVALID', normalizedTarget);
        }

        if (index > 0 && !sameEvidenceContext(sortedRuns[0], run)) {
            return rejected('HARDWARE_PILOT_CONTEXT_DRIFT', normalizedTarget);
        }
    }

    const measuredAt = sortedRuns.map((entry) => entry.sample.measuredAt);
    if (measuredAt.some((value) => !validMeasuredAt(value))) {
        return rejected('HARDWARE_PILOT_TIMESTAMP_INVALID', normalizedTarget);
    }

    const detachedRuns = Object.freeze(sortedRuns.map((entry) => cloneRunEvidence(entry)));
    const detachedProvenance = Object.freeze(sortedProvenance.map((entry) => cloneProvenance(entry)));
    const detachedPerformance = Object.freeze(sortedPerformance.map((entry) => clonePerformanceEvidence(entry)));

    const bundle = Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
        evidenceClass: 'real-runtime-hardware-pilot',
        target: Object.freeze({ ...normalizedTarget }),
        sampleCount: 3,
        runIndexes: Object.freeze([1, 2, 3]),
        capturedFrom: [...measuredAt].sort()[0],
        capturedTo: [...measuredAt].sort()[measuredAt.length - 1],
        benchmarkContext: cloneBenchmarkContext(detachedRuns[0]),
        runEvidence: detachedRuns,
        provenance: detachedProvenance,
        performanceEvidence: detachedPerformance,
        localPathsIncluded: false,
        hardwareIdentityIncluded: false,
        promptContentIncluded: false,
        cryptographicAuthenticityVerified: false,
        ...authorityFields(),
    });

    const serialized = JSON.stringify(bundle);
    for (const forbidden of [
        'binaryPath',
        'modelPath',
        'outputDir',
        'selectedDeviceName',
        '"description"',
        '"prompt"',
        'C:\\',
        '/internal/',
    ]) {
        if (serialized.includes(forbidden)) {
            return rejected('HARDWARE_PILOT_PRIVACY_BOUNDARY_INVALID', normalizedTarget);
        }
    }

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: 'p1c62-hardware-pilot-evidence-bundle',
        status: HARDWARE_PILOT_EVIDENCE_STATUS.READY,
        reason: null,
        target: Object.freeze({ ...normalizedTarget }),
        bundle,
        ...authorityFields(),
    });
}

export function buildUserHardwarePilotEvidenceBundle(target) {
    return buildHardwarePilotEvidenceBundle({ target });
}
