'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { LOCAL_MODEL_CATALOG, ZIMAGE_AUXILIARY } = require('./modelCatalog');

const CONTROLLED_BENCHMARK_SAMPLE_STATUS = Object.freeze({
    READY: 'CONTROLLED_BENCHMARK_SAMPLE_READY',
    REJECTED: 'CONTROLLED_BENCHMARK_SAMPLE_REJECTED',
});

const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);
const REQUEST_KEYS = new Set(['modelId', 'backend', 'width', 'height', 'runIndex']);
const ALLOWED_EXECUTION_ERROR_CODES = new Set([
    'BENCHMARK_FILE_MISSING',
    'BENCHMARK_BINARY_NOT_ALLOWED',
    'BENCHMARK_BACKEND_DEVICE_INVALID',
    'BENCHMARK_TIMEOUT',
    'BENCHMARK_RUNTIME_FAILED',
    'BENCHMARK_VRAM_NOT_MEASURED',
]);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function exactCommit(value) {
    return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function fileExists(filePath, fsImpl = fs) {
    return typeof filePath === 'string'
        && filePath.length > 0
        && fsImpl.existsSync(filePath);
}

function directoryExists(dirPath, fsImpl = fs) {
    if (!fileExists(dirPath, fsImpl)) return false;
    try {
        return fsImpl.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

function getControlledBenchmarkTargets() {
    return Object.freeze(LOCAL_MODEL_CATALOG.map((model) => Object.freeze({
        modelId: model.id,
        width: model.defaultWidth,
        height: model.defaultHeight,
    })));
}

function validateBenchmarkRequest(request) {
    if (!hasExactKeys(request, REQUEST_KEYS)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_REQUEST_SHAPE_INVALID' });
    }
    if (typeof request.modelId !== 'string' || !request.modelId.trim()) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_MODEL_ID_INVALID' });
    }
    if (!CERTIFIABLE_BACKENDS.has(request.backend)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_BACKEND_INVALID' });
    }
    if (!Number.isInteger(request.width) || request.width <= 0
        || !Number.isInteger(request.height) || request.height <= 0) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_RESOLUTION_INVALID' });
    }
    if (!Number.isInteger(request.runIndex) || request.runIndex < 1 || request.runIndex > 3) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_RUN_INDEX_INVALID' });
    }

    const model = LOCAL_MODEL_CATALOG.find((entry) => entry.id === request.modelId);
    if (!model
        || model.defaultWidth !== request.width
        || model.defaultHeight !== request.height) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_TARGET_UNSUPPORTED' });
    }

    return Object.freeze({ ok: true, reason: null, model });
}

