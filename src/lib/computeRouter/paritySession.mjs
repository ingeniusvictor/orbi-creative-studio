import { SHADOW_EVENT } from './studioShadowObserver.mjs';
import { createParityCertificationLedger } from './parityCertification.mjs';
import { buildParityDiagnosticReport, formatParityDiagnosticText } from './parityDiagnostics.mjs';

const ledger = createParityCertificationLedger();

let started = false;
let activeTarget = null;
let activeHandler = null;

function resolveEventTarget(target = globalThis?.window) {
    if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
        return null;
    }
    return target;
}

function startStudioParitySessionCollector({ eventTarget } = {}) {
    const target = resolveEventTarget(eventTarget);
    if (!target) return () => {};

    if (started) {
        return () => stopStudioParitySessionCollector();
    }

    activeTarget = target;
    activeHandler = (event) => {
        try {
            if (!event || event.type !== SHADOW_EVENT || !event.detail) return;
            ledger.record(event.detail);
        } catch {
            // Session diagnostics must never affect Studio behavior.
        }
    };

    activeTarget.addEventListener(SHADOW_EVENT, activeHandler);
    started = true;

    return () => stopStudioParitySessionCollector();
}

function stopStudioParitySessionCollector() {
    if (started && activeTarget && activeHandler) {
        activeTarget.removeEventListener(SHADOW_EVENT, activeHandler);
    }
    started = false;
    activeTarget = null;
    activeHandler = null;
}

function getStudioParitySessionEvidence() {
    return ledger.snapshot();
}

function evaluateStudioParitySession(targets) {
    return ledger.evaluate(targets);
}

function buildStudioParityDiagnosticReport(targets, { generatedAt = Date.now() } = {}) {
    const evidence = ledger.snapshot();
    const certification = ledger.evaluate(targets);
    return buildParityDiagnosticReport({
        evidence,
        certification,
        generatedAt,
    });
}

function formatStudioParityDiagnosticReport(targets, options) {
    return formatParityDiagnosticText(
        buildStudioParityDiagnosticReport(targets, options),
    );
}

function clearStudioParitySessionEvidence() {
    ledger.clear();
}

function getStudioParitySessionState() {
    return Object.freeze({
        started,
        sampleCount: ledger.snapshot().length,
    });
}

export {
    buildStudioParityDiagnosticReport,
    clearStudioParitySessionEvidence,
    formatStudioParityDiagnosticReport,
    evaluateStudioParitySession,
    getStudioParitySessionEvidence,
    getStudioParitySessionState,
    startStudioParitySessionCollector,
    stopStudioParitySessionCollector,
};
