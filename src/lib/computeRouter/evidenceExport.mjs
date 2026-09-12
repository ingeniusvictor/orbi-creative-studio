import { requireRendererBuildIdentity } from './buildIdentityClient.mjs';
import { validateStudioCutoverReviewBundle } from './cutoverReviewBundle.mjs';
import { extractBoundCertification } from './parityBuildBinding.mjs';
import { extractReleaseGates } from './releaseEvidenceManifest.mjs';
import { STUDIO_PARITY_PROFILE_ID } from './studioParityTargets.mjs';

const EVIDENCE_EXPORT_SCHEMA_VERSION = 1;
const EVIDENCE_EXPORT_EXECUTION_AUTHORITY = 'legacy-dispatcher-only';

function exportError(message) {
    const error = new Error(message);
    error.code = 'INVALID_EVIDENCE_EXPORT_INPUT';
    return error;
}

function positiveTimestamp(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        throw exportError(`${label} must be a positive finite timestamp`);
    }
    return number;
}

function requireObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw exportError(`${label} is required`);
    }
    return value;
}

function stringArray(value) {
    return Object.freeze(
        Array.isArray(value)
            ? value.map((item) => String(item)).sort()
            : [],
    );
}

function releaseProofSummary(releaseManifest) {
    const evidence = releaseManifest?.evidence && typeof releaseManifest.evidence === 'object'
        ? releaseManifest.evidence
        : {};
    const platforms = evidence.platforms && typeof evidence.platforms === 'object'
        ? evidence.platforms
        : {};

    const proof = (item, approval = false) => Object.freeze({
        sourceCommit: typeof item?.sourceCommit === 'string'
            ? item.sourceCommit.toLowerCase()
            : null,
        state: approval
            ? (item?.approved === true ? 'approved' : 'not-approved')
            : String(item?.status || 'unavailable'),
        proofId: typeof item?.proofId === 'string' ? item.proofId : null,
        timestamp: Number.isFinite(Number(item?.timestamp)) ? Number(item.timestamp) : null,
        passed: item?.passed === true,
    });

    return Object.freeze({
        ci: proof(evidence.ci),
        platforms: Object.freeze({
            linux: proof(platforms.linux),
            macos: proof(platforms.macos),
            windows: proof(platforms.windows),
        }),
        securityReview: proof(evidence.securityReview, true),
        rollbackPlan: proof(evidence.rollbackPlan, true),
    });
}

function paritySummary(binding, certification) {
    return Object.freeze({
        bindingId: String(binding.bindingId || ''),
        bindingStatus: String(binding.status || 'UNKNOWN'),
        bindingValid: binding.bindingValid === true,
        boundAt: Number(binding.boundAt),
        certification: Object.freeze({
            certified: certification.certified === true,
            reason: String(certification.reason || ''),
            maxEvidenceAgeMs: Number(certification.maxEvidenceAgeMs),
            maxFutureSkewMs: Number(certification.maxFutureSkewMs),
            routeCount: Array.isArray(certification.routes) ? certification.routes.length : 0,
            routes: Object.freeze(
                Array.isArray(certification.routes)
                    ? certification.routes.map((route) => Object.freeze({
                        routeKey: String(route.routeKey || ''),
                        expectedProviderId: String(route.expectedProviderId || ''),
                        operation: String(route.operation || ''),
                        samples: Number(route.samples),
                        matches: Number(route.matches),
                        blocked: Number(route.blocked),
                        mismatches: Number(route.mismatches),
                        distinctModels: Number(route.distinctModels),
                        modelIds: stringArray(route.modelIds),
                        certified: route.certified === true,
                        reasons: stringArray(route.reasons),
                    }))
                    : [],
            ),
        }),
    });
}

function reviewSummary(reviewBundle) {
    const report = requireObject(reviewBundle.reviewReport, 'reviewBundle.reviewReport');
    const routes = Array.isArray(report.routes) ? report.routes : [];

    return Object.freeze({
        reviewStatus: String(reviewBundle.reviewStatus || 'BLOCKED'),
        readyForReview: reviewBundle.readyForReview === true,
        releaseEvidenceComplete: reviewBundle.releaseEvidenceComplete === true,
        globalBlockers: stringArray(report.globalBlockers),
        summary: Object.freeze({
            routeCount: Number(report.summary?.routeCount || 0),
            eligibleRouteCount: Number(report.summary?.eligibleRouteCount || 0),
            blockedRouteCount: Number(report.summary?.blockedRouteCount || 0),
            missingReleaseGateCount: Number(report.summary?.missingReleaseGateCount || 0),
        }),
        routes: Object.freeze(routes.map((route) => Object.freeze({
            routeKey: String(route.routeKey || ''),
            expectedProviderId: String(route.expectedProviderId || ''),
            operation: String(route.operation || ''),
            eligibleForCutoverReview: route.eligibleForCutoverReview === true,
            certifiedModelIds: stringArray(route.certifiedModelIds),
            reasons: stringArray(route.reasons),
        }))),
    });
}