async function resolveBenchmarkPlan(request, {
    getBinaryStatus,
    listModels,
    getBuildIdentity,
    fsImpl = fs,
    pathImpl = path,
} = {}) {
    const validation = validateBenchmarkRequest(request);
    if (!validation.ok) return Object.freeze({ ok: false, reason: validation.reason, plan: null, auxiliaryPaths: null });
    if (typeof getBinaryStatus !== 'function'
        || typeof listModels !== 'function'
        || typeof getBuildIdentity !== 'function') {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_INTERNAL_DEPENDENCY_INVALID', plan: null, auxiliaryPaths: null });
    }

    let binaryStatus;
    let installedModels;
    try {
        [binaryStatus, installedModels] = await Promise.all([
            getBinaryStatus(),
            listModels(),
        ]);
    } catch {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_LOCAL_STATE_UNAVAILABLE', plan: null, auxiliaryPaths: null });
    }

    if (!binaryStatus || binaryStatus.exists !== true || !fileExists(binaryStatus.path, fsImpl)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_RUNTIME_MISSING', plan: null, auxiliaryPaths: null });
    }
    const runtime = binaryStatus.runtime;
    if (!runtime
        || runtime.backend !== request.backend
        || runtime.manifestPinned !== true) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_RUNTIME_CONTEXT_MISMATCH', plan: null, auxiliaryPaths: null });
    }
    if (binaryStatus.installationIntegrity?.integrityVerified !== true) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_RUNTIME_INTEGRITY_UNVERIFIED', plan: null, auxiliaryPaths: null });
    }
    if (binaryStatus.backendActivation?.verified !== true
        || typeof binaryStatus.backendActivation?.selectedDeviceName !== 'string'
        || !binaryStatus.backendActivation.selectedDeviceName) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_BACKEND_ACTIVATION_UNVERIFIED', plan: null, auxiliaryPaths: null });
    }

    if (!Array.isArray(installedModels)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_MODEL_STATE_INVALID', plan: null, auxiliaryPaths: null });
    }
    const installed = installedModels.filter((entry) => entry?.id === request.modelId);
    if (installed.length !== 1
        || installed[0].state !== 'downloaded'
        || !fileExists(installed[0].path, fsImpl)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_MODEL_NOT_INSTALLED', plan: null, auxiliaryPaths: null });
    }

    const model = validation.model;
    const auxiliaryPaths = [];
    if (model.requiresAuxiliary === true) {
        if (installed[0].auxiliaryStatus?.llm !== 'downloaded'
            || installed[0].auxiliaryStatus?.vae !== 'downloaded'
            || typeof binaryStatus.modelsDir !== 'string') {
            return Object.freeze({ ok: false, reason: 'BENCHMARK_AUXILIARY_NOT_INSTALLED', plan: null, auxiliaryPaths: null });
        }
        for (const role of ['llm', 'vae']) {
            const aux = ZIMAGE_AUXILIARY[role];
            const auxPath = pathImpl.join(binaryStatus.modelsDir, aux.filename);
            if (!fileExists(auxPath, fsImpl)) {
                return Object.freeze({ ok: false, reason: 'BENCHMARK_AUXILIARY_NOT_INSTALLED', plan: null, auxiliaryPaths: null });
            }
            auxiliaryPaths.push(Object.freeze({ role, path: auxPath }));
        }
    }

    let buildIdentity;
    try {
        buildIdentity = getBuildIdentity();
    } catch {
        buildIdentity = null;
    }
    if (!buildIdentity?.available || !exactCommit(buildIdentity.sourceCommit)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_BUILD_IDENTITY_UNAVAILABLE', plan: null, auxiliaryPaths: null });
    }

    const outputDir = typeof binaryStatus.dataDir === 'string'
        ? pathImpl.join(binaryStatus.dataDir, 'tmp')
        : null;
    if (!directoryExists(outputDir, fsImpl)) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_OUTPUT_DIR_UNAVAILABLE', plan: null, auxiliaryPaths: null });
    }

    const runtimeIdentity = runtime.assetName || runtime.upstreamCommit;
    const runtimeVersion = runtime.release || runtime.upstreamCommit;
    if (typeof runtimeIdentity !== 'string' || !runtimeIdentity.trim()
        || typeof runtimeVersion !== 'string' || !runtimeVersion.trim()) {
        return Object.freeze({ ok: false, reason: 'BENCHMARK_RUNTIME_IDENTITY_INVALID', plan: null, auxiliaryPaths: null });
    }

    const plan = Object.freeze({
        runIndex: request.runIndex,
        modelId: request.modelId,
        backend: request.backend,
        backendDeviceName: binaryStatus.backendActivation.selectedDeviceName,
        width: request.width,
        height: request.height,
        sourceCommit: buildIdentity.sourceCommit,
        runtimeIdentity,
        runtimeVersion,
        modelType: model.type,
        binaryPath: binaryStatus.path,
        modelPath: installed[0].path,
        ...(model.requiresAuxiliary === true ? {
            llmPath: auxiliaryPaths.find((entry) => entry.role === 'llm').path,
            vaePath: auxiliaryPaths.find((entry) => entry.role === 'vae').path,
        } : {}),
        outputDir,
        steps: model.defaultSteps,
        guidanceScale: model.defaultGuidance,
        sampler: model.sampler,
        ...(model.scheduler ? { scheduler: model.scheduler } : {}),
    });

    return Object.freeze({
        ok: true,
        reason: null,
        plan,
        auxiliaryPaths: Object.freeze(auxiliaryPaths),
    });
}

