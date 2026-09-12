import {
    DEFAULT_MAX_EVIDENCE_AGE_MS,
    DEFAULT_MAX_FUTURE_SKEW_MS,
} from './parityCertification.mjs';
import {
    STUDIO_PARITY_PROFILE_ID,
    STUDIO_PARITY_TARGETS,
} from './studioParityTargets.mjs';

const EVIDENCE_EXPORT_VALIDATOR_SCHEMA_VERSION = 1;
const EVIDENCE_EXPORT_VALIDATOR_AUTHORITY = 'legacy-dispatcher-only';

function validationError(message) {
    const error = new Error(message);
    error.code = 'INVALID_EXPORTED_EVIDENCE';
    return error;
}

function requireObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw validationError(`${label} must be an object`);
    }
    return value;
}

function exactKeys(value, keys, label) {
    const actual = Object.keys(requireObject(value, label)).sort();
    const expected = [...keys].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw validationError(`${label} fields do not match schema`);
    }
}

function requireString(value, label) {
    if (typeof value !== 'string' || !value.trim()) {
        throw validationError(`${label} must be a non-empty string`);
    }
    return value.trim();
}

function requireCommit(value, label) {
    const commit = requireString(value, label).toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(commit)) {
        throw validationError(`${label} must be a 40-character Git commit SHA`);
    }
    return commit;
}

function requirePositiveNumber(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        throw validationError(`${label} must be a positive finite number`);
    }
    return number;
}

function requireNonNegativeNumber(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
        throw validationError(`${label} must be a non-negative finite number`);
    }
    return number;
}

function requireInteger(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
        throw validationError(`${label} must be a non-negative integer`);
    }
    return number;
}

function requireBoolean(value, label) {
    if (typeof value !== 'boolean') {
        throw validationError(`${label} must be boolean`);
    }
    return value;
}

function requireStringArray(value, label) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw validationError(`${label} must be a string array`);
    }
    return value;
}

function sortedStrings(value) {
    return [...value].map(String).sort();
}

function sameStrings(a, b) {
    return JSON.stringify(sortedStrings(a)) === JSON.stringify(sortedStrings(b));
}

function validateProof(proof, {
    label,
    sourceCommit,
    approval = false,
} = {}) {
    exactKeys(
        proof,
        ['sourceCommit', 'state', 'proofId', 'timestamp', 'passed'],
        label,
    );

    const proofCommit = proof.sourceCommit === null
        ? null
        : requireCommit(proof.sourceCommit, `${label}.sourceCommit`);

    const state = requireString(proof.state, `${label}.state`);
    const allowedStates = approval
        ? ['approved', 'not-approved']
        : ['passed', 'failed', 'unavailable'];
    if (!allowedStates.includes(state)) {
        throw validationError(`${label}.state is unsupported`);
    }

    const proofId = proof.proofId === null
        ? null
        : requireString(proof.proofId, `${label}.proofId`);

    const timestamp = proof.timestamp === null
        ? null
        : requirePositiveNumber(proof.timestamp, `${label}.timestamp`);

    const passed = requireBoolean(proof.passed, `${label}.passed`);
    const statePasses = approval ? state === 'approved' : state === 'passed';
    const expectedPassed = Boolean(
        statePasses
        && proofCommit === sourceCommit
        && proofId
        && timestamp,
    );

    if (passed !== expectedPassed) {
        throw validationError(`${label}.passed is inconsistent with proof evidence`);
    }

    return Object.freeze({
        sourceCommit: proofCommit,
        state,
        proofId,
        timestamp,
        passed,
    });
}

function expectedReleaseIssues(proofs, sourceCommit) {
    const issues = [];
    const statusProof = (proof, prefix) => {
        if (proof.sourceCommit !== sourceCommit) issues.push(`${prefix}:commit-mismatch`);
        if (proof.state !== 'passed') issues.push(`${prefix}:status-${proof.state}`);
        if (!proof.proofId) issues.push(`${prefix}:proof-missing`);
        if (!proof.timestamp) issues.push(`${prefix}:timestamp-invalid`);
    };

    statusProof(proofs.ci, 'ci');
    for (const platform of ['linux', 'macos', 'windows']) {
        statusProof(proofs.platforms[platform], `platform:${platform}`);
    }

    const approvalProof = (proof, prefix) => {
        if (proof.sourceCommit !== sourceCommit) issues.push(`${prefix}:commit-mismatch`);
        if (proof.state !== 'approved') issues.push(`${prefix}:not-approved`);
        if (!proof.proofId) issues.push(`${prefix}:proof-missing`);
        if (!proof.timestamp) issues.push(`${prefix}:timestamp-invalid`);
    };

    approvalProof(proofs.securityReview, 'security');
    approvalProof(proofs.rollbackPlan, 'rollback');

    return Object.freeze(issues.sort());
}

