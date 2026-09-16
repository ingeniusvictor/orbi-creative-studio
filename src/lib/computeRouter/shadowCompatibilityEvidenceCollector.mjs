import { sanitizeHardwareSnapshot } from './providerReadiness.mjs';

export const SHADOW_EVIDENCE_COLLECTOR_STATUS = Object.freeze({
    READY: 'SHADOW_EVIDENCE_COLLECTOR_READY',
    REJECTED: 'SHADOW_EVIDENCE_COLLECTOR_REJECTED',
});

const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);

function defaultGetBridge() {
    if (typeof window === 'undefined') return null;
    return window.orbiComputeRouter || null;
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function safeModelId(value) {
    return typeof value === 'string'
        && value.length > 0
        && value.length <= 160
        && /^[a-zA-Z0-9._:+/-]+$/.test(value);
}

function reject(reason) {
    return Object.freeze({
        status: SHADOW_EVIDENCE_COLLECTOR_STATUS.REJECTED,
        reason,
        evidence: null,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function cloneAuxiliaryStatus(model) {
    if (model?.requiresAuxiliary !== true) return undefined;
    const source = isPlainObject(model.auxiliaryStatus) ? model.auxiliaryStatus : {};
    return Object.freeze({
        ...(typeof source.llm === 'string' ? { llm: source.llm } : {}),
        ...(typeof source.vae === 'string' ? { vae: source.vae } : {}),
    });
}

export function createShadowCompatibilityEvidenceCollector({
    getBridge = defaultGetBridge,
    now = () => new Date(),
} = {}) {
    if (typeof getBridge !== 'function') {
        throw new TypeError('Compute Router readiness bridge resolver must be a function');
    }
    if (typeof now !== 'function') {
        throw new TypeError('collector clock must be a function');
    }

    const collect = async ({
        modelId,
        backend,
        width,
        height,
    } = {}) => {
        if (!safeModelId(modelId)) return reject('COLLECTOR_MODEL_ID_INVALID');
        if (!CERTIFIABLE_BACKENDS.has(backend)) return reject('COLLECTOR_BACKEND_INVALID');
        if (!positiveInteger(width) || !positiveInteger(height)) {
            return reject('COLLECTOR_RESOLUTION_INVALID');
        }

        let bridge;
        try {
            bridge = getBridge();
        } catch {
            return reject('COLLECTOR_BRIDGE_RESOLUTION_FAILED');
        }

        if (!bridge
            || bridge.isElectron !== true
            || typeof bridge.getReadinessSnapshot !== 'function') {
            return reject('COLLECTOR_BRIDGE_UNAVAILABLE');
        }

        let snapshot;
        try {
            snapshot = await bridge.getReadinessSnapshot();
        } catch {
            return reject('COLLECTOR_READINESS_FAILED');
        }

        if (!isPlainObject(snapshot)
            || snapshot.schemaVersion !== 1
            || !isPlainObject(snapshot.sdcpp)) {
            return reject('COLLECTOR_SNAPSHOT_INVALID');
        }

        const binaryStatus = snapshot.sdcpp.binaryStatus;
        if (!isPlainObject(binaryStatus) || typeof binaryStatus.exists !== 'boolean') {
            return reject('COLLECTOR_RUNTIME_EVIDENCE_MISSING');
        }

        const runtimeEvidence = isPlainObject(binaryStatus.runtime) ? binaryStatus.runtime : null;
        if (binaryStatus.exists === true) {
            if (!runtimeEvidence || typeof runtimeEvidence.backend !== 'string') {
                return reject('COLLECTOR_RUNTIME_EVIDENCE_INCOMPLETE');
            }
            if (runtimeEvidence.backend !== backend) {
                return reject('COLLECTOR_RUNTIME_BACKEND_MISMATCH');
            }
        }

        if (!Array.isArray(snapshot.sdcpp.models)) {
            return reject('COLLECTOR_MODEL_SET_MISSING');
        }
        const modelMatches = snapshot.sdcpp.models.filter((model) => (
            isPlainObject(model)
            && model.id === modelId
            && (model.provider === undefined || model.provider === 'sdcpp')
        ));
        if (modelMatches.length === 0) return reject('COLLECTOR_MODEL_EVIDENCE_NOT_FOUND');
        if (modelMatches.length > 1) return reject('COLLECTOR_MODEL_EVIDENCE_DUPLICATE');

        const selectedModel = modelMatches[0];
        if (typeof selectedModel.state !== 'string') {
            return reject('COLLECTOR_MODEL_STATE_INVALID');
        }

        let capturedAt;
        try {
            capturedAt = now().toISOString();
        } catch {
            return reject('COLLECTOR_CLOCK_INVALID');
        }
        if (typeof capturedAt !== 'string'
            || !Number.isFinite(Date.parse(capturedAt))
            || new Date(capturedAt).toISOString() !== capturedAt) {
            return reject('COLLECTOR_CLOCK_INVALID');
        }

        const auxiliaryStatus = cloneAuxiliaryStatus(selectedModel);
        const hardware = sanitizeHardwareSnapshot(snapshot.sdcpp.hardwareSnapshot);

        const evidence = Object.freeze({
            schemaVersion: 1,
            evidenceType: 'p1c14-shadow-compatibility-evidence',
            capturedAt,
            context: Object.freeze({
                modelId,
                backend,
                width,
                height,
            }),
            runtime: Object.freeze({
                exists: binaryStatus.exists === true,
                backend,
                manifestPinned: binaryStatus.exists === true
                    && runtimeEvidence?.backend === backend
                    && runtimeEvidence?.manifestPinned === true,
                installedIntegrityVerified: binaryStatus.exists === true
                    && runtimeEvidence?.backend === backend
                    && runtimeEvidence?.installationIntegrityVerified === true,
            }),
            model: Object.freeze({
                id: modelId,
                state: selectedModel.state,
                requiresAuxiliary: selectedModel.requiresAuxiliary === true,
                ...(auxiliaryStatus ? { auxiliaryStatus } : {}),
            }),
            hardware,
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });

        return Object.freeze({
            status: SHADOW_EVIDENCE_COLLECTOR_STATUS.READY,
            reason: null,
            evidence,
            diagnosticOnly: true,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });
    };

    return Object.freeze({
        collect,
        diagnosticOnly: true,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

const defaultCollector = createShadowCompatibilityEvidenceCollector();

export async function collectShadowCompatibilityEvidence(input) {
    return defaultCollector.collect(input);
}

export {
    CERTIFIABLE_BACKENDS,
    cloneAuxiliaryStatus,
    defaultGetBridge,
    safeModelId,
};