function buildCertificationReleaseEvidenceExport({
    buildIdentity,
    parityBinding,
    releaseManifest,
    reviewBundle,
    providers = [],
    exportedAt,
} = {}) {
    const identity = requireRendererBuildIdentity(buildIdentity);
    const binding = requireObject(parityBinding, 'parityBinding');
    const release = requireObject(releaseManifest, 'releaseManifest');
    const bundle = requireObject(reviewBundle, 'reviewBundle');
    const timestamp = positiveTimestamp(
        exportedAt ?? bundle.generatedAt,
        'exportedAt',
    );

    if (release.sourceCommit !== identity.sourceCommit) {
        throw exportError('release manifest commit does not match build identity');
    }

    if (binding.sourceCommit !== identity.sourceCommit) {
        throw exportError('parity binding commit does not match build identity');
    }

    if (bundle.sourceCommit !== identity.sourceCommit) {
        throw exportError('review bundle commit does not match build identity');
    }

    if (
        release.profileId !== STUDIO_PARITY_PROFILE_ID
        || binding.profileId !== STUDIO_PARITY_PROFILE_ID
        || bundle.profileId !== STUDIO_PARITY_PROFILE_ID
    ) {
        throw exportError('evidence export profile mismatch');
    }

    const certification = extractBoundCertification(binding, identity.sourceCommit);
    const releaseGates = extractReleaseGates(release);

    validateStudioCutoverReviewBundle(bundle, {
        expectedSourceCommit: identity.sourceCommit,
        parityBinding: binding,
        releaseManifest: release,
        providers,
    });

    if (
        release.cutoverAuthorized !== false
        || binding.cutoverAuthorized !== false
        || bundle.cutoverAuthorized !== false
    ) {
        throw exportError('evidence export accepts only non-authorizing source evidence');
    }

    if (
        release.executionAuthority !== EVIDENCE_EXPORT_EXECUTION_AUTHORITY
        || binding.executionAuthority !== EVIDENCE_EXPORT_EXECUTION_AUTHORITY
        || bundle.executionAuthority !== EVIDENCE_EXPORT_EXECUTION_AUTHORITY
    ) {
        throw exportError('evidence export requires legacy dispatcher execution authority');
    }

    return Object.freeze({
        schemaVersion: EVIDENCE_EXPORT_SCHEMA_VERSION,
        exportedAt: timestamp,
        sourceCommit: identity.sourceCommit,
        appVersion: identity.appVersion,
        profileId: STUDIO_PARITY_PROFILE_ID,
        evidenceValid: true,
        reviewStatus: bundle.readyForReview ? 'READY_FOR_REVIEW' : 'BLOCKED',
        readyForReview: bundle.readyForReview === true,
        cutoverAuthorized: false,
        executionAuthority: EVIDENCE_EXPORT_EXECUTION_AUTHORITY,
        parity: paritySummary(binding, certification),
        release: Object.freeze({
            status: String(release.status || 'UNKNOWN'),
            ready: release.ready === true,
            generatedAt: Number(release.generatedAt),
            gates: Object.freeze({ ...releaseGates }),
            issues: stringArray(release.issues),
            proofs: releaseProofSummary(release),
        }),
        review: reviewSummary(bundle),
    });
}

function serializeCertificationReleaseEvidenceExport(exportBundle) {
    const input = requireObject(exportBundle, 'exportBundle');

    if (input.schemaVersion !== EVIDENCE_EXPORT_SCHEMA_VERSION) {
        throw exportError('unsupported evidence export schema version');
    }

    if (input.evidenceValid !== true) {
        throw exportError('only validated evidence exports can be serialized');
    }

    if (input.cutoverAuthorized !== false) {
        throw exportError('evidence export cannot authorize cutover');
    }

    if (input.executionAuthority !== EVIDENCE_EXPORT_EXECUTION_AUTHORITY) {
        throw exportError('evidence export must preserve legacy execution authority');
    }

    if (
        typeof input.sourceCommit !== 'string'
        || !/^[0-9a-f]{40}$/.test(input.sourceCommit)
    ) {
        throw exportError('evidence export source commit is invalid');
    }

    return `${JSON.stringify(input, null, 2)}\n`;
}

export {
    EVIDENCE_EXPORT_EXECUTION_AUTHORITY,
    EVIDENCE_EXPORT_SCHEMA_VERSION,
    buildCertificationReleaseEvidenceExport,
    serializeCertificationReleaseEvidenceExport,
};