function validateRelease(release, sourceCommit) {
    exactKeys(
        release,
        ['status', 'ready', 'generatedAt', 'gates', 'issues', 'proofs'],
        'release',
    );

    const status = requireString(release.status, 'release.status');
    if (!['RELEASE_EVIDENCE_COMPLETE', 'RELEASE_EVIDENCE_INCOMPLETE'].includes(status)) {
        throw validationError('release.status is unsupported');
    }

    const generatedAt = requirePositiveNumber(release.generatedAt, 'release.generatedAt');
    const ready = requireBoolean(release.ready, 'release.ready');

    exactKeys(
        release.gates,
        ['ciGreen', 'platformMatrixGreen', 'securityReviewApproved', 'rollbackPlanApproved'],
        'release.gates',
    );

    exactKeys(
        release.proofs,
        ['ci', 'platforms', 'securityReview', 'rollbackPlan'],
        'release.proofs',
    );
    exactKeys(
        release.proofs.platforms,
        ['linux', 'macos', 'windows'],
        'release.proofs.platforms',
    );

    const proofs = Object.freeze({
        ci: validateProof(release.proofs.ci, {
            label: 'release.proofs.ci',
            sourceCommit,
        }),
        platforms: Object.freeze({
            linux: validateProof(release.proofs.platforms.linux, {
                label: 'release.proofs.platforms.linux',
                sourceCommit,
            }),
            macos: validateProof(release.proofs.platforms.macos, {
                label: 'release.proofs.platforms.macos',
                sourceCommit,
            }),
            windows: validateProof(release.proofs.platforms.windows, {
                label: 'release.proofs.platforms.windows',
                sourceCommit,
            }),
        }),
        securityReview: validateProof(release.proofs.securityReview, {
            label: 'release.proofs.securityReview',
            sourceCommit,
            approval: true,
        }),
        rollbackPlan: validateProof(release.proofs.rollbackPlan, {
            label: 'release.proofs.rollbackPlan',
            sourceCommit,
            approval: true,
        }),
    });

    const expectedGates = Object.freeze({
        ciGreen: proofs.ci.passed,
        platformMatrixGreen: ['linux', 'macos', 'windows']
            .every((platform) => proofs.platforms[platform].passed),
        securityReviewApproved: proofs.securityReview.passed,
        rollbackPlanApproved: proofs.rollbackPlan.passed,
    });

    for (const [gate, expected] of Object.entries(expectedGates)) {
        const actual = requireBoolean(release.gates[gate], `release.gates.${gate}`);
        if (actual !== expected) {
            throw validationError(`release gate is inconsistent: ${gate}`);
        }
    }

    const issues = requireStringArray(release.issues, 'release.issues');
    const expectedIssues = expectedReleaseIssues(proofs, sourceCommit);
    if (!sameStrings(issues, expectedIssues)) {
        throw validationError('release.issues are inconsistent with release proofs');
    }

    const expectedReady = Object.values(expectedGates).every(Boolean)
        && expectedIssues.length === 0;
    if (ready !== expectedReady) {
        throw validationError('release.ready is inconsistent');
    }

    const expectedStatus = expectedReady
        ? 'RELEASE_EVIDENCE_COMPLETE'
        : 'RELEASE_EVIDENCE_INCOMPLETE';
    if (status !== expectedStatus) {
        throw validationError('release.status is inconsistent');
    }

    return Object.freeze({
        ready,
        status,
        generatedAt,
        gates: expectedGates,
        issues: expectedIssues,
    });
}

