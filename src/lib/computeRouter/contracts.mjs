const CAPABILITIES = Object.freeze(['t2i', 'i2i', 't2v', 'i2v', 'v2v', 'lipsync', 'audio']);
const EXECUTION_TYPES = Object.freeze(['device', 'lan', 'edge', 'cloud']);
const TRUST_BOUNDARIES = Object.freeze(['same-device', 'trusted-network', 'third-party']);
const METERING_TYPES = Object.freeze(['local-compute', 'credits', 'subscription', 'unknown']);
const HEALTH_STATES = Object.freeze(['unknown', 'probing', 'ready', 'degraded', 'busy', 'offline', 'misconfigured', 'unsupported']);
const CREDENTIAL_STATES = Object.freeze(['available', 'missing', 'not-required', 'unknown']);
const PRIVACY_POLICIES = Object.freeze(['device-only', 'trusted-lan', 'cloud-ok']);
const COST_POLICIES = Object.freeze(['free-only', 'prefer-free', 'metered-ok']);
const LATENCY_POLICIES = Object.freeze(['interactive', 'batch']);
const JOB_STATES = Object.freeze(['QUEUED', 'PREPARING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);

const sets = {
    capability: new Set(CAPABILITIES),
    execution: new Set(EXECUTION_TYPES),
    trust: new Set(TRUST_BOUNDARIES),
    metering: new Set(METERING_TYPES),
    health: new Set(HEALTH_STATES),
    credentials: new Set(CREDENTIAL_STATES),
    privacy: new Set(PRIVACY_POLICIES),
    cost: new Set(COST_POLICIES),
    latency: new Set(LATENCY_POLICIES),
};

function routerError(code, message, details) {
    const error = new Error(message);
    error.code = code;
    if (details) error.details = details;
    return error;
}

function requireEnum(value, allowed, label) {
    if (!allowed.has(value)) throw routerError('INVALID_CONTRACT', `Invalid ${label}: ${value}`);
    return value;
}

function optionalString(value, label) {
    if (value == null) return undefined;
    if (typeof value !== 'string' || !value.trim()) throw routerError('INVALID_CONTRACT', `${label} must be a non-empty string`);
    return value.trim();
}

function requireString(value, label) {
    const normalized = optionalString(value, label);
    if (!normalized) throw routerError('INVALID_CONTRACT', `${label} is required`);
    return normalized;
}

function normalizeStringArray(value, label, { allowEmpty = true } = {}) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw routerError('INVALID_CONTRACT', `${label} must be an array`);
    const normalized = [...new Set(value.map((entry) => optionalString(entry, label)))];
    if (!allowEmpty && normalized.length === 0) throw routerError('INVALID_CONTRACT', `${label} cannot be empty`);
    return normalized;
}

function normalizeOutput(output = {}) {
    if (output == null || typeof output !== 'object' || Array.isArray(output)) {
        throw routerError('INVALID_CONTRACT', 'output must be an object');
    }
    const durationSeconds = output.durationSeconds == null ? undefined : Number(output.durationSeconds);
    if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
        throw routerError('INVALID_CONTRACT', 'output.durationSeconds must be positive');
    }
    return {
        aspectRatio: optionalString(output.aspectRatio, 'output.aspectRatio'),
        resolution: optionalString(output.resolution, 'output.resolution'),
        durationSeconds,
    };
}

function normalizePolicy(policy = {}) {
    if (policy == null || typeof policy !== 'object' || Array.isArray(policy)) {
        throw routerError('INVALID_CONTRACT', 'policy must be an object');
    }
    return {
        privacy: requireEnum(policy.privacy || 'cloud-ok', sets.privacy, 'privacy policy'),
        cost: requireEnum(policy.cost || 'prefer-free', sets.cost, 'cost policy'),
        latency: requireEnum(policy.latency || 'interactive', sets.latency, 'latency policy'),
        allowFallback: policy.allowFallback !== false,
    };
}

