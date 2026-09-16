export const RESOURCE_PROFILE_STATUS = Object.freeze({
    PENDING: 'pending-benchmark',
    CERTIFIED: 'certified',
});

export const RESOURCE_PROFILE_RESOLUTION_STATUS = Object.freeze({
    CERTIFIED: 'RESOURCE_PROFILE_CERTIFIED',
    NOT_FOUND: 'RESOURCE_PROFILE_NOT_FOUND',
    NOT_CERTIFIED: 'RESOURCE_PROFILE_NOT_CERTIFIED',
    INVALID: 'RESOURCE_PROFILE_INVALID',
    CONTEXT_MISMATCH: 'RESOURCE_PROFILE_CONTEXT_MISMATCH',
});

const CERTIFIABLE_BACKENDS = new Set(['cpu', 'cuda12']);

const DEFAULT_PROFILE_TARGETS = Object.freeze([
    Object.freeze({ modelId: 'z-image-turbo', width: 1024, height: 1024 }),
    Object.freeze({ modelId: 'z-image-base', width: 1024, height: 1024 }),
    Object.freeze({ modelId: 'dreamshaper-8', width: 512, height: 512 }),
    Object.freeze({ modelId: 'realistic-vision-v51', width: 512, height: 768 }),
    Object.freeze({ modelId: 'anything-v5', width: 512, height: 768 }),
    Object.freeze({ modelId: 'stable-diffusion-xl-base', width: 1024, height: 1024 }),
]);

export const PENDING_MODEL_RESOURCE_PROFILE_SLOTS = Object.freeze(
    DEFAULT_PROFILE_TARGETS.flatMap((target) => (
        [...CERTIFIABLE_BACKENDS].map((backend) => Object.freeze({
            schemaVersion: 1,
            modelId: target.modelId,
            backend,
            resolution: Object.freeze({ width: target.width, height: target.height }),
            status: RESOURCE_PROFILE_STATUS.PENDING,
            requirements: null,
            evidence: null,
        }))
    )),
);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
    return Object.keys(value).every((key) => allowed.has(key));
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function positiveFinite(value) {
    return Number.isFinite(value) && value > 0;
}

function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function validateCertifiedResourceProfile(profile) {
    if (!isPlainObject(profile)) return Object.freeze({ ok: false, reason: 'PROFILE_NOT_OBJECT' });

    const topKeys = new Set(['schemaVersion', 'modelId', 'backend', 'resolution', 'status', 'requirements', 'evidence']);
    if (!hasOnlyKeys(profile, topKeys)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_UNEXPECTED_FIELD' });
    }
    if (profile.schemaVersion !== 1) return Object.freeze({ ok: false, reason: 'PROFILE_SCHEMA_VERSION_INVALID' });
    if (typeof profile.modelId !== 'string' || !profile.modelId.trim()) {
        return Object.freeze({ ok: false, reason: 'PROFILE_MODEL_ID_INVALID' });
    }
    if (!CERTIFIABLE_BACKENDS.has(profile.backend)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_BACKEND_NOT_CERTIFIABLE' });
    }
    if (profile.status !== RESOURCE_PROFILE_STATUS.CERTIFIED) {
        return Object.freeze({ ok: false, reason: 'PROFILE_NOT_CERTIFIED' });
    }

    if (!isPlainObject(profile.resolution)) return Object.freeze({ ok: false, reason: 'PROFILE_RESOLUTION_INVALID' });
    if (!hasOnlyKeys(profile.resolution, new Set(['width', 'height']))) {
        return Object.freeze({ ok: false, reason: 'PROFILE_RESOLUTION_UNEXPECTED_FIELD' });
    }
    if (!positiveInteger(profile.resolution.width) || !positiveInteger(profile.resolution.height)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_RESOLUTION_INVALID' });
    }

    if (!isPlainObject(profile.requirements)) return Object.freeze({ ok: false, reason: 'PROFILE_REQUIREMENTS_INVALID' });
    if (!hasOnlyKeys(profile.requirements, new Set(['minSystemRamMiB', 'minVramMiB']))) {
        return Object.freeze({ ok: false, reason: 'PROFILE_REQUIREMENTS_UNEXPECTED_FIELD' });
    }
    if (!positiveFinite(profile.requirements.minSystemRamMiB)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_SYSTEM_RAM_INVALID' });
    }
    if (profile.backend === 'cuda12') {
        if (!positiveFinite(profile.requirements.minVramMiB)) {
            return Object.freeze({ ok: false, reason: 'PROFILE_VRAM_INVALID' });
        }
    } else if (profile.requirements.minVramMiB !== null && profile.requirements.minVramMiB !== undefined) {
        return Object.freeze({ ok: false, reason: 'PROFILE_CPU_VRAM_MUST_BE_EMPTY' });
    }

    if (!isPlainObject(profile.evidence)) return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_INVALID' });
    const evidenceKeys = new Set([
        'method',
        'sampleCount',
        'harnessVersion',
        'sourceCommit',
        'certifiedAt',
        'safetyMarginPct',
    ]);
    if (!hasOnlyKeys(profile.evidence, evidenceKeys)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_UNEXPECTED_FIELD' });
    }
    if (profile.evidence.method !== 'controlled-benchmark') {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_METHOD_INVALID' });
    }
    if (!Number.isInteger(profile.evidence.sampleCount) || profile.evidence.sampleCount < 3) {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_SAMPLE_COUNT_INVALID' });
    }
    if (typeof profile.evidence.harnessVersion !== 'string' || !profile.evidence.harnessVersion.trim()) {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_HARNESS_INVALID' });
    }
    if (typeof profile.evidence.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(profile.evidence.sourceCommit)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_COMMIT_INVALID' });
    }
    if (!validIsoTimestamp(profile.evidence.certifiedAt)) {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_TIMESTAMP_INVALID' });
    }
    if (!Number.isFinite(profile.evidence.safetyMarginPct)
        || profile.evidence.safetyMarginPct < 0
        || profile.evidence.safetyMarginPct > 100) {
        return Object.freeze({ ok: false, reason: 'PROFILE_EVIDENCE_MARGIN_INVALID' });
    }

    return Object.freeze({ ok: true, reason: null });
}

