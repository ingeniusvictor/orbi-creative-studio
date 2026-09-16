import { validateCertifiedResourceProfile } from './modelResourceProfiles.mjs';
import { evaluateCertifiedLocalCompatibility } from './localCompatibility.mjs';

export const REGISTRY_STATUS = Object.freeze({
    READY: 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_READY',
    INVALID: 'CERTIFIED_RESOURCE_PROFILE_REGISTRY_INVALID',
});

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function profileKey(profile) {
    return `${profile.modelId}::${profile.backend}::${profile.resolution.width}x${profile.resolution.height}`;
}

function invalid(reason) {
    return Object.freeze({
        status: REGISTRY_STATUS.INVALID,
        reason,
        registry: null,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function validateCertificationEntry(entry) {
    if (!isPlainObject(entry)) return Object.freeze({ ok: false, reason: 'REGISTRY_ENTRY_NOT_OBJECT' });
    if (entry.status !== 'RESOURCE_PROFILE_CERTIFICATION_RECORDED'
        || entry.reason !== null
        || entry.reviewerIdentityVerified !== false
        || entry.authenticityVerified !== false
        || entry.routingEligible !== false
        || entry.cutoverAuthorized !== false
        || entry.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'REGISTRY_CERTIFICATION_AUTHORITY_INVALID' });
    }

    const profile = entry.certifiedProfile;
    const validation = validateCertifiedResourceProfile(profile);
    if (!validation.ok) return Object.freeze({ ok: false, reason: validation.reason });

    const record = entry.certificationRecord;
    if (!isPlainObject(record)
        || record.schemaVersion !== 1
        || record.evidenceType !== 'p1c8-human-certification-record'
        || record.decision !== 'approve'
        || record.authenticityVerified !== false
        || record.routingEligible !== false
        || record.cutoverAuthorized !== false
        || record.executionAuthority !== 'legacy-dispatcher-only') {
        return Object.freeze({ ok: false, reason: 'REGISTRY_CERTIFICATION_RECORD_INVALID' });
    }
    if (!isPlainObject(record.reviewer)
        || record.reviewer.reviewerIdentityVerified !== false) {
        return Object.freeze({ ok: false, reason: 'REGISTRY_REVIEWER_BOUNDARY_INVALID' });
    }
    if (!isPlainObject(record.session)
        || record.session.modelId !== profile.modelId
        || record.session.backend !== profile.backend
        || record.session.resolution?.width !== profile.resolution.width
        || record.session.resolution?.height !== profile.resolution.height) {
        return Object.freeze({ ok: false, reason: 'REGISTRY_CERTIFICATION_CONTEXT_MISMATCH' });
    }
    if (!isPlainObject(record.approvedRequirements)
        || record.approvedRequirements.minSystemRamMiB !== profile.requirements.minSystemRamMiB
        || (profile.backend === 'cuda12'
            && record.approvedRequirements.minVramMiB !== profile.requirements.minVramMiB)) {
        return Object.freeze({ ok: false, reason: 'REGISTRY_CERTIFIED_REQUIREMENTS_MISMATCH' });
    }

    return Object.freeze({ ok: true, reason: null, profile, record });
}

function snapshotValidatedEntry(profile, record) {
    const profileSnapshot = Object.freeze({
        schemaVersion: profile.schemaVersion,
        modelId: profile.modelId,
        backend: profile.backend,
        resolution: Object.freeze({ ...profile.resolution }),
        status: profile.status,
        requirements: Object.freeze({ ...profile.requirements }),
        evidence: Object.freeze({ ...profile.evidence }),
    });

    const sessionSnapshot = Object.freeze({
        ...record.session,
        resolution: Object.freeze({ ...record.session.resolution }),
        runIndexes: Object.freeze([...(record.session.runIndexes || [])]),
        auxiliaryArtifacts: Object.freeze((record.session.auxiliaryArtifacts || []).map((artifact) => (
            Object.freeze({ ...artifact })
        ))),
    });
    const recordSnapshot = Object.freeze({
        schemaVersion: record.schemaVersion,
        evidenceType: record.evidenceType,
        decision: record.decision,
        session: sessionSnapshot,
        approvedRequirements: Object.freeze({ ...record.approvedRequirements }),
        reviewer: Object.freeze({ ...record.reviewer }),
        certifiedAt: record.certifiedAt,
        reviewNote: record.reviewNote,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });

    return Object.freeze({
        profile: profileSnapshot,
        certificationRecord: recordSnapshot,
    });
}

export function createCertifiedResourceProfileRegistry({ certifications = [] } = {}) {
    if (!Array.isArray(certifications)) return invalid('REGISTRY_CERTIFICATIONS_NOT_ARRAY');

    const entries = new Map();
    for (const certification of certifications) {
        const validation = validateCertificationEntry(certification);
        if (!validation.ok) return invalid(validation.reason);
        const key = profileKey(validation.profile);
        if (entries.has(key)) return invalid('REGISTRY_DUPLICATE_PROFILE_CONTEXT');
        entries.set(key, snapshotValidatedEntry(validation.profile, validation.record));
    }

    const get = ({ modelId, backend, width, height } = {}) => {
        const key = `${modelId}::${backend}::${width}x${height}`;
        return entries.get(key) || null;
    };

    const list = () => Object.freeze([...entries.entries()].map(([key, value]) => Object.freeze({
        key,
        modelId: value.profile.modelId,
        backend: value.profile.backend,
        resolution: Object.freeze({ ...value.profile.resolution }),
        certifiedAt: value.profile.evidence.certifiedAt,
        routingEligible: false,
    })));

    const evaluateShadowCompatibility = ({ runtime, model, hardware, width, height } = {}) => {
        const context = Object.freeze({
            modelId: model?.id,
            backend: runtime?.backend,
            width,
            height,
        });
        const entry = get(context);
        const compatibility = evaluateCertifiedLocalCompatibility({
            runtime,
            model,
            hardware,
            resourceProfile: entry?.profile,
            width,
            height,
        });

        return Object.freeze({
            mode: 'shadow-diagnostic-only',
            context,
            registryMatch: Boolean(entry),
            compatibility,
            routingEligible: false,
            cutoverAuthorized: false,
            executionAuthority: 'legacy-dispatcher-only',
        });
    };

    const registry = Object.freeze({
        schemaVersion: 1,
        mode: 'immutable-shadow-registry',
        size: entries.size,
        get,
        list,
        evaluateShadowCompatibility,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });

    return Object.freeze({
        status: REGISTRY_STATUS.READY,
        reason: null,
        registry,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export { profileKey, snapshotValidatedEntry, validateCertificationEntry };
