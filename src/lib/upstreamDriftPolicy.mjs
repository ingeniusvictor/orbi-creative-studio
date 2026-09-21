export const OPEN_GENERATIVE_AI_UPSTREAM = Object.freeze({
    repository: 'Anil-matcha/Open-Generative-AI',
    branch: 'main',
    baselineSha: '69b7fccaa946161473c765facebdb7c5f3f74d5d',
    baselineDate: '2026-09-19',
    license: 'MIT',
});

export const UPSTREAM_INTAKE_CLASS = Object.freeze({
    ORBI_OWNED: 'ORBI_OWNED',
    SECURITY_REVIEW: 'SECURITY_REVIEW',
    UPSTREAM_CANDIDATE: 'UPSTREAM_CANDIDATE',
    REVIEW: 'REVIEW',
});

const ORBI_OWNED_PREFIXES = Object.freeze([
    '.github/workflows/orbi-',
    'docs/PHASE-1',
    'electron/',
    'src/lib/computeRouter/',
    'tests/',
]);

const ORBI_OWNED_FILES = new Set([
    'scripts/write-build-identity.js',
    'src/components/RouterDiagnosticsPanel.js',
    'src/lib/providerCredentials.mjs',
]);

const SECURITY_REVIEW_PREFIXES = Object.freeze([
    'app/api/',
    'components/',
    'src/components/',
    'packages/studio/src/components/',
]);

const SECURITY_REVIEW_FILES = new Set([
    'src/lib/muapi.js',
    'packages/studio/src/muapi.js',
    'src/lib/localInferenceClient.js',
    'src/lib/pendingJobs.js',
    'src/lib/uploadProxyTarget.js',
]);

const UPSTREAM_CANDIDATE_PATTERNS = Object.freeze([
    /^packages\/studio\/src\/(?:.*Models|.*Parameters|.*Registry)\.js$/,
    /^packages\/studio\/src\/(?:modelCapabilities|modelFamilies|imageInputContracts|imageSizing|videoToolCapabilities|videoWorkflows|videoModelCopy)\.js$/,
    /^packages\/studio\/src\/messages\//,
    /^docs\/assets\//,
]);

function normalizeRepositoryPath(path) {
    if (typeof path !== 'string') return '';
    return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function classifyUpstreamPath(path) {
    const normalized = normalizeRepositoryPath(path);
    if (!normalized) return UPSTREAM_INTAKE_CLASS.REVIEW;

    if (
        ORBI_OWNED_FILES.has(normalized)
        || ORBI_OWNED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    ) {
        return UPSTREAM_INTAKE_CLASS.ORBI_OWNED;
    }

    if (
        SECURITY_REVIEW_FILES.has(normalized)
        || SECURITY_REVIEW_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    ) {
        return UPSTREAM_INTAKE_CLASS.SECURITY_REVIEW;
    }

    if (UPSTREAM_CANDIDATE_PATTERNS.some((pattern) => pattern.test(normalized))) {
        return UPSTREAM_INTAKE_CLASS.UPSTREAM_CANDIDATE;
    }

    return UPSTREAM_INTAKE_CLASS.REVIEW;
}

export function directUpstreamReplacementAllowed() {
    // P1C32 intentionally forbids blind replacement, including paths classified
    // as UPSTREAM_CANDIDATE. Candidate means "eligible for focused review", not
    // "safe to overwrite ORBI state".
    return false;
}