function validateParity(parity) {
    exactKeys(
        parity,
        ['bindingId', 'bindingStatus', 'bindingValid', 'boundAt', 'certification'],
        'parity',
    );

    requireString(parity.bindingId, 'parity.bindingId');
    const bindingStatus = requireString(parity.bindingStatus, 'parity.bindingStatus');
    if (bindingStatus !== 'PARITY_CERTIFICATION_BOUND') {
        throw validationError('parity.bindingStatus must be PARITY_CERTIFICATION_BOUND');
    }

    if (requireBoolean(parity.bindingValid, 'parity.bindingValid') !== true) {
        throw validationError('parity.bindingValid must be true');
    }
    requirePositiveNumber(parity.boundAt, 'parity.boundAt');

    const certification = requireObject(parity.certification, 'parity.certification');
    exactKeys(
        certification,
        [
            'certified',
            'reason',
            'maxEvidenceAgeMs',
            'maxFutureSkewMs',
            'routeCount',
            'routes',
        ],
        'parity.certification',
    );

    if (certification.certified !== true || certification.reason !== 'PARITY_CERTIFIED') {
        throw validationError('parity certification is not globally certified');
    }

    const maxEvidenceAgeMs = requirePositiveNumber(
        certification.maxEvidenceAgeMs,
        'parity.certification.maxEvidenceAgeMs',
    );
    if (maxEvidenceAgeMs > DEFAULT_MAX_EVIDENCE_AGE_MS) {
        throw validationError('parity certification evidence age policy is weakened');
    }

    const maxFutureSkewMs = requireNonNegativeNumber(
        certification.maxFutureSkewMs,
        'parity.certification.maxFutureSkewMs',
    );
    if (maxFutureSkewMs > DEFAULT_MAX_FUTURE_SKEW_MS) {
        throw validationError('parity certification future skew policy is weakened');
    }

    const routeCount = requireInteger(
        certification.routeCount,
        'parity.certification.routeCount',
    );
    if (!Array.isArray(certification.routes) || certification.routes.length !== routeCount) {
        throw validationError('parity route count is inconsistent');
    }

    const targetMap = new Map(STUDIO_PARITY_TARGETS.map((target) => [target.routeKey, target]));
    if (routeCount !== targetMap.size) {
        throw validationError('parity route count does not match Studio target profile');
    }

    const seen = new Set();
    for (const [index, route] of certification.routes.entries()) {
        const label = `parity.certification.routes[${index}]`;
        exactKeys(
            route,
            [
                'routeKey',
                'expectedProviderId',
                'operation',
                'samples',
                'matches',
                'blocked',
                'mismatches',
                'distinctModels',
                'modelIds',
                'certified',
                'reasons',
            ],
            label,
        );

        const routeKey = requireString(route.routeKey, `${label}.routeKey`);
        if (seen.has(routeKey)) {
            throw validationError(`duplicate parity route: ${routeKey}`);
        }
        seen.add(routeKey);

        const target = targetMap.get(routeKey);
        if (!target) {
            throw validationError(`unexpected parity route: ${routeKey}`);
        }
        if (route.expectedProviderId !== target.expectedProviderId) {
            throw validationError(`parity provider mismatch: ${routeKey}`);
        }
        if (route.operation !== target.operation) {
            throw validationError(`parity operation mismatch: ${routeKey}`);
        }

        const samples = requireInteger(route.samples, `${label}.samples`);
        const matches = requireInteger(route.matches, `${label}.matches`);
        const blocked = requireInteger(route.blocked, `${label}.blocked`);
        const mismatches = requireInteger(route.mismatches, `${label}.mismatches`);
        const distinctModels = requireInteger(
            route.distinctModels,
            `${label}.distinctModels`,
        );
        const modelIds = requireStringArray(route.modelIds, `${label}.modelIds`);
        requireStringArray(route.reasons, `${label}.reasons`);

        if (samples < target.minSamples || matches !== samples || blocked !== 0 || mismatches !== 0) {
            throw validationError(`parity evidence is not fully matching: ${routeKey}`);
        }
        if (
            distinctModels < target.minDistinctModels
            || new Set(modelIds).size < target.minDistinctModels
        ) {
            throw validationError(`parity model coverage is insufficient: ${routeKey}`);
        }
        if (route.certified !== true) {
            throw validationError(`parity route is not certified: ${routeKey}`);
        }
    }

    for (const routeKey of targetMap.keys()) {
        if (!seen.has(routeKey)) {
            throw validationError(`missing parity route: ${routeKey}`);
        }
    }

    return Object.freeze({
        bindingValid: true,
        routeCount,
        certified: true,
    });
}

