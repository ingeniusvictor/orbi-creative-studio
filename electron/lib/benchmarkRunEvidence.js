'use strict';

const { sha256File } = require('./fileIntegrity');
const { runLocalBenchmark } = require('./localBenchmarkHarness');

const AUXILIARY_REQUIRED_MODEL_TYPES = new Set(['z-image']);

async function captureBenchmarkRunEvidence(plan, {
    runLocalBenchmarkImpl = runLocalBenchmark,
    sha256FileImpl = sha256File,
    benchmarkDependencies = {},
} = {}) {
    const auxiliaryArtifacts = [];

    if (AUXILIARY_REQUIRED_MODEL_TYPES.has(plan?.modelType)) {
        const [llmSha256, vaeSha256] = await Promise.all([
            sha256FileImpl(plan.llmPath),
            sha256FileImpl(plan.vaePath),
        ]);
        auxiliaryArtifacts.push(
            Object.freeze({ role: 'llm', sha256: llmSha256 }),
            Object.freeze({ role: 'vae', sha256: vaeSha256 }),
        );
    }

    const benchmark = await runLocalBenchmarkImpl(plan, benchmarkDependencies);

    return Object.freeze({
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
}

module.exports = {
    AUXILIARY_REQUIRED_MODEL_TYPES,
    captureBenchmarkRunEvidence,
};
