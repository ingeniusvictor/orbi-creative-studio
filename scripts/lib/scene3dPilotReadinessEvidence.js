'use strict';

const { createHash } = require('node:crypto');

const EVIDENCE_SCHEMA = 'orbi.scene3d-pilot-readiness/v1';
const RESULT_SCHEMA = 'orbi.scene3d-pilot-readiness-result/v1';
const COMPLETE_STATE = 'EVIDENCE_COMPLETE_FOR_MANUAL_PILOT_REVIEW';
const BLOCKED_STATE = 'BLOCKED';

const REQUIREMENTS = Object.freeze({
    'QB-12': Object.freeze(['certified', 'regressionPass', 'livePass']),
    'QB-13': Object.freeze(['certified', 'regressionPass', 'livePass']),
    'QB-14': Object.freeze(['certified', 'contractPass', 'testsPass']),
    'QB-15': Object.freeze(['certified', 'testsPass', 'livePass']),
    'QB-16': Object.freeze(['certified', 'ciGreen', 'livePass']),
    'QB-17': Object.freeze(['certified', 'ciGreen']),
    'QB-18': Object.freeze(['certified', 'ciGreen']),
    'QB-19': Object.freeze(['certified', 'ciGreen']),
    'QB-20': Object.freeze(['certified', 'ciGreen']),
    'QB-21': Object.freeze(['certified', 'ciGreen', 'livePass']),
});

const REQUIRED_AUTHORITY = Object.freeze({
    pilotDefaultOff: true,
    executionDefaultOff: true,
    automaticR2Retry: false,
    computeRouterAuthorityChanged: false,
    mhsActuationEnabled: false,
    productionCutoverAuthorized: false,
    featureEnableAuthorized: false,
});

function normalizeJson(value, path = '$') {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`${path} must contain only finite JSON numbers`);
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeJson(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
            throw new TypeError(`${path} must contain only plain JSON objects`);
        }
        const out = Object.create(null);
        for (const key of Object.keys(value).sort()) {
            if (value[key] === undefined) {
                throw new TypeError(`${path}.${key} must not be undefined`);
            }
            out[key] = normalizeJson(value[key], `${path}.${key}`);
        }
        return out;
    }
    throw new TypeError(`${path} must contain only JSON-compatible values`);
}

function evidenceDigest(evidence) {
    const canonical = JSON.stringify(normalizeJson(evidence));
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function validCommit(value) {
    return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function evaluateScene3DPilotReadiness(evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
        throw new TypeError('Scene3D readiness evidence must be an object');
    }

    const missing = [];
    const violations = [];

    if (evidence.schema !== EVIDENCE_SCHEMA) {
        violations.push('schema must be orbi.scene3d-pilot-readiness/v1');
    }

    const phases = evidence.phases;
    if (!phases || typeof phases !== 'object' || Array.isArray(phases)) {
        violations.push('phases must be an object');
    } else {
        for (const [phase, gates] of Object.entries(REQUIREMENTS)) {
            const record = phases[phase];
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                missing.push(`${phase}.record`);
                continue;
            }

            if (!validCommit(record.commit)) {
                violations.push(`${phase}.commit must be a lowercase 40-character Git SHA`);
            }

            if (record.status !== 'PASS') {
                missing.push(`${phase}.status=PASS`);
            }

            for (const gate of gates) {
                if (record[gate] !== true) {
                    missing.push(`${phase}.${gate}=true`);
                }
            }
        }
    }

    const authority = evidence.authority;
    if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
        violations.push('authority must be an object');
    } else {
        for (const [key, required] of Object.entries(REQUIRED_AUTHORITY)) {
            if (authority[key] !== required) {
                violations.push(`authority.${key} must equal ${String(required)}`);
            }
        }
    }

    const complete = missing.length === 0 && violations.length === 0;

    return Object.freeze({
        schema: RESULT_SCHEMA,
        state: complete ? COMPLETE_STATE : BLOCKED_STATE,
        complete,
        evidenceSha256: evidenceDigest(evidence),
        missing: Object.freeze([...missing]),
        violations: Object.freeze([...violations]),
        manualPilotReviewAllowed: complete,
        featureEnableAuthorized: false,
        productionCutoverAuthorized: false,
        computeRouterAuthorityChanged: false,
        mhsActuationEnabled: false,
    });
}

function createBlockedTemplate() {
    const phases = {};
    for (const [phase, gates] of Object.entries(REQUIREMENTS)) {
        const record = {
            status: 'PENDING',
            commit: null,
        };
        for (const gate of gates) record[gate] = false;
        phases[phase] = record;
    }

    return {
        schema: EVIDENCE_SCHEMA,
        phases,
        authority: { ...REQUIRED_AUTHORITY },
    };
}

module.exports = {
    BLOCKED_STATE,
    COMPLETE_STATE,
    EVIDENCE_SCHEMA,
    REQUIREMENTS,
    REQUIRED_AUTHORITY,
    RESULT_SCHEMA,
    createBlockedTemplate,
    evaluateScene3DPilotReadiness,
    evidenceDigest,
    normalizeJson,
};