function validateReview(review, release) {
    exactKeys(
        review,
        [
            'reviewStatus',
            'readyForReview',
            'releaseEvidenceComplete',
            'globalBlockers',
            'summary',
            'routes',
        ],
        'review',
    );

    const readyForReview = requireBoolean(review.readyForReview, 'review.readyForReview');
    const reviewStatus = requireString(review.reviewStatus, 'review.reviewStatus');
    const expectedStatus = readyForReview ? 'READY_FOR_REVIEW' : 'BLOCKED';
    if (reviewStatus !== expectedStatus) {
        throw validationError('review.reviewStatus is inconsistent');
    }

    const releaseEvidenceComplete = requireBoolean(
        review.releaseEvidenceComplete,
        'review.releaseEvidenceComplete',
    );
    const expectedReleaseComplete = Object.values(release.gates).every(Boolean);
    if (releaseEvidenceComplete !== expectedReleaseComplete) {
        throw validationError('review.releaseEvidenceComplete is inconsistent');
    }

    const globalBlockers = requireStringArray(review.globalBlockers, 'review.globalBlockers');
    exactKeys(
        review.summary,
        ['routeCount', 'eligibleRouteCount', 'blockedRouteCount', 'missingReleaseGateCount'],
        'review.summary',
    );

    if (!Array.isArray(review.routes)) {
        throw validationError('review.routes must be an array');
    }

    let eligibleRouteCount = 0;
    const seen = new Set();
    const targetMap = new Map(STUDIO_PARITY_TARGETS.map((target) => [target.routeKey, target]));

    for (const [index, route] of review.routes.entries()) {
        const label = `review.routes[${index}]`;
        exactKeys(
            route,
            [
                'routeKey',
                'expectedProviderId',
                'operation',
                'eligibleForCutoverReview',
                'certifiedModelIds',
                'reasons',
            ],
            label,
        );

        const routeKey = requireString(route.routeKey, `${label}.routeKey`);
        if (seen.has(routeKey)) {
            throw validationError(`duplicate review route: ${routeKey}`);
        }
        seen.add(routeKey);

        const target = targetMap.get(routeKey);
        if (!target) {
            throw validationError(`unexpected review route: ${routeKey}`);
        }
        if (route.expectedProviderId !== target.expectedProviderId || route.operation !== target.operation) {
            throw validationError(`review route identity mismatch: ${routeKey}`);
        }

        const eligible = requireBoolean(
            route.eligibleForCutoverReview,
            `${label}.eligibleForCutoverReview`,
        );
        const models = requireStringArray(route.certifiedModelIds, `${label}.certifiedModelIds`);
        const reasons = requireStringArray(route.reasons, `${label}.reasons`);

        if (eligible) {
            eligibleRouteCount += 1;
            if (reasons.length !== 0) {
                throw validationError(`eligible review route has blockers: ${routeKey}`);
            }
            if (models.length < target.minDistinctModels) {
                throw validationError(`eligible review route lacks certified models: ${routeKey}`);
            }
        } else if (reasons.length === 0) {
            throw validationError(`blocked review route has no reason: ${routeKey}`);
        }
    }

    if (seen.size !== targetMap.size) {
        throw validationError('review routes do not match Studio target profile');
    }

    const routeCount = requireInteger(review.summary.routeCount, 'review.summary.routeCount');
    const blockedRouteCount = requireInteger(
        review.summary.blockedRouteCount,
        'review.summary.blockedRouteCount',
    );
    const summaryEligible = requireInteger(
        review.summary.eligibleRouteCount,
        'review.summary.eligibleRouteCount',
    );
    const missingReleaseGateCount = requireInteger(
        review.summary.missingReleaseGateCount,
        'review.summary.missingReleaseGateCount',
    );

    if (
        routeCount !== review.routes.length
        || summaryEligible !== eligibleRouteCount
        || blockedRouteCount !== routeCount - eligibleRouteCount
    ) {
        throw validationError('review route summary is inconsistent');
    }

    const falseGates = Object.entries(release.gates)
        .filter(([, value]) => value !== true)
        .map(([gate]) => gate);
    if (missingReleaseGateCount !== falseGates.length) {
        throw validationError('review missing release gate count is inconsistent');
    }
    for (const gate of falseGates) {
        if (!globalBlockers.includes(`release-gate:${gate}`)) {
            throw validationError(`review missing blocker for release gate: ${gate}`);
        }
    }

    if (readyForReview) {
        if (
            !releaseEvidenceComplete
            || globalBlockers.length !== 0
            || blockedRouteCount !== 0
        ) {
            throw validationError('READY_FOR_REVIEW export still contains blockers');
        }
    }

    return Object.freeze({
        readyForReview,
        reviewStatus,
        globalBlockers: Object.freeze([...globalBlockers]),
        routeCount,
        eligibleRouteCount,
        blockedRouteCount,
    });
}

