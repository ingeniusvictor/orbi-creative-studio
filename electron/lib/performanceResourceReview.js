'use strict';

const COMPARISON_TYPE = 'p1c58-backend-performance-comparison';
const REVIEW_TYPE = 'p1c59-performance-resource-review-candidate';

function validResolution(value) {
    return Boolean(value)
        && Number.isInteger(value.width)
        && value.width > 0
        && Number.isInteger(value.height)
        && value.height > 0;
}

function validCertifiedProfile(profile, backend) {
    if (!profile
        || profile.schemaVersion !== 1
        || profile.status !== 'certified'
        || profile.backend !== backend
        || typeof profile.modelId !== 'string'
        || !profile.modelId.trim()
        || !validResolution(profile.resolution)
        || !profile.requirements
        || !Number.isFinite(profile.requirements.minSystemRamMiB)
        || profile.requirements.minSystemRamMiB <= 0
        || !profile.evidence
        || profile.evidence.method !== 'controlled-benchmark'
        || !Number.isInteger(profile.evidence.sampleCount)
        || profile.evidence.sampleCount < 3) {
        return false;
    }

    if (backend === 'cuda12') {
        return Number.isFinite(profile.requirements.minVramMiB)
            && profile.requirements.minVramMiB > 0;
    }

    return !Object.hasOwn(profile.requirements, 'minVramMiB');
}

function sameModelResolution(a, b) {
    return Boolean(
        a
        && b
        && a.modelId === b.modelId
        && a.resolution?.width === b.resolution?.width
        && a.resolution?.height === b.resolution?.height
    );
}