function createGenerationRequest(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw routerError('INVALID_CONTRACT', 'GenerationRequest must be an object');
    }
    return Object.freeze({
        capability: requireEnum(input.capability, sets.capability, 'capability'),
        modelPreference: optionalString(input.modelPreference, 'modelPreference'),
        prompt: input.prompt == null ? undefined : String(input.prompt),
        inputs: Array.isArray(input.inputs) ? input.inputs.slice() : [],
        output: Object.freeze(normalizeOutput(input.output)),
        policy: Object.freeze(normalizePolicy(input.policy)),
    });
}

function normalizeCapabilityDescriptor(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw routerError('INVALID_CONTRACT', 'CapabilityDescriptor must be an object');
    }
    const operations = normalizeStringArray(input.operations, 'operations', { allowEmpty: false });
    for (const operation of operations) requireEnum(operation, sets.capability, 'capability operation');

    let durationRange;
    if (input.durationRange != null) {
        if (!Array.isArray(input.durationRange) || input.durationRange.length !== 2) {
            throw routerError('INVALID_CONTRACT', 'durationRange must be [min,max]');
        }
        const min = Number(input.durationRange[0]);
        const max = Number(input.durationRange[1]);
        if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
            throw routerError('INVALID_CONTRACT', 'durationRange is invalid');
        }
        durationRange = [min, max];
    }

    return Object.freeze({
        modelId: requireString(input.modelId, 'modelId'),
        operations: Object.freeze(operations),
        inputTypes: Object.freeze(normalizeStringArray(input.inputTypes, 'inputTypes')),
        outputTypes: Object.freeze(normalizeStringArray(input.outputTypes, 'outputTypes')),
        aspectRatios: Object.freeze(normalizeStringArray(input.aspectRatios, 'aspectRatios')),
        resolutions: Object.freeze(normalizeStringArray(input.resolutions, 'resolutions')),
        durationRange: durationRange ? Object.freeze(durationRange) : undefined,
        hardware: input.hardware && typeof input.hardware === 'object' ? Object.freeze({ ...input.hardware }) : undefined,
        provenance: input.provenance && typeof input.provenance === 'object' ? Object.freeze({ ...input.provenance }) : undefined,
    });
}

function createProviderDescriptor(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw routerError('INVALID_CONTRACT', 'ProviderDescriptor must be an object');
    }
    const capabilities = Array.isArray(input.capabilities)
        ? input.capabilities.map(normalizeCapabilityDescriptor)
        : [];
    if (capabilities.length === 0) throw routerError('INVALID_CONTRACT', 'ProviderDescriptor requires capabilities');

    const metrics = input.metrics && typeof input.metrics === 'object'
        ? {
            latencyMs: Number.isFinite(Number(input.metrics.latencyMs)) ? Number(input.metrics.latencyMs) : undefined,
            queueDepth: Number.isFinite(Number(input.metrics.queueDepth)) ? Number(input.metrics.queueDepth) : undefined,
        }
        : {};

    return Object.freeze({
        id: requireString(input.id, 'provider id'),
        execution: requireEnum(input.execution, sets.execution, 'execution type'),
        trustBoundary: requireEnum(input.trustBoundary, sets.trust, 'trust boundary'),
        metering: requireEnum(input.metering || 'unknown', sets.metering, 'metering type'),
        health: requireEnum(input.health || 'unknown', sets.health, 'health state'),
        credentials: requireEnum(input.credentials || 'unknown', sets.credentials, 'credential state'),
        capabilities: Object.freeze(capabilities),
        metrics: Object.freeze(metrics),
    });
}

function privacyAllowed(request, provider) {
    if (request.policy.privacy === 'device-only') return provider.trustBoundary === 'same-device';
    if (request.policy.privacy === 'trusted-lan') return provider.trustBoundary !== 'third-party';
    return true;
}

function costAllowed(request, provider) {
    if (request.policy.cost !== 'free-only') return true;
    return provider.metering === 'local-compute';
}