function rejected(reason) {
    return Object.freeze({
        status: CONTROLLED_BENCHMARK_SAMPLE_STATUS.REJECTED,
        reason,
        runEvidence: null,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function sampleMatchesPlan(sample, plan) {
    return isPlainObject(sample)
        && sample.schemaVersion === 1
        && sample.protocolVersion === 'p1c5-v1'
        && sample.runIndex === plan.runIndex
        && sample.modelId === plan.modelId
        && sample.backend === plan.backend
        && sample.resolution?.width === plan.width
        && sample.resolution?.height === plan.height
        && sample.sourceCommit === plan.sourceCommit;
}

function buildRealBenchmarkAcquisitionProof(runEvidence) {
    const sample = runEvidence.sample;
    return Object.freeze({
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
        context: Object.freeze({
            modelId: sample.modelId,
            backend: sample.backend,
            resolution: Object.freeze({
                width: sample.resolution.width,
                height: sample.resolution.height,
            }),
            runIndex: sample.runIndex,
        }),
        benchmarkContext: Object.freeze({
            harnessVersion: sample.harnessVersion,
            sourceCommit: sample.sourceCommit,
            runtimeIdentity: sample.runtimeIdentity,
            runtimeVersion: sample.runtimeVersion,
            runtimeBinarySha256: sample.runtimeBinarySha256,
            modelArtifactSha256: sample.modelArtifactSha256,
            auxiliaryArtifacts: Object.freeze(runEvidence.auxiliaryArtifacts.map((artifact) => (
                Object.freeze({ role: artifact.role, sha256: artifact.sha256 })
            ))),
        }),
        cryptographicAuthenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function createControlledBenchmarkSampleRunner({
    getBinaryStatus,
    listModels,
    getBuildIdentity,
    runLocalBenchmark,
    sha256File,
    fsImpl = fs,
    pathImpl = path,
} = {}) {
    if (typeof runLocalBenchmark !== 'function') throw new TypeError('runLocalBenchmark must be a function');
    if (typeof sha256File !== 'function') throw new TypeError('sha256File must be a function');

    let active = false;

    const runSample = async (request) => {
        if (active) return rejected('BENCHMARK_ALREADY_RUNNING');
        active = true;
        try {
            const resolved = await resolveBenchmarkPlan(request, {
                getBinaryStatus,
                listModels,
                getBuildIdentity,
                fsImpl,
                pathImpl,
            });
            if (!resolved.ok) return rejected(resolved.reason);

            let auxiliaryArtifacts;
            try {
                auxiliaryArtifacts = await Promise.all(resolved.auxiliaryPaths.map(async (artifact) => Object.freeze({
                    role: artifact.role,
                    sha256: await sha256File(artifact.path),
                })));
            } catch {
                return rejected('BENCHMARK_AUXILIARY_HASH_FAILED');
            }

            let benchmark;
            try {
                benchmark = await runLocalBenchmark(resolved.plan);
            } catch (error) {
                const reason = ALLOWED_EXECUTION_ERROR_CODES.has(error?.code)
                    ? error.code
                    : 'BENCHMARK_EXECUTION_FAILED';
                return rejected(reason);
            }

            if (!benchmark
                || benchmark.benchmarkOnly !== true
                || benchmark.productionProfilePromoted !== false
                || benchmark.routingEligible !== false
                || benchmark.cutoverAuthorized !== false
                || benchmark.executionAuthority !== 'legacy-dispatcher-only'
                || !sampleMatchesPlan(benchmark.sample, resolved.plan)) {
                return rejected('BENCHMARK_RESULT_INVALID');
            }

            const runEvidence = Object.freeze({
                schemaVersion: 1,
                evidenceType: 'p1c7-benchmark-run-evidence',
                sample: benchmark.sample,
                auxiliaryArtifacts: Object.freeze(auxiliaryArtifacts),
                benchmarkOnly: true,
                productionProfilePromoted: false,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            });

            const provenance = buildRealBenchmarkAcquisitionProof(runEvidence);

            return Object.freeze({
                status: CONTROLLED_BENCHMARK_SAMPLE_STATUS.READY,
                reason: null,
                runEvidence,
                provenance,
                benchmarkOnly: true,
                productionProfilePromoted: false,
                routingEligible: false,
                cutoverAuthorized: false,
                executionAuthority: 'legacy-dispatcher-only',
            });
        } finally {
            active = false;
        }
    };

    return Object.freeze({
        runSample,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

module.exports = {
    ALLOWED_EXECUTION_ERROR_CODES,
    CERTIFIABLE_BACKENDS,
    CONTROLLED_BENCHMARK_SAMPLE_STATUS,
    REQUEST_KEYS,
    buildRealBenchmarkAcquisitionProof,
    createControlledBenchmarkSampleRunner,
    getControlledBenchmarkTargets,
    resolveBenchmarkPlan,
    sampleMatchesPlan,
    validateBenchmarkRequest,
};
