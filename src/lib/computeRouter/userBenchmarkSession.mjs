import { DEFAULT_PROFILE_TARGETS } from './modelResourceProfiles.mjs';
import { validateRunEnvelope } from './benchmarkSessionEvidence.mjs';

export const USER_BENCHMARK_SESSION_STATUS = Object.freeze({
    EMPTY: 'USER_BENCHMARK_SESSION_EMPTY',
    COLLECTING: 'USER_BENCHMARK_SESSION_COLLECTING',
    READY_FOR_REVIEW: 'USER_BENCHMARK_SESSION_READY_FOR_REVIEW',
    REJECTED: 'USER_BENCHMARK_SESSION_REJECTED',
});

export const USER_BENCHMARK_REQUIRED_SAMPLES = 3;

const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);
const sessions = new Map();
const provenanceRecords = new Map();
let benchmarkActive = false;

function defaultGetBridge() {
    if (typeof window === 'undefined') return null;
    return window.orbiBenchmark || null;
}

function targetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function validateTarget(target) {
    if (!target
        || typeof target !== 'object'
        || Array.isArray(target)
        || Object.keys(target).length !== 4
        || typeof target.modelId !== 'string'
        || !target.modelId.trim()
        || !CERTIFIABLE_BACKENDS.has(target.backend)
        || !Number.isInteger(target.width)
        || target.width <= 0
        || !Number.isInteger(target.height)
        || target.height <= 0) {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_TARGET_INVALID' });
    }

    const known = DEFAULT_PROFILE_TARGETS.find((entry) => (
        entry.modelId === target.modelId
        && entry.width === target.width
        && entry.height === target.height
    ));
    if (!known) {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_TARGET_UNSUPPORTED' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        target: Object.freeze({
            modelId: target.modelId,
            backend: target.backend,
            width: target.width,
            height: target.height,
        }),
    });
}