function matchingCapabilities(request, provider) {
    return provider.capabilities.filter((capability) => {
        if (!capability.operations.includes(request.capability)) return false;
        if (request.modelPreference && capability.modelId !== request.modelPreference) return false;
        if (request.output.aspectRatio && capability.aspectRatios.length && !capability.aspectRatios.includes(request.output.aspectRatio)) return false;
        if (request.output.resolution && capability.resolutions.length && !capability.resolutions.includes(request.output.resolution)) return false;
        if (request.output.durationSeconds != null && capability.durationRange) {
            const [min, max] = capability.durationRange;
            if (request.output.durationSeconds < min || request.output.durationSeconds > max) return false;
        }
        return true;
    });
}

function evaluateProvider(requestInput, providerInput) {
    const request = createGenerationRequest(requestInput);
    const provider = createProviderDescriptor(providerInput);
    const reasons = [];

    if (!['ready', 'degraded'].includes(provider.health)) reasons.push(`health:${provider.health}`);
    if (!privacyAllowed(request, provider)) reasons.push('privacy-policy');
    if (!costAllowed(request, provider)) reasons.push('cost-policy');
    if (provider.credentials === 'missing') reasons.push('credentials-missing');

    const capabilities = matchingCapabilities(request, provider);
    if (!capabilities.length) reasons.push('capability-or-output-mismatch');

    return Object.freeze({
        provider,
        eligible: reasons.length === 0,
        reasons: Object.freeze(reasons),
        matchingCapabilities: Object.freeze(capabilities),
    });
}

function scoreProvider(request, evaluation) {
    const provider = evaluation.provider;
    let score = 0;

    score += { device: 400, lan: 320, edge: 280, cloud: 100 }[provider.execution] || 0;
    score += { 'same-device': 80, 'trusted-network': 50, 'third-party': 0 }[provider.trustBoundary] || 0;
    score += { 'local-compute': 120, subscription: 40, credits: 0, unknown: -20 }[provider.metering] || 0;
    score += provider.health === 'ready' ? 60 : -40;

    if (request.modelPreference && evaluation.matchingCapabilities.some((cap) => cap.modelId === request.modelPreference)) score += 120;
    if (request.policy.cost === 'prefer-free' && provider.metering === 'local-compute') score += 100;

    if (request.policy.latency === 'interactive' && Number.isFinite(provider.metrics.latencyMs)) {
        score -= Math.min(200, provider.metrics.latencyMs / 10);
    }
    if (Number.isFinite(provider.metrics.queueDepth)) score -= Math.min(100, provider.metrics.queueDepth * 5);

    return score;
}

function routeGenerationRequest(requestInput, providerInputs = []) {
    const request = createGenerationRequest(requestInput);
    if (!Array.isArray(providerInputs)) throw routerError('INVALID_CONTRACT', 'providers must be an array');

    const evaluations = providerInputs.map((provider) => evaluateProvider(request, provider));
    const eligible = evaluations
        .filter((item) => item.eligible)
        .map((item) => Object.freeze({ ...item, score: scoreProvider(request, item) }))
        .sort((a, b) => (b.score - a.score) || a.provider.id.localeCompare(b.provider.id));

    const rejected = evaluations.filter((item) => !item.eligible);

    if (!eligible.length) {
        return Object.freeze({
            request,
            selected: null,
            candidates: Object.freeze([]),
            rejected: Object.freeze(rejected),
            reason: 'NO_ELIGIBLE_PROVIDER',
        });
    }

    return Object.freeze({
        request,
        selected: eligible[0],
        candidates: Object.freeze(eligible),
        rejected: Object.freeze(rejected),
        reason: 'SELECTED',
    });
}

export {
    CAPABILITIES,
    EXECUTION_TYPES,
    TRUST_BOUNDARIES,
    METERING_TYPES,
    HEALTH_STATES,
    CREDENTIAL_STATES,
    PRIVACY_POLICIES,
    COST_POLICIES,
    LATENCY_POLICIES,
    JOB_STATES,
    createGenerationRequest,
    createProviderDescriptor,
    evaluateProvider,
    routeGenerationRequest,
};