function buildPerformanceResourceReviewCandidate({
    comparison,
    cpuCertifiedProfile,
    cudaCertifiedProfile,
} = {}) {
    const errors = [];

    if (!comparison
        || comparison.schemaVersion !== 1
        || comparison.evidenceType !== COMPARISON_TYPE
        || comparison.benchmarkOnly !== true
        || comparison.productionProfilePromoted !== false
        || comparison.routingEligible !== false
        || comparison.cutoverAuthorized !== false
        || comparison.executionAuthority !== 'legacy-dispatcher-only'
        || !['cpu', 'cuda12', 'tie'].includes(comparison.fasterBackend)
        || !Number.isFinite(comparison.speedupVsCpu)
        || comparison.speedupVsCpu <= 0
        || !Number.isFinite(comparison.cpuMedianMs)
        || comparison.cpuMedianMs <= 0
        || !Number.isFinite(comparison.cudaMedianMs)
        || comparison.cudaMedianMs <= 0) {
        errors.push('P1C58 performance comparison is invalid');
    }

    if (!validCertifiedProfile(cpuCertifiedProfile, 'cpu')) {
        errors.push('valid certified CPU resource profile is required');
    }

    if (!validCertifiedProfile(cudaCertifiedProfile, 'cuda12')) {
        errors.push('valid certified CUDA12 resource profile is required');
    }

    if (errors.length === 0) {
        if (!sameModelResolution(cpuCertifiedProfile, cudaCertifiedProfile)) {
            errors.push('CPU and CUDA certified profiles must share model and resolution');
        }
        if (!sameModelResolution(comparison, cpuCertifiedProfile)) {
            errors.push('performance comparison must match certified model and resolution');
        }
    }

    if (errors.length) {
        return Object.freeze({
            schemaVersion: 1,
            evidenceType: REVIEW_TYPE,
            valid: false,
            status: 'PERFORMANCE_RESOURCE_REVIEW_REJECTED',
            reason: errors[0],
            errors: Object.freeze(errors),
            reviewOnly: true,
            requiresHumanRoutingReview: true,
            productionProfilePromoted: false,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });
    }

    return Object.freeze({
        schemaVersion: 1,
        evidenceType: REVIEW_TYPE,
        valid: true,
        status: 'PERFORMANCE_RESOURCE_REVIEW_READY',
        reason: null,
        modelId: comparison.modelId,
        resolution: Object.freeze({
            width: comparison.resolution.width,
            height: comparison.resolution.height,
        }),
        performance: Object.freeze({
            cpuMedianMs: comparison.cpuMedianMs,
            cudaMedianMs: comparison.cudaMedianMs,
            speedupVsCpu: comparison.speedupVsCpu,
            percentDurationReduction: comparison.percentDurationReduction,
            measuredFasterBackend: comparison.fasterBackend,
        }),
        resources: Object.freeze({
            cpu: Object.freeze({
                minSystemRamMiB: cpuCertifiedProfile.requirements.minSystemRamMiB,
            }),
            cuda12: Object.freeze({
                minSystemRamMiB: cudaCertifiedProfile.requirements.minSystemRamMiB,
                minVramMiB: cudaCertifiedProfile.requirements.minVramMiB,
            }),
        }),
        certificationEvidence: Object.freeze({
            cpu: Object.freeze({
                sampleCount: cpuCertifiedProfile.evidence.sampleCount,
                harnessVersion: cpuCertifiedProfile.evidence.harnessVersion,
                sourceCommit: cpuCertifiedProfile.evidence.sourceCommit,
                certifiedAt: cpuCertifiedProfile.evidence.certifiedAt,
                safetyMarginPct: cpuCertifiedProfile.evidence.safetyMarginPct,
            }),
            cuda12: Object.freeze({
                sampleCount: cudaCertifiedProfile.evidence.sampleCount,
                harnessVersion: cudaCertifiedProfile.evidence.harnessVersion,
                sourceCommit: cudaCertifiedProfile.evidence.sourceCommit,
                certifiedAt: cudaCertifiedProfile.evidence.certifiedAt,
                safetyMarginPct: cudaCertifiedProfile.evidence.safetyMarginPct,
            }),
        }),
        comparisonIdentity: Object.freeze({
            cpuAggregateIdentitySha256: comparison.cpuAggregateIdentitySha256,
            cudaAggregateIdentitySha256: comparison.cudaAggregateIdentitySha256,
        }),
        reviewOnly: true,
        requiresHumanRoutingReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function formatPerformanceResourceReviewMarkdown(candidate) {
    if (!candidate?.valid) {
        return [
            '# ORBI Performance + Resource Review Candidate',
            '',
            '- Status: **REJECTED**',
            '- Routing eligible: **NO**',
            '- Cutover authorized: **NO**',
            '',
            '## Errors',
            '',
            ...(candidate?.errors || ['invalid candidate']).map((error) => `- ${error}`),
            '',
        ].join('\n');
    }

    return [
        '# ORBI Performance + Resource Review Candidate',
        '',
        `- Model: \`${candidate.modelId}\``,
        `- Resolution: ${candidate.resolution.width}×${candidate.resolution.height}`,
        `- Measured faster backend: **${candidate.performance.measuredFasterBackend}**`,
        `- CPU median: ${candidate.performance.cpuMedianMs} ms`,
        `- CUDA median: ${candidate.performance.cudaMedianMs} ms`,
        `- Speedup vs CPU: ${candidate.performance.speedupVsCpu.toFixed(2)}×`,
        '- Routing eligible: **NO**',
        '- Human routing review: **REQUIRED**',
        '',
        '## Certified resources',
        '',
        `- CPU minimum RAM: ${candidate.resources.cpu.minSystemRamMiB} MiB`,
        `- CUDA minimum RAM: ${candidate.resources.cuda12.minSystemRamMiB} MiB`,
        `- CUDA minimum VRAM: ${candidate.resources.cuda12.minVramMiB} MiB`,
        '',
    ].join('\n');
}

module.exports = {
    buildPerformanceResourceReviewCandidate,
    formatPerformanceResourceReviewMarkdown,
    validCertifiedProfile,
};