function cloneRunEvidence(runEvidence) {
    const sample = runEvidence.sample;
    return Object.freeze({
        schemaVersion: runEvidence.schemaVersion,
        evidenceType: runEvidence.evidenceType,
        sample: Object.freeze({
            ...sample,
            resolution: Object.freeze({ ...sample.resolution }),
        }),
        auxiliaryArtifacts: Object.freeze(runEvidence.auxiliaryArtifacts.map((artifact) => (
            Object.freeze({ ...artifact })
        ))),
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneProvenance(provenance) {
    return Object.freeze({
        schemaVersion: 1,
        proofType: provenance.proofType,
        origin: provenance.origin,
        evidenceClass: provenance.evidenceClass,
        trustedMainProcess: provenance.trustedMainProcess,
        runtimeIntegrityVerified: provenance.runtimeIntegrityVerified,
        runtimeManifestPinned: provenance.runtimeManifestPinned,
        modelStateResolved: provenance.modelStateResolved,
        buildIdentityResolved: provenance.buildIdentityResolved,
        benchmarkProcessExecuted: provenance.benchmarkProcessExecuted,
        fixture: provenance.fixture,
        synthetic: provenance.synthetic,
        demo: provenance.demo,
        context: Object.freeze({
            ...provenance.context,
            resolution: Object.freeze({ ...provenance.context.resolution }),
        }),
        benchmarkContext: Object.freeze({
            ...provenance.benchmarkContext,
            auxiliaryArtifacts: Object.freeze(
                provenance.benchmarkContext.auxiliaryArtifacts.map((artifact) => (
                    Object.freeze({ ...artifact })
                )),
            ),
        }),
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateBridgeProvenance(provenance, runEvidence) {
    if (!provenance) return Object.freeze({ ok: true, reason: null, provenance: null });
    if (typeof provenance !== 'object'
        || Array.isArray(provenance)
        || provenance.schemaVersion !== 1
        || provenance.proofType !== 'p1c31-real-benchmark-acquisition-proof'
        || provenance.origin !== 'electron-main-controlled-benchmark'
        || provenance.evidenceClass !== 'real-runtime-measurement'
        || provenance.trustedMainProcess !== true
        || provenance.runtimeIntegrityVerified !== true
        || provenance.runtimeManifestPinned !== true
        || provenance.modelStateResolved !== true
        || provenance.buildIdentityResolved !== true
        || provenance.benchmarkProcessExecuted !== true
        || provenance.fixture !== false
        || provenance.synthetic !== false
        || provenance.demo !== false
        || provenance.cryptographicAuthenticityVerified !== false
        || provenance.routingEligible !== false
        || provenance.cutoverAuthorized !== false
        || provenance.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_PROVENANCE_INVALID' });
    }

    const sample = runEvidence.sample;
    const context = provenance.context;
    const benchmarkContext = provenance.benchmarkContext;
    if (!context
        || context.modelId !== sample.modelId
        || context.backend !== sample.backend
        || context.resolution?.width !== sample.resolution.width
        || context.resolution?.height !== sample.resolution.height
        || context.runIndex !== sample.runIndex
        || !benchmarkContext
        || benchmarkContext.harnessVersion !== sample.harnessVersion
        || benchmarkContext.sourceCommit !== sample.sourceCommit
        || benchmarkContext.runtimeIdentity !== sample.runtimeIdentity
        || benchmarkContext.runtimeVersion !== sample.runtimeVersion
        || benchmarkContext.runtimeBinarySha256 !== sample.runtimeBinarySha256
        || benchmarkContext.modelArtifactSha256 !== sample.modelArtifactSha256
        || !Array.isArray(benchmarkContext.auxiliaryArtifacts)
        || !sameAuxiliaryArtifacts(benchmarkContext.auxiliaryArtifacts, runEvidence.auxiliaryArtifacts)) {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_PROVENANCE_CONTEXT_MISMATCH' });
    }

    return Object.freeze({
        ok: true,
        reason: null,
        provenance: cloneProvenance(provenance),
    });
}

function sameAuxiliaryArtifacts(left, right) {
    if (left.length !== right.length) return false;
    return left.every((artifact, index) => (
        artifact.role === right[index].role
        && artifact.sha256 === right[index].sha256
    ));
}

function sameEvidenceContext(left, right) {
    const a = left.sample;
    const b = right.sample;
    return a.modelId === b.modelId
        && a.backend === b.backend
        && a.resolution.width === b.resolution.width
        && a.resolution.height === b.resolution.height
        && a.protocolVersion === b.protocolVersion
        && a.harnessVersion === b.harnessVersion
        && a.sourceCommit === b.sourceCommit
        && a.runtimeIdentity === b.runtimeIdentity
        && a.runtimeVersion === b.runtimeVersion
        && a.runtimeBinarySha256 === b.runtimeBinarySha256
        && a.modelArtifactSha256 === b.modelArtifactSha256
        && sameAuxiliaryArtifacts(left.auxiliaryArtifacts, right.auxiliaryArtifacts);
}

function stateFor(target, count) {
    const status = count === 0
        ? USER_BENCHMARK_SESSION_STATUS.EMPTY
        : (count >= USER_BENCHMARK_REQUIRED_SAMPLES
            ? USER_BENCHMARK_SESSION_STATUS.READY_FOR_REVIEW
            : USER_BENCHMARK_SESSION_STATUS.COLLECTING);

    return Object.freeze({
        status,
        context: Object.freeze({ ...target }),
        sampleCount: count,
        requiredSamples: USER_BENCHMARK_REQUIRED_SAMPLES,
        readyForReview: count >= USER_BENCHMARK_REQUIRED_SAMPLES,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function rejected(reason, target = null, sampleCount = 0) {
    return Object.freeze({
        status: USER_BENCHMARK_SESSION_STATUS.REJECTED,
        reason,
        context: target ? Object.freeze({ ...target }) : null,
        sampleCount,
        requiredSamples: USER_BENCHMARK_REQUIRED_SAMPLES,
        readyForReview: false,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateBridgeResult(result, target, expectedRunIndex) {
    if (!result
        || typeof result !== 'object'
        || result.status !== 'CONTROLLED_BENCHMARK_SAMPLE_READY'
        || result.reason !== null
        || result.benchmarkOnly !== true
        || result.productionProfilePromoted !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_RESULT_INVALID' });
    }

    const envelopeValidation = validateRunEnvelope(result.runEvidence);
    if (!envelopeValidation.ok) {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_EVIDENCE_INVALID' });
    }

    const sample = result.runEvidence.sample;
    if (sample.runIndex !== expectedRunIndex
        || sample.modelId !== target.modelId
        || sample.backend !== target.backend
        || sample.resolution.width !== target.width
        || sample.resolution.height !== target.height) {
        return Object.freeze({ ok: false, reason: 'USER_BENCHMARK_CONTEXT_MISMATCH' });
    }

    return Object.freeze({ ok: true, reason: null });
}

export function createUserBenchmarkSession({
    getBridge = defaultGetBridge,
    sessionStore = sessions,
    provenanceStore = provenanceRecords,
} = {}) {
    if (typeof getBridge !== 'function') throw new TypeError('benchmark bridge resolver must be a function');
    if (!(sessionStore instanceof Map)) throw new TypeError('benchmark session store must be a Map');
    if (!(provenanceStore instanceof Map)) throw new TypeError('benchmark provenance store must be a Map');

    const getState = (target) => {
        const validation = validateTarget(target);
        if (!validation.ok) return rejected(validation.reason);
        const evidence = sessionStore.get(targetKey(validation.target)) || [];
        return stateFor(validation.target, evidence.length);
    };

    const readEvidence = (target) => {
        const validation = validateTarget(target);
        if (!validation.ok) return Object.freeze([]);
        const evidence = sessionStore.get(targetKey(validation.target)) || [];
        return Object.freeze(evidence.map((run) => cloneRunEvidence(run)));
    };

    const readProvenance = (target) => {
        const validation = validateTarget(target);
        if (!validation.ok) return Object.freeze([]);
        const provenance = provenanceStore.get(targetKey(validation.target)) || [];
        return Object.freeze(provenance.map((entry) => cloneProvenance(entry)));
    };

    const capture = async (target) => {
        const validation = validateTarget(target);
        if (!validation.ok) return rejected(validation.reason);
        const normalizedTarget = validation.target;
        const key = targetKey(normalizedTarget);
        const current = sessionStore.get(key) || [];

        if (current.length >= USER_BENCHMARK_REQUIRED_SAMPLES) {
            return stateFor(normalizedTarget, current.length);
        }
        if (benchmarkActive) {
            return rejected('USER_BENCHMARK_ALREADY_RUNNING', normalizedTarget, current.length);
        }

        let bridge;
        try {
            bridge = getBridge();
        } catch {
            return rejected('USER_BENCHMARK_BRIDGE_RESOLUTION_FAILED', normalizedTarget, current.length);
        }
        if (!bridge || bridge.isElectron !== true || typeof bridge.runSample !== 'function') {
            return rejected('USER_BENCHMARK_BRIDGE_UNAVAILABLE', normalizedTarget, current.length);
        }

        const expectedRunIndex = current.length + 1;
        benchmarkActive = true;
        let result;
        try {
            result = await bridge.runSample({
                modelId: normalizedTarget.modelId,
                backend: normalizedTarget.backend,
                width: normalizedTarget.width,
                height: normalizedTarget.height,
                runIndex: expectedRunIndex,
            });
        } catch {
            return rejected('USER_BENCHMARK_EXECUTION_FAILED', normalizedTarget, current.length);
        } finally {
            benchmarkActive = false;
        }

        if (result?.status === 'CONTROLLED_BENCHMARK_SAMPLE_REJECTED') {
            return rejected('USER_BENCHMARK_SAMPLE_REJECTED', normalizedTarget, current.length);
        }

        const resultValidation = validateBridgeResult(result, normalizedTarget, expectedRunIndex);
        if (!resultValidation.ok) {
            return rejected(resultValidation.reason, normalizedTarget, current.length);
        }

        const provenanceValidation = validateBridgeProvenance(result.provenance, result.runEvidence);
        if (!provenanceValidation.ok) {
            return rejected(provenanceValidation.reason, normalizedTarget, current.length);
        }

        const detached = cloneRunEvidence(result.runEvidence);
        if (current.length > 0 && !sameEvidenceContext(current[0], detached)) {
            return rejected('USER_BENCHMARK_EVIDENCE_CONTEXT_DRIFT', normalizedTarget, current.length);
        }

        const next = Object.freeze([...current, detached]);
        sessionStore.set(key, next);

        if (provenanceValidation.provenance) {
            const currentProvenance = provenanceStore.get(key) || [];
            provenanceStore.set(
                key,
                Object.freeze([...currentProvenance, provenanceValidation.provenance]),
            );
        }

        return stateFor(normalizedTarget, next.length);
    };

    return Object.freeze({
        capture,
        getState,
        readEvidence,
        readProvenance,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

const defaultSession = createUserBenchmarkSession();

export async function captureUserBenchmarkSample(target) {
    return defaultSession.capture(target);
}

export function getUserBenchmarkSessionState(target) {
    return defaultSession.getState(target);
}

export function readUserBenchmarkSessionEvidence(target) {
    return defaultSession.readEvidence(target);
}

export function readUserBenchmarkSessionProvenance(target) {
    return defaultSession.readProvenance(target);
}

export {
    CERTIFIABLE_BACKENDS,
    cloneProvenance,
    cloneRunEvidence,
    sameEvidenceContext,
    targetKey,
    validateBridgeProvenance,
    validateBridgeResult,
    validateTarget,
};