function validateCertificationReleaseEvidenceExport(input) {
    const bundle = requireObject(input, 'exportBundle');
    exactKeys(
        bundle,
        [
            'schemaVersion',
            'exportedAt',
            'sourceCommit',
            'appVersion',
            'profileId',
            'evidenceValid',
            'reviewStatus',
            'readyForReview',
            'cutoverAuthorized',
            'executionAuthority',
            'parity',
            'release',
            'review',
        ],
        'exportBundle',
    );

    if (bundle.schemaVersion !== EVIDENCE_EXPORT_VALIDATOR_SCHEMA_VERSION) {
        throw validationError('unsupported evidence export schema version');
    }

    requirePositiveNumber(bundle.exportedAt, 'exportBundle.exportedAt');
    const sourceCommit = requireCommit(bundle.sourceCommit, 'exportBundle.sourceCommit');
    requireString(bundle.appVersion, 'exportBundle.appVersion');

    if (bundle.profileId !== STUDIO_PARITY_PROFILE_ID) {
        throw validationError('evidence export profile mismatch');
    }
    if (bundle.evidenceValid !== true) {
        throw validationError('evidence export must be marked valid');
    }
    if (bundle.cutoverAuthorized !== false) {
        throw validationError('evidence export cannot authorize cutover');
    }
    if (bundle.executionAuthority !== EVIDENCE_EXPORT_VALIDATOR_AUTHORITY) {
        throw validationError('evidence export must preserve legacy execution authority');
    }

    const parity = validateParity(bundle.parity);
    const release = validateRelease(bundle.release, sourceCommit);
    const review = validateReview(bundle.review, release);

    if (bundle.readyForReview !== review.readyForReview) {
        throw validationError('top-level readyForReview is inconsistent');
    }
    if (bundle.reviewStatus !== review.reviewStatus) {
        throw validationError('top-level reviewStatus is inconsistent');
    }

    return Object.freeze({
        valid: true,
        sourceCommit,
        profileId: STUDIO_PARITY_PROFILE_ID,
        parityCertified: parity.certified,
        releaseReady: release.ready,
        readyForReview: review.readyForReview,
        reviewStatus: review.reviewStatus,
        blockerCount: review.globalBlockers.length + review.blockedRouteCount,
        cutoverAuthorized: false,
        executionAuthority: EVIDENCE_EXPORT_VALIDATOR_AUTHORITY,
        authenticityVerified: false,
    });
}

function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const nested of Object.values(value)) deepFreeze(nested);
    return Object.freeze(value);
}

function parseCertificationReleaseEvidenceExport(json) {
    if (typeof json !== 'string' || !json.trim()) {
        throw validationError('export JSON must be a non-empty string');
    }

    let parsed;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw validationError('export JSON is invalid');
    }

    const validation = validateCertificationReleaseEvidenceExport(parsed);
    return Object.freeze({
        validation,
        bundle: deepFreeze(parsed),
    });
}

export {
    EVIDENCE_EXPORT_VALIDATOR_AUTHORITY,
    EVIDENCE_EXPORT_VALIDATOR_SCHEMA_VERSION,
    parseCertificationReleaseEvidenceExport,
    validateCertificationReleaseEvidenceExport,
};