export function resolveCertifiedResourceRequirements({
    profile,
    modelId,
    backend,
    width,
    height,
} = {}) {
    if (!profile) {
        return Object.freeze({
            status: RESOURCE_PROFILE_RESOLUTION_STATUS.NOT_FOUND,
            reason: 'RESOURCE_PROFILE_NOT_PROVIDED',
            requirements: undefined,
        });
    }

    if (profile.status !== RESOURCE_PROFILE_STATUS.CERTIFIED) {
        return Object.freeze({
            status: RESOURCE_PROFILE_RESOLUTION_STATUS.NOT_CERTIFIED,
            reason: 'RESOURCE_PROFILE_NOT_CERTIFIED',
            requirements: undefined,
        });
    }

    const validation = validateCertifiedResourceProfile(profile);
    if (!validation.ok) {
        return Object.freeze({
            status: RESOURCE_PROFILE_RESOLUTION_STATUS.INVALID,
            reason: validation.reason,
            requirements: undefined,
        });
    }

    if (
        profile.modelId !== modelId
        || profile.backend !== backend
        || profile.resolution.width !== width
        || profile.resolution.height !== height
    ) {
        return Object.freeze({
            status: RESOURCE_PROFILE_RESOLUTION_STATUS.CONTEXT_MISMATCH,
            reason: 'RESOURCE_PROFILE_CONTEXT_MISMATCH',
            requirements: undefined,
        });
    }

    return Object.freeze({
        status: RESOURCE_PROFILE_RESOLUTION_STATUS.CERTIFIED,
        reason: null,
        requirements: Object.freeze({
            minSystemRamMiB: profile.requirements.minSystemRamMiB,
            ...(profile.backend === 'cuda12'
                ? { minVramMiB: profile.requirements.minVramMiB }
                : {}),
        }),
        evidence: Object.freeze({
            method: profile.evidence.method,
            sampleCount: profile.evidence.sampleCount,
            harnessVersion: profile.evidence.harnessVersion,
            sourceCommit: profile.evidence.sourceCommit,
            certifiedAt: profile.evidence.certifiedAt,
            safetyMarginPct: profile.evidence.safetyMarginPct,
        }),
    });
}

export function getPendingResourceProfileSlot({ modelId, backend, width, height } = {}) {
    return PENDING_MODEL_RESOURCE_PROFILE_SLOTS.find((slot) => (
        slot.modelId === modelId
        && slot.backend === backend
        && slot.resolution.width === width
        && slot.resolution.height === height
    ));
}

export { CERTIFIABLE_BACKENDS, DEFAULT_PROFILE_TARGETS, validateCertifiedResourceProfile };
