import { t } from '../lib/i18n.js';
import {
    bindCurrentStudioParitySessionToBuild,
    buildCurrentStudioParityDiagnosticReport,
    formatCurrentStudioParityDiagnosticReport,
    getStudioParitySessionState,
} from '../lib/computeRouter/paritySession.mjs';
import { getRendererBuildIdentity } from '../lib/computeRouter/buildIdentityClient.mjs';
import { validateShadowCompatibilitySnapshot } from '../lib/computeRouter/shadowCompatibilityDiagnostics.mjs';

function makeText(tag, text, style = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
}

function makeMetric(label, value) {
    const card = document.createElement('div');
    card.style.cssText = 'padding:0.75rem;border:1px solid rgba(255,255,255,0.08);border-radius:0.75rem;background:rgba(255,255,255,0.03);min-width:0;';
    card.appendChild(makeText(
        'div',
        label,
        'font-size:0.65rem;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.04em;font-weight:700;',
    ));
    card.appendChild(makeText(
        'div',
        String(value),
        'font-size:1.1rem;color:#fff;font-weight:800;margin-top:0.2rem;word-break:break-word;',
    ));
    return card;
}

function statusLabel(status) {
    const key = {
        certified: 'routerDiagnostics.statusCertified',
        mismatch: 'routerDiagnostics.statusMismatch',
        blocked: 'routerDiagnostics.statusBlocked',
        'insufficient-samples': 'routerDiagnostics.statusSamples',
        'insufficient-model-coverage': 'routerDiagnostics.statusModels',
        'not-certified': 'routerDiagnostics.statusNotCertified',
    }[status] || 'routerDiagnostics.statusNotCertified';
    return t(key);
}

function statusStyle(status) {
    if (status === 'certified') return 'color:#67e8f9;background:rgba(34,211,238,0.1);border-color:rgba(34,211,238,0.24);';
    if (status === 'mismatch') return 'color:#fca5a5;background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.24);';
    if (status === 'blocked') return 'color:#fdba74;background:rgba(249,115,22,0.1);border-color:rgba(249,115,22,0.24);';
    return 'color:#fde68a;background:rgba(234,179,8,0.08);border-color:rgba(234,179,8,0.2);';
}

function renderTarget(route) {
    const row = document.createElement('div');
    row.style.cssText = 'padding:0.75rem;border:1px solid rgba(255,255,255,0.07);border-radius:0.75rem;background:rgba(255,255,255,0.02);display:flex;flex-direction:column;gap:0.45rem;';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;';

    top.appendChild(makeText(
        'div',
        route.routeKey,
        'font-size:0.75rem;color:#fff;font-weight:800;word-break:break-word;',
    ));

    const badge = makeText('span', statusLabel(route.status));
    badge.style.cssText = `font-size:0.62rem;font-weight:800;border:1px solid;border-radius:999px;padding:0.2rem 0.5rem;white-space:nowrap;${statusStyle(route.status)}`;
    top.appendChild(badge);

    const detail = makeText(
        'div',
        `${t('routerDiagnostics.samples')} ${route.samples}/${route.minSamples} · ${t('routerDiagnostics.models')} ${route.distinctModels}/${route.minDistinctModels} · match ${route.matches} · blocked ${route.blocked} · mismatch ${route.mismatches}`,
        'font-size:0.68rem;color:rgba(255,255,255,0.45);line-height:1.4;',
    );

    row.appendChild(top);
    row.appendChild(detail);

    if (route.reasons?.length) {
        row.appendChild(makeText(
            'div',
            `${t('routerDiagnostics.reasons')}: ${route.reasons.join(', ')}`,
            'font-size:0.65rem;color:rgba(255,255,255,0.32);line-height:1.35;',
        ));
    }

    return row;
}


function shadowCompatibilityLabel(status) {
    const key = {
        COMPATIBILITY_CANDIDATE: 'routerDiagnostics.shadowCandidate',
        COMPATIBILITY_BLOCKED: 'routerDiagnostics.shadowBlocked',
        COMPATIBILITY_UNKNOWN: 'routerDiagnostics.shadowUnknown',
    }[status] || 'routerDiagnostics.shadowUnknown';
    return t(key);
}

function formatResourcePair(observedMiB, requiredMiB) {
    const observed = Number.isFinite(observedMiB) ? Math.round(observedMiB) : '—';
    const required = Number.isFinite(requiredMiB) ? Math.round(requiredMiB) : '—';
    return `${observed} / ${required} MiB`;
}

function resolveShadowCompatibilitySnapshot(snapshot, provider) {
    if (typeof provider !== 'function') return snapshot;
    try {
        return provider();
    } catch {
        return null;
    }
}

function normalizeRuntimeCertificationStatus(status) {
    if (!status
        || typeof status !== 'object'
        || !['RUNTIME_CERTIFICATION_STATUS_READY', 'RUNTIME_CERTIFICATION_STATUS_UNAVAILABLE'].includes(status.status)
        || status.sourceType !== 'source-controlled-static-bundle'
        || !Number.isInteger(status.certificationCount)
        || status.certificationCount < 0
        || typeof status.sourceContractValid !== 'boolean'
        || status.authenticityVerified !== false
        || status.routingEligible !== false
        || status.cutoverAuthorized !== false
        || status.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    if (status.status === 'RUNTIME_CERTIFICATION_STATUS_READY'
        && status.sourceContractValid !== true) {
        return null;
    }
    if (status.status === 'RUNTIME_CERTIFICATION_STATUS_UNAVAILABLE'
        && status.sourceContractValid !== false) {
        return null;
    }

    return Object.freeze({
        status: status.status,
        sourceType: status.sourceType,
        certificationCount: status.certificationCount,
        sourceContractValid: status.sourceContractValid,
        authenticityVerified: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function resolveRuntimeCertificationStatus(provider) {
    if (typeof provider !== 'function') return null;
    try {
        return normalizeRuntimeCertificationStatus(provider());
    } catch {
        return null;
    }
}

function renderRuntimeCertificationStatus(status) {
    const section = document.createElement('div');
    section.dataset.orbiRuntimeCertificationStatus = 'read-only';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(167,139,250,0.12);border-radius:0.75rem;background:rgba(139,92,246,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.runtimeCertificationTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.runtimeCertificationSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    if (!status) {
        section.appendChild(makeText(
            'div',
            t('routerDiagnostics.runtimeCertificationUnavailable'),
            'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.68rem;',
        ));
        return section;
    }

    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.runtimeCertificationSource'),
        t('routerDiagnostics.runtimeCertificationSourceControlled'),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.runtimeCertificationCount'),
        status.certificationCount,
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.runtimeCertificationContract'),
        status.sourceContractValid
            ? t('routerDiagnostics.runtimeCertificationValid')
            : t('routerDiagnostics.runtimeCertificationInvalid'),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.runtimeCertificationAuthenticity'),
        t('routerDiagnostics.runtimeCertificationNotVerified'),
    ));
    section.appendChild(metrics);

    section.appendChild(makeText(
        'div',
        status.certificationCount === 0
            ? t('routerDiagnostics.runtimeCertificationEmptyNote')
            : t('routerDiagnostics.runtimeCertificationLoadedNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.28);line-height:1.4;',
    ));
    return section;
}

function shadowRefreshStatusLabel(status) {
    const key = {
        running: 'routerDiagnostics.shadowRefreshRunning',
        updated: 'routerDiagnostics.shadowRefreshUpdated',
        unchanged: 'routerDiagnostics.shadowRefreshUnchanged',
        rejected: 'routerDiagnostics.shadowRefreshRejected',
        'selection-required': 'routerDiagnostics.shadowSelectionRequired',
    }[status];
    return key ? t(key) : null;
}

function shadowTargetKey(target) {
    return `${target.modelId}::${target.backend}::${target.width}x${target.height}`;
}

function normalizeShadowDiagnosticTargets(result) {
    if (!result
        || result.status !== 'USER_SHADOW_DIAGNOSTIC_TARGETS_READY'
        || result.diagnosticOnly !== true
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only'
        || !Array.isArray(result.targets)) {
        return null;
    }

    const targets = [];
    const keys = new Set();
    for (const target of result.targets) {
        if (!target
            || typeof target !== 'object'
            || typeof target.modelId !== 'string'
            || !target.modelId
            || !['cpu', 'cuda12'].includes(target.backend)
            || !Number.isInteger(target.width)
            || target.width <= 0
            || !Number.isInteger(target.height)
            || target.height <= 0) {
            return null;
        }
        const normalized = Object.freeze({
            modelId: target.modelId,
            backend: target.backend,
            width: target.width,
            height: target.height,
        });
        const key = shadowTargetKey(normalized);
        if (keys.has(key)) return null;
        keys.add(key);
        targets.push(normalized);
    }
    return Object.freeze(targets);
}

function sameDiagnosticTarget(left, right) {
    return Boolean(left)
        && Boolean(right)
        && left.modelId === right.modelId
        && left.backend === right.backend
        && left.width === right.width
        && left.height === right.height;
}

function normalizeBenchmarkSessionState(state, target) {
    if (!state
        || typeof state !== 'object'
        || !sameDiagnosticTarget(state.context, target)
        || ![
            'USER_BENCHMARK_SESSION_EMPTY',
            'USER_BENCHMARK_SESSION_COLLECTING',
            'USER_BENCHMARK_SESSION_READY_FOR_REVIEW',
        ].includes(state.status)
        || !Number.isInteger(state.sampleCount)
        || state.sampleCount < 0
        || state.sampleCount > 3
        || state.requiredSamples !== 3
        || state.readyForReview !== (state.sampleCount === 3)
        || state.benchmarkOnly !== true
        || state.productionProfilePromoted !== false
        || state.routingEligible !== false
        || state.cutoverAuthorized !== false
        || state.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    return Object.freeze({
        status: state.status,
        context: Object.freeze({ ...target }),
        sampleCount: state.sampleCount,
        requiredSamples: 3,
        readyForReview: state.readyForReview,
        benchmarkOnly: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function resolveBenchmarkSessionState(provider, target) {
    if (typeof provider !== 'function' || !target) return null;
    try {
        return normalizeBenchmarkSessionState(provider(target), target);
    } catch {
        return null;
    }
}

function benchmarkSessionStatusLabel(state) {
    if (!state) return t('routerDiagnostics.benchmarkStatusUnavailable');
    const key = {
        USER_BENCHMARK_SESSION_EMPTY: 'routerDiagnostics.benchmarkStatusEmpty',
        USER_BENCHMARK_SESSION_COLLECTING: 'routerDiagnostics.benchmarkStatusCollecting',
        USER_BENCHMARK_SESSION_READY_FOR_REVIEW: 'routerDiagnostics.benchmarkStatusReady',
    }[state.status] || 'routerDiagnostics.benchmarkStatusUnavailable';
    return t(key);
}

function benchmarkActionStatusLabel(status) {
    const key = {
        running: 'routerDiagnostics.benchmarkRunning',
        captured: 'routerDiagnostics.benchmarkCaptured',
        ready: 'routerDiagnostics.benchmarkReady',
        rejected: 'routerDiagnostics.benchmarkRejected',
        'selection-required': 'routerDiagnostics.benchmarkSelectionRequired',
    }[status];
    return key ? t(key) : null;
}

function renderBenchmarkSessionSection(target, state, {
    onCapture = null,
    actionStatus = 'idle',
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiBenchmarkSession = 'review-evidence-only';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(251,191,36,0.14);border-radius:0.75rem;background:rgba(245,158,11,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.benchmarkTarget'),
        target
            ? `${target.modelId} · ${target.backend} · ${target.width}×${target.height}`
            : t('routerDiagnostics.benchmarkNoTarget'),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.benchmarkSamples'),
        state ? `${state.sampleCount}/${state.requiredSamples}` : '0/3',
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.benchmarkStatus'),
        benchmarkSessionStatusLabel(state),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.executionAuthority'),
        'legacy-dispatcher-only',
    ));
    section.appendChild(metrics);

    if (typeof onCapture === 'function') {
        const actionWrap = document.createElement('div');
        actionWrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.orbiBenchmarkCapture = 'benchmark-only';
        button.textContent = t('routerDiagnostics.benchmarkRunSample');
        button.disabled = actionStatus === 'running' || state?.readyForReview === true;
        button.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(245,158,11,0.09);border:1px solid rgba(251,191,36,0.22);color:#fde68a;font-size:0.68rem;font-weight:700;cursor:pointer;';
        button.onclick = onCapture;
        actionWrap.appendChild(button);

        const actionLabel = benchmarkActionStatusLabel(actionStatus);
        if (actionLabel) {
            actionWrap.appendChild(makeText(
                'span',
                actionLabel,
                'font-size:0.62rem;color:rgba(255,255,255,0.38);',
            ));
        }
        section.appendChild(actionWrap);
    }

    section.appendChild(makeText(
        'div',
        state?.readyForReview
            ? t('routerDiagnostics.benchmarkReadyNote')
            : t('routerDiagnostics.benchmarkResourceWarning'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkBoundaryNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.24);line-height:1.4;',
    ));

    return section;
}

function normalizeBenchmarkReviewState(result, target) {
    if (!result
        || typeof result !== 'object'
        || !sameDiagnosticTarget(result.context, target)
        || !['USER_BENCHMARK_REVIEW_EMPTY', 'USER_BENCHMARK_REVIEW_READY'].includes(result.status)
        || result.reviewOnly !== true
        || result.requiresHumanCertification !== true
        || result.productionProfilePromoted !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    if (result.status === 'USER_BENCHMARK_REVIEW_EMPTY') {
        if (result.summary !== null) return null;
        return Object.freeze({ status: result.status, summary: null });
    }

    const summary = result.summary;
    if (!summary
        || typeof summary !== 'object'
        || summary.modelId !== target.modelId
        || summary.backend !== target.backend
        || summary.resolution?.width !== target.width
        || summary.resolution?.height !== target.height
        || summary.runCount !== 3
        || !Array.isArray(summary.runIndexes)
        || summary.runIndexes.length !== 3
        || new Set(summary.runIndexes).size !== 3
        || summary.runIndexes.some((value) => !Number.isInteger(value) || value < 1 || value > 3)
        || !Number.isFinite(summary.safetyMarginPct)
        || summary.safetyMarginPct < 0
        || summary.safetyMarginPct > 100
        || !Number.isFinite(summary.observedPeakSystemRamMiB)
        || summary.observedPeakSystemRamMiB <= 0
        || !Number.isFinite(summary.requirements?.minSystemRamMiB)
        || summary.requirements.minSystemRamMiB <= 0
        || summary.requiresHumanCertification !== true
        || summary.productionProfilePromoted !== false
        || summary.routingEligible !== false
        || summary.cutoverAuthorized !== false
        || summary.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    if (target.backend === 'cuda12'
        && (!Number.isFinite(summary.observedPeakVramMiB)
            || summary.observedPeakVramMiB <= 0
            || !Number.isFinite(summary.requirements.minVramMiB)
            || summary.requirements.minVramMiB <= 0)) {
        return null;
    }

    return Object.freeze({
        status: result.status,
        summary: Object.freeze({
            modelId: summary.modelId,
            backend: summary.backend,
            resolution: Object.freeze({ ...summary.resolution }),
            runCount: 3,
            safetyMarginPct: summary.safetyMarginPct,
            observedPeakSystemRamMiB: summary.observedPeakSystemRamMiB,
            observedPeakVramMiB: target.backend === 'cuda12' ? summary.observedPeakVramMiB : null,
            minSystemRamMiB: summary.requirements.minSystemRamMiB,
            minVramMiB: target.backend === 'cuda12' ? summary.requirements.minVramMiB : null,
        }),
    });
}

function resolveBenchmarkReviewState(provider, target) {
    if (typeof provider !== 'function' || !target) return null;
    try {
        return normalizeBenchmarkReviewState(provider(target), target);
    } catch {
        return null;
    }
}

function validReviewMarginInput(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100;
}

function benchmarkReviewActionStatusLabel(status) {
    const key = {
        running: 'routerDiagnostics.benchmarkReviewPreparing',
        ready: 'routerDiagnostics.benchmarkReviewPrepared',
        rejected: 'routerDiagnostics.benchmarkReviewRejected',
    }[status];
    return key ? t(key) : null;
}

function renderBenchmarkReviewSection(target, benchmarkState, reviewState, {
    marginValue = '',
    onMarginChange = null,
    onPrepare = null,
    actionStatus = 'idle',
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiBenchmarkReview = 'review-only';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(167,139,250,0.16);border-radius:0.75rem;background:rgba(139,92,246,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkReviewTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkReviewSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    if (reviewState?.summary) {
        const summary = reviewState.summary;
        const metrics = document.createElement('div');
        metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkReviewMargin'),
            `${summary.safetyMarginPct}%`,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkReviewSystemRam'),
            `${Math.round(summary.observedPeakSystemRamMiB)} → ${Math.round(summary.minSystemRamMiB)} MiB`,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkReviewVram'),
            target?.backend === 'cuda12'
                ? `${Math.round(summary.observedPeakVramMiB)} → ${Math.round(summary.minVramMiB)} MiB`
                : t('routerDiagnostics.benchmarkReviewNotApplicable'),
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkReviewStatus'),
            t('routerDiagnostics.benchmarkReviewReady'),
        ));
        section.appendChild(metrics);
    } else {
        section.appendChild(makeText(
            'div',
            benchmarkState?.readyForReview
                ? t('routerDiagnostics.benchmarkReviewAwaitingMargin')
                : t('routerDiagnostics.benchmarkReviewNeedsSamples'),
            'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.68rem;',
        ));
    }

    if (benchmarkState?.readyForReview === true
        && typeof onMarginChange === 'function'
        && typeof onPrepare === 'function') {
        const actionWrap = document.createElement('div');
        actionWrap.style.cssText = 'display:flex;align-items:flex-end;gap:0.6rem;flex-wrap:wrap;';

        const marginWrap = document.createElement('label');
        marginWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem;font-size:0.62rem;color:rgba(255,255,255,0.42);font-weight:700;';
        marginWrap.appendChild(makeText('span', t('routerDiagnostics.benchmarkReviewMarginInput')));

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '100';
        input.step = '1';
        input.value = marginValue;
        input.placeholder = t('routerDiagnostics.benchmarkReviewMarginPlaceholder');
        input.dataset.orbiBenchmarkSafetyMargin = 'explicit-review-input';
        input.style.cssText = 'width:7rem;padding:0.4rem 0.55rem;border-radius:0.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.68rem;';
        marginWrap.appendChild(input);
        actionWrap.appendChild(marginWrap);

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.orbiBenchmarkReviewPrepare = 'review-only';
        button.textContent = t('routerDiagnostics.benchmarkReviewPrepare');
        button.disabled = actionStatus === 'running' || !validReviewMarginInput(marginValue);
        button.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(139,92,246,0.1);border:1px solid rgba(167,139,250,0.24);color:#ddd6fe;font-size:0.68rem;font-weight:700;cursor:pointer;';
        button.onclick = onPrepare;
        actionWrap.appendChild(button);

        input.oninput = () => {
            onMarginChange(input.value);
            button.disabled = actionStatus === 'running' || !validReviewMarginInput(input.value);
        };

        const actionLabel = benchmarkReviewActionStatusLabel(actionStatus);
        if (actionLabel) {
            actionWrap.appendChild(makeText(
                'span',
                actionLabel,
                'font-size:0.62rem;color:rgba(255,255,255,0.38);',
            ));
        }
        section.appendChild(actionWrap);
    }

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkReviewBoundaryNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.24);line-height:1.4;',
    ));

    return section;
}

function normalizeBenchmarkCertificationState(result, target) {
    if (!result
        || typeof result !== 'object'
        || !sameDiagnosticTarget(result.context, target)
        || ![
            'USER_BENCHMARK_CERTIFICATION_EMPTY',
            'USER_BENCHMARK_CERTIFICATION_RECORDED',
        ].includes(result.status)
        || result.certificationOnly !== true
        || result.runtimeRegistryLoaded !== false
        || result.reviewerIdentityVerified !== false
        || result.authenticityVerified !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    if (result.status === 'USER_BENCHMARK_CERTIFICATION_EMPTY') {
        if (result.summary !== null) return null;
        return Object.freeze({ status: result.status, summary: null });
    }

    const summary = result.summary;
    if (!summary
        || typeof summary !== 'object'
        || summary.modelId !== target.modelId
        || summary.backend !== target.backend
        || summary.resolution?.width !== target.width
        || summary.resolution?.height !== target.height
        || typeof summary.certifiedAt !== 'string'
        || !Number.isFinite(Date.parse(summary.certifiedAt))
        || typeof summary.reviewerDisplayName !== 'string'
        || !summary.reviewerDisplayName.trim()
        || !Number.isFinite(summary.requirements?.minSystemRamMiB)
        || summary.requirements.minSystemRamMiB <= 0
        || summary.reviewerIdentityVerified !== false
        || summary.authenticityVerified !== false
        || summary.runtimeRegistryLoaded !== false
        || summary.routingEligible !== false
        || summary.cutoverAuthorized !== false
        || summary.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    if (target.backend === 'cuda12'
        && (!Number.isFinite(summary.requirements.minVramMiB)
            || summary.requirements.minVramMiB <= 0)) {
        return null;
    }

    return Object.freeze({
        status: result.status,
        summary: Object.freeze({
            modelId: summary.modelId,
            backend: summary.backend,
            resolution: Object.freeze({ ...summary.resolution }),
            certifiedAt: summary.certifiedAt,
            minSystemRamMiB: summary.requirements.minSystemRamMiB,
            minVramMiB: target.backend === 'cuda12' ? summary.requirements.minVramMiB : null,
            reviewerDisplayName: summary.reviewerDisplayName.trim(),
            reviewerIdentityVerified: false,
            authenticityVerified: false,
            runtimeRegistryLoaded: false,
        }),
    });
}

function resolveBenchmarkCertificationState(provider, target) {
    if (typeof provider !== 'function' || !target) return null;
    try {
        return normalizeBenchmarkCertificationState(provider(target), target);
    } catch {
        return null;
    }
}

function validCertificationForm({
    reviewerId,
    reviewerDisplayName,
    reviewNote,
    approved,
} = {}) {
    return typeof reviewerId === 'string'
        && reviewerId.trim().length > 0
        && reviewerId.trim().length <= 200
        && typeof reviewerDisplayName === 'string'
        && reviewerDisplayName.trim().length > 0
        && reviewerDisplayName.trim().length <= 200
        && typeof reviewNote === 'string'
        && reviewNote.trim().length > 0
        && reviewNote.trim().length <= 2000
        && approved === true;
}

function benchmarkCertificationActionStatusLabel(status) {
    const key = {
        running: 'routerDiagnostics.benchmarkCertificationRecording',
        recorded: 'routerDiagnostics.benchmarkCertificationRecorded',
        rejected: 'routerDiagnostics.benchmarkCertificationRejected',
    }[status];
    return key ? t(key) : null;
}

function renderBenchmarkCertificationSection(target, reviewState, certificationState, {
    reviewerId = '',
    reviewerDisplayName = '',
    reviewNote = '',
    approved = false,
    onReviewerIdChange = null,
    onReviewerDisplayNameChange = null,
    onReviewNoteChange = null,
    onApprovalChange = null,
    onCertify = null,
    actionStatus = 'idle',
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiBenchmarkCertification = 'certification-only';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(52,211,153,0.16);border-radius:0.75rem;background:rgba(16,185,129,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkCertificationTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkCertificationSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    if (certificationState?.summary) {
        const summary = certificationState.summary;
        const metrics = document.createElement('div');
        metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkCertificationReviewer'),
            summary.reviewerDisplayName,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkCertificationSystemRam'),
            `${Math.round(summary.minSystemRamMiB)} MiB`,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkCertificationVram'),
            target?.backend === 'cuda12'
                ? `${Math.round(summary.minVramMiB)} MiB`
                : t('routerDiagnostics.benchmarkReviewNotApplicable'),
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkCertificationIdentity'),
            t('routerDiagnostics.benchmarkCertificationNotVerified'),
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkCertificationAuthenticity'),
            t('routerDiagnostics.benchmarkCertificationNotVerified'),
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.benchmarkCertificationRuntimeRegistry'),
            t('routerDiagnostics.benchmarkCertificationNotLoaded'),
        ));
        section.appendChild(metrics);
    } else {
        section.appendChild(makeText(
            'div',
            reviewState?.summary
                ? t('routerDiagnostics.benchmarkCertificationReady')
                : t('routerDiagnostics.benchmarkCertificationNeedsReview'),
            'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.68rem;',
        ));
    }

    if (reviewState?.summary
        && !certificationState?.summary
        && typeof onReviewerIdChange === 'function'
        && typeof onReviewerDisplayNameChange === 'function'
        && typeof onReviewNoteChange === 'function'
        && typeof onApprovalChange === 'function'
        && typeof onCertify === 'function') {
        const form = document.createElement('div');
        form.style.cssText = 'display:flex;flex-direction:column;gap:0.55rem;';

        const reviewerRow = document.createElement('div');
        reviewerRow.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.55rem;';

        const idWrap = document.createElement('label');
        idWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem;font-size:0.62rem;color:rgba(255,255,255,0.42);font-weight:700;';
        idWrap.appendChild(makeText('span', t('routerDiagnostics.benchmarkCertificationReviewerId')));
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.maxLength = 200;
        idInput.value = reviewerId;
        idInput.dataset.orbiCertificationReviewerId = 'declared-metadata';
        idInput.style.cssText = 'padding:0.4rem 0.55rem;border-radius:0.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.68rem;';
        idWrap.appendChild(idInput);
        reviewerRow.appendChild(idWrap);

        const nameWrap = document.createElement('label');
        nameWrap.style.cssText = idWrap.style.cssText;
        nameWrap.appendChild(makeText('span', t('routerDiagnostics.benchmarkCertificationReviewerName')));
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.maxLength = 200;
        nameInput.value = reviewerDisplayName;
        nameInput.dataset.orbiCertificationReviewerName = 'declared-metadata';
        nameInput.style.cssText = idInput.style.cssText;
        nameWrap.appendChild(nameInput);
        reviewerRow.appendChild(nameWrap);
        form.appendChild(reviewerRow);

        const noteWrap = document.createElement('label');
        noteWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem;font-size:0.62rem;color:rgba(255,255,255,0.42);font-weight:700;';
        noteWrap.appendChild(makeText('span', t('routerDiagnostics.benchmarkCertificationReviewNote')));
        const noteInput = document.createElement('textarea');
        noteInput.maxLength = 2000;
        noteInput.rows = 3;
        noteInput.value = reviewNote;
        noteInput.dataset.orbiCertificationReviewNote = 'declared-metadata';
        noteInput.style.cssText = 'padding:0.5rem 0.6rem;border-radius:0.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.68rem;resize:vertical;';
        noteWrap.appendChild(noteInput);
        form.appendChild(noteWrap);

        const approvalWrap = document.createElement('label');
        approvalWrap.style.cssText = 'display:flex;align-items:flex-start;gap:0.45rem;font-size:0.62rem;color:rgba(255,255,255,0.42);line-height:1.4;cursor:pointer;';
        const approvalInput = document.createElement('input');
        approvalInput.type = 'checkbox';
        approvalInput.checked = approved;
        approvalInput.dataset.orbiCertificationApproval = 'explicit-human-approval';
        approvalWrap.appendChild(approvalInput);
        approvalWrap.appendChild(makeText('span', t('routerDiagnostics.benchmarkCertificationApproval')));
        form.appendChild(approvalWrap);

        const actionWrap = document.createElement('div');
        actionWrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.orbiBenchmarkCertificationRecord = 'certification-only';
        button.textContent = t('routerDiagnostics.benchmarkCertificationRecord');
        button.disabled = actionStatus === 'running' || !validCertificationForm({
            reviewerId,
            reviewerDisplayName,
            reviewNote,
            approved,
        });
        button.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(16,185,129,0.1);border:1px solid rgba(52,211,153,0.24);color:#a7f3d0;font-size:0.68rem;font-weight:700;cursor:pointer;';
        button.onclick = onCertify;
        actionWrap.appendChild(button);

        const syncButton = () => {
            button.disabled = actionStatus === 'running' || !validCertificationForm({
                reviewerId: idInput.value,
                reviewerDisplayName: nameInput.value,
                reviewNote: noteInput.value,
                approved: approvalInput.checked,
            });
        };

        idInput.addEventListener('input', () => {
            onReviewerIdChange(idInput.value);
            syncButton();
        });
        nameInput.addEventListener('input', () => {
            onReviewerDisplayNameChange(nameInput.value);
            syncButton();
        });
        noteInput.addEventListener('input', () => {
            onReviewNoteChange(noteInput.value);
            syncButton();
        });
        approvalInput.addEventListener('change', () => {
            onApprovalChange(approvalInput.checked);
            syncButton();
        });

        const statusLabel = benchmarkCertificationActionStatusLabel(actionStatus);
        if (statusLabel) {
            actionWrap.appendChild(makeText(
                'span',
                statusLabel,
                'font-size:0.62rem;color:rgba(255,255,255,0.38);',
            ));
        }
        form.appendChild(actionWrap);
        section.appendChild(form);
    }

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.benchmarkCertificationBoundaryNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.24);line-height:1.4;',
    ));

    return section;
}

function normalizeRuntimeCertificationPromotionState(result) {
    if (!result
        || !['RUNTIME_CERTIFICATION_PROMOTION_EMPTY', 'RUNTIME_CERTIFICATION_PROMOTION_READY'].includes(result.status)
        || result.promotionOnly !== true
        || result.sourceReviewRequired !== true
        || result.sourceMutationApplied !== false
        || result.runtimeRegistryLoaded !== false
        || result.authenticityVerified !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    if (result.status === 'RUNTIME_CERTIFICATION_PROMOTION_READY') {
        const summary = result.summary;
        if (!summary
            || typeof summary.modelId !== 'string'
            || !summary.modelId
            || !['cpu', 'cuda12'].includes(summary.backend)
            || !Number.isInteger(summary.resolution?.width)
            || !Number.isInteger(summary.resolution?.height)
            || !Number.isFinite(summary.minSystemRamMiB)
            || summary.minSystemRamMiB <= 0
            || (summary.backend === 'cuda12'
                && (!Number.isFinite(summary.minVramMiB) || summary.minVramMiB <= 0))
            || summary.sourceType !== 'source-controlled-static-bundle'
            || summary.baseSourceRevision !== 1
            || summary.proposedSourceRevision !== 2
            || summary.sourceReviewRequired !== true
            || summary.sourceMutationApplied !== false
            || summary.runtimeRegistryLoaded !== false
            || summary.authenticityVerified !== false
            || summary.routingEligible !== false
            || summary.cutoverAuthorized !== false
            || summary.executionAuthority !== 'legacy-dispatcher-only') {
            return null;
        }
    } else if (result.summary !== null) {
        return null;
    }

    return result;
}

function resolveRuntimeCertificationPromotionState(provider, target) {
    if (typeof provider !== 'function' || !target) return null;
    try {
        return normalizeRuntimeCertificationPromotionState(provider(target));
    } catch {
        return null;
    }
}

function runtimePromotionActionStatusLabel(status) {
    const key = {
        running: 'routerDiagnostics.runtimePromotionPreparing',
        prepared: 'routerDiagnostics.runtimePromotionPrepared',
        rejected: 'routerDiagnostics.runtimePromotionRejected',
    }[status];
    return key ? t(key) : null;
}

function renderRuntimeCertificationPromotionSection(target, certificationState, promotionState, {
    onPrepare = null,
    actionStatus = 'idle',
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiRuntimeCertificationPromotion = 'promotion-only';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(251,191,36,0.16);border-radius:0.75rem;background:rgba(245,158,11,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.runtimePromotionTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.runtimePromotionSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    if (promotionState?.summary) {
        const summary = promotionState.summary;
        const metrics = document.createElement('div');
        metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.runtimePromotionTarget'),
            `${summary.modelId} · ${summary.backend} · ${summary.resolution.width}×${summary.resolution.height}`,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.runtimePromotionRevision'),
            `${summary.baseSourceRevision} → ${summary.proposedSourceRevision}`,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.runtimePromotionSystemRam'),
            `${Math.round(summary.minSystemRamMiB)} MiB`,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.runtimePromotionVram'),
            summary.backend === 'cuda12'
                ? `${Math.round(summary.minVramMiB)} MiB`
                : t('routerDiagnostics.benchmarkReviewNotApplicable'),
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.runtimePromotionSourceReview'),
            t('routerDiagnostics.runtimePromotionRequired'),
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.runtimePromotionRuntimeRegistry'),
            t('routerDiagnostics.benchmarkCertificationNotLoaded'),
        ));
        section.appendChild(metrics);
    } else {
        section.appendChild(makeText(
            'div',
            certificationState?.summary
                ? t('routerDiagnostics.runtimePromotionReady')
                : t('routerDiagnostics.runtimePromotionNeedsCertification'),
            'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.68rem;',
        ));
    }

    if (certificationState?.summary
        && !promotionState?.summary
        && typeof onPrepare === 'function') {
        const actionWrap = document.createElement('div');
        actionWrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.orbiRuntimeCertificationPromotionPrepare = 'promotion-only';
        button.textContent = t('routerDiagnostics.runtimePromotionPrepare');
        button.disabled = actionStatus === 'running';
        button.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(245,158,11,0.1);border:1px solid rgba(251,191,36,0.24);color:#fde68a;font-size:0.68rem;font-weight:700;cursor:pointer;';
        button.onclick = onPrepare;
        actionWrap.appendChild(button);

        const statusLabel = runtimePromotionActionStatusLabel(actionStatus);
        if (statusLabel) {
            actionWrap.appendChild(makeText(
                'span',
                statusLabel,
                'font-size:0.62rem;color:rgba(255,255,255,0.38);',
            ));
        }
        section.appendChild(actionWrap);
    }

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.runtimePromotionBoundaryNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.24);line-height:1.4;',
    ));

    return section;
}

function renderShadowCompatibilitySection(snapshot, {
    onRefresh = null,
    refreshStatus = 'idle',
    targets = [],
    selectedTargetKey = null,
    onTargetChange = null,
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiShadowCompatibility = 'read-only';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(103,232,249,0.12);border-radius:0.75rem;background:rgba(34,211,238,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.shadowTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.shadowSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    if (targets.length > 1 && typeof onTargetChange === 'function') {
        const targetWrap = document.createElement('div');
        targetWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;';
        targetWrap.appendChild(makeText(
            'div',
            t('routerDiagnostics.shadowTarget'),
            'font-size:0.62rem;color:rgba(255,255,255,0.42);font-weight:700;',
        ));

        const select = document.createElement('select');
        select.dataset.orbiShadowTargetSelector = 'diagnostic-only';
        select.style.cssText = 'width:100%;padding:0.45rem 0.6rem;border-radius:0.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.68rem;';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('routerDiagnostics.shadowTargetSelect');
        select.appendChild(placeholder);

        for (const target of targets) {
            const option = document.createElement('option');
            option.value = shadowTargetKey(target);
            option.textContent = `${target.modelId} · ${target.backend} · ${target.width}×${target.height}`;
            select.appendChild(option);
        }

        select.value = selectedTargetKey || '';
        select.onchange = () => onTargetChange(select.value);
        targetWrap.appendChild(select);
        section.appendChild(targetWrap);
    }

    if (typeof onRefresh === 'function') {
        const refreshWrap = document.createElement('div');
        refreshWrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';

        const refreshButton = document.createElement('button');
        refreshButton.type = 'button';
        refreshButton.dataset.orbiShadowRefresh = 'diagnostic-only';
        refreshButton.textContent = t('routerDiagnostics.shadowRefresh');
        refreshButton.disabled = refreshStatus === 'running';
        refreshButton.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(34,211,238,0.08);border:1px solid rgba(103,232,249,0.2);color:#a5f3fc;font-size:0.68rem;font-weight:700;cursor:pointer;';
        refreshButton.onclick = onRefresh;
        refreshWrap.appendChild(refreshButton);

        const statusText = shadowRefreshStatusLabel(refreshStatus);
        if (statusText) {
            refreshWrap.appendChild(makeText(
                'span',
                statusText,
                'font-size:0.62rem;color:rgba(255,255,255,0.38);',
            ));
        }
        section.appendChild(refreshWrap);
    }

    const validation = validateShadowCompatibilitySnapshot(snapshot);
    if (!validation.ok) {
        section.appendChild(makeText(
            'div',
            t('routerDiagnostics.shadowUnavailable'),
            'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.68rem;',
        ));
        return section;
    }

    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.shadowContext'),
        `${snapshot.context.modelId} · ${snapshot.context.backend} · ${snapshot.context.width}×${snapshot.context.height}`,
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.shadowCompatibility'),
        shadowCompatibilityLabel(snapshot.compatibility.status),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.shadowProfile'),
        snapshot.registry.certifiedProfile
            ? t('routerDiagnostics.shadowCertified')
            : t('routerDiagnostics.shadowNotCertified'),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.shadowSystemRam'),
        formatResourcePair(
            snapshot.resources.systemRam.observedMiB,
            snapshot.resources.systemRam.requiredMiB,
        ),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.shadowVram'),
        formatResourcePair(
            snapshot.resources.vram.observedMiB,
            snapshot.resources.vram.requiredMiB,
        ),
    ));
    metrics.appendChild(makeMetric(
        t('routerDiagnostics.executionAuthority'),
        snapshot.boundaries.executionAuthority,
    ));
    section.appendChild(metrics);

    section.appendChild(makeText(
        'div',
        `${t('routerDiagnostics.shadowReasons')}: ${snapshot.compatibility.reasons.length
            ? snapshot.compatibility.reasons.join(', ')
            : t('routerDiagnostics.shadowNoReasons')}`,
        'font-size:0.62rem;color:rgba(255,255,255,0.32);line-height:1.4;word-break:break-word;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.shadowBoundaryNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.24);line-height:1.4;',
    ));

    return section;
}


function hardwarePilotExportStatusLabel(status) {
    const key = {
        running: 'routerDiagnostics.hardwarePilotExportRunning',
        written: 'routerDiagnostics.hardwarePilotExportWritten',
        canceled: 'routerDiagnostics.hardwarePilotExportCanceled',
        rejected: 'routerDiagnostics.hardwarePilotExportRejected',
    }[status];
    return key ? t(key) : null;
}

function normalizeHardwarePilotExportResult(result) {
    if (!result
        || typeof result !== 'object'
        || result.status !== 'HARDWARE_PILOT_EXPORT_WRITTEN'
        || typeof result.fileName !== 'string'
        || !result.fileName.trim()
        || /[\\/]/.test(result.fileName)
        || typeof result.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(result.sha256)
        || !Number.isInteger(result.bytes)
        || result.bytes <= 0
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    return Object.freeze({
        fileName: result.fileName,
        sha256: result.sha256,
        bytes: result.bytes,
    });
}

function renderHardwarePilotExportSection(target, benchmarkState, {
    onExport = null,
    actionStatus = 'idle',
    exportResult = null,
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiHardwarePilotExport = 'user-initiated-evidence-export';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(34,211,238,0.14);border-radius:0.75rem;background:rgba(34,211,238,0.025);';

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.hardwarePilotExportTitle'),
        'font-size:0.72rem;color:rgba(255,255,255,0.68);font-weight:800;',
    ));
    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.hardwarePilotExportSubtitle'),
        'font-size:0.62rem;color:rgba(255,255,255,0.3);line-height:1.4;',
    ));

    if (exportResult) {
        const metrics = document.createElement('div');
        metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.hardwarePilotExportFile'),
            exportResult.fileName,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.hardwarePilotExportBytes'),
            exportResult.bytes,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.hardwarePilotExportSha256'),
            exportResult.sha256,
        ));
        metrics.appendChild(makeMetric(
            t('routerDiagnostics.executionAuthority'),
            'legacy-dispatcher-only',
        ));
        section.appendChild(metrics);
    } else {
        section.appendChild(makeText(
            'div',
            benchmarkState?.readyForReview === true
                ? t('routerDiagnostics.hardwarePilotExportReady')
                : t('routerDiagnostics.hardwarePilotExportNeedsSamples'),
            'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.68rem;',
        ));
    }

    if (typeof onExport === 'function') {
        const actionWrap = document.createElement('div');
        actionWrap.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';

        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.orbiHardwarePilotExport = 'explicit-user-save';
        button.textContent = t('routerDiagnostics.hardwarePilotExportAction');
        button.disabled = actionStatus === 'running' || benchmarkState?.readyForReview !== true;
        button.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.22);color:#a5f3fc;font-size:0.68rem;font-weight:700;cursor:pointer;';
        button.onclick = onExport;
        actionWrap.appendChild(button);

        const statusLabel = hardwarePilotExportStatusLabel(actionStatus);
        if (statusLabel) {
            actionWrap.appendChild(makeText(
                'span',
                statusLabel,
                'font-size:0.62rem;color:rgba(255,255,255,0.38);',
            ));
        }

        section.appendChild(actionWrap);
    }

    section.appendChild(makeText(
        'div',
        t('routerDiagnostics.hardwarePilotExportBoundaryNote'),
        'font-size:0.62rem;color:rgba(255,255,255,0.24);line-height:1.4;',
    ));

    return section;
}

export function RouterDiagnosticsPanel({
    shadowCompatibilitySnapshot = null,
    shadowCompatibilitySnapshotProvider = null,
    shadowDiagnosticRefresh = null,
    shadowDiagnosticTargetsProvider = null,
    runtimeCertificationStatusProvider = null,
    benchmarkSampleCapture = null,
    benchmarkSessionStateProvider = null,
    benchmarkReviewPrepare = null,
    benchmarkReviewSummaryProvider = null,
    benchmarkCertificationRecord = null,
    benchmarkCertificationSummaryProvider = null,
    runtimeCertificationPromotionPrepare = null,
    runtimeCertificationPromotionSummaryProvider = null,
    hardwarePilotBundleBuild = null,
    hardwarePilotExport = null,
} = {}) {
    const panel = document.createElement('div');
    let shadowRefreshStatus = 'idle';
    let shadowDiagnosticTargets = [];
    let selectedShadowTargetKey = null;
    let benchmarkActionStatus = 'idle';
    let benchmarkReviewActionStatus = 'idle';
    let benchmarkSafetyMarginPct = '';
    let benchmarkCertificationActionStatus = 'idle';
    let benchmarkCertificationReviewerId = '';
    let benchmarkCertificationReviewerName = '';
    let benchmarkCertificationReviewNote = '';
    let benchmarkCertificationApproved = false;
    let runtimeCertificationPromotionActionStatus = 'idle';
    let hardwarePilotExportActionStatus = 'idle';
    let hardwarePilotExportResult = null;
    panel.dataset.orbiRouterDiagnostics = 'read-only';
    panel.style.cssText = 'display:flex;flex-direction:column;gap:1rem;';

    const render = () => {
        panel.innerHTML = '';

        const heading = document.createElement('div');
        heading.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;';

        const titleWrap = document.createElement('div');
        titleWrap.appendChild(makeText(
            'div',
            t('routerDiagnostics.title'),
            'font-size:0.9rem;color:#fff;font-weight:800;',
        ));
        titleWrap.appendChild(makeText(
            'div',
            t('routerDiagnostics.subtitle'),
            'font-size:0.68rem;color:rgba(255,255,255,0.38);margin-top:0.2rem;line-height:1.4;',
        ));

        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.textContent = t('routerDiagnostics.refresh');
        refresh.style.cssText = 'padding:0.4rem 0.7rem;border-radius:0.5rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);font-size:0.68rem;font-weight:700;cursor:pointer;white-space:nowrap;';
        refresh.onclick = render;

        heading.appendChild(titleWrap);
        heading.appendChild(refresh);
        panel.appendChild(heading);

        try {
            const state = getStudioParitySessionState();
            const report = buildCurrentStudioParityDiagnosticReport();
            const buildIdentity = getRendererBuildIdentity();
            const buildBinding = buildIdentity.available
                ? bindCurrentStudioParitySessionToBuild({
                    buildIdentity,
                    bindingId: `diagnostic-preview:${buildIdentity.sourceCommit}:${report.generatedAt}`,
                    boundAt: report.generatedAt,
                })
                : null;

            const buildHeading = makeText(
                'div',
                t('routerDiagnostics.buildIdentity'),
                'font-size:0.72rem;color:rgba(255,255,255,0.62);font-weight:800;margin-top:0.15rem;',
            );
            panel.appendChild(buildHeading);

            const buildMetrics = document.createElement('div');
            buildMetrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
            buildMetrics.appendChild(makeMetric(
                t('routerDiagnostics.buildVersion'),
                buildIdentity.available ? buildIdentity.appVersion : t('routerDiagnostics.unavailableValue'),
            ));
            buildMetrics.appendChild(makeMetric(
                t('routerDiagnostics.buildCommit'),
                buildIdentity.available ? buildIdentity.sourceCommit : t('routerDiagnostics.unavailableValue'),
            ));
            buildMetrics.appendChild(makeMetric(
                t('routerDiagnostics.sessionBinding'),
                buildBinding?.bindingValid
                    ? t('routerDiagnostics.bindingBound')
                    : t('routerDiagnostics.bindingRejected'),
            ));
            buildMetrics.appendChild(makeMetric(
                t('routerDiagnostics.executionAuthority'),
                buildBinding?.executionAuthority || 'legacy-dispatcher-only',
            ));
            panel.appendChild(buildMetrics);
            const runtimeCertificationStatus = resolveRuntimeCertificationStatus(
                runtimeCertificationStatusProvider,
            );
            panel.appendChild(renderRuntimeCertificationStatus(runtimeCertificationStatus));

            const resolvedShadowSnapshot = resolveShadowCompatibilitySnapshot(
                shadowCompatibilitySnapshot,
                shadowCompatibilitySnapshotProvider,
            );
            panel.appendChild(renderShadowCompatibilitySection(resolvedShadowSnapshot, {
                refreshStatus: shadowRefreshStatus,
                targets: shadowDiagnosticTargets,
                selectedTargetKey: selectedShadowTargetKey,
                onTargetChange: (targetKey) => {
                    selectedShadowTargetKey = shadowDiagnosticTargets
                        .some((target) => shadowTargetKey(target) === targetKey)
                        ? targetKey
                        : null;
                    shadowRefreshStatus = 'idle';
                    benchmarkActionStatus = 'idle';
                    benchmarkReviewActionStatus = 'idle';
                    benchmarkSafetyMarginPct = '';
                    benchmarkCertificationActionStatus = 'idle';
                    benchmarkCertificationReviewerId = '';
                    benchmarkCertificationReviewerName = '';
                    benchmarkCertificationReviewNote = '';
                    benchmarkCertificationApproved = false;
                    hardwarePilotExportActionStatus = 'idle';
                    hardwarePilotExportResult = null;
                    render();
                },
                onRefresh: typeof shadowDiagnosticRefresh === 'function'
                    ? async () => {
                        if (shadowRefreshStatus === 'running') return;
                        shadowRefreshStatus = 'running';
                        render();
                        try {
                            let selectedTarget = null;

                            if (typeof shadowDiagnosticTargetsProvider === 'function') {
                                const listed = await shadowDiagnosticTargetsProvider();
                                const normalizedTargets = normalizeShadowDiagnosticTargets(listed);
                                if (!normalizedTargets) {
                                    shadowRefreshStatus = 'rejected';
                                    render();
                                    return;
                                }

                                shadowDiagnosticTargets = [...normalizedTargets];
                                if (shadowDiagnosticTargets.length === 0) {
                                    selectedShadowTargetKey = null;
                                    shadowRefreshStatus = 'rejected';
                                    render();
                                    return;
                                }

                                if (shadowDiagnosticTargets.length === 1) {
                                    selectedTarget = shadowDiagnosticTargets[0];
                                    selectedShadowTargetKey = shadowTargetKey(selectedTarget);
                                } else {
                                    selectedTarget = shadowDiagnosticTargets.find(
                                        (target) => shadowTargetKey(target) === selectedShadowTargetKey,
                                    ) || null;
                                    if (!selectedTarget) {
                                        selectedShadowTargetKey = null;
                                        shadowRefreshStatus = 'selection-required';
                                        render();
                                        return;
                                    }
                                }
                            }

                            const result = await shadowDiagnosticRefresh(selectedTarget);
                            const authorityValid = result
                                && result.diagnosticOnly === true
                                && result.routingEligible === false
                                && result.cutoverAuthorized === false
                                && result.executionAuthority === 'legacy-dispatcher-only';

                            if (!authorityValid) {
                                shadowRefreshStatus = 'rejected';
                            } else if (result.status === 'USER_SHADOW_DIAGNOSTIC_REFRESH_UPDATED') {
                                shadowRefreshStatus = 'updated';
                            } else if (result.status === 'USER_SHADOW_DIAGNOSTIC_REFRESH_UNCHANGED') {
                                shadowRefreshStatus = 'unchanged';
                            } else {
                                shadowRefreshStatus = 'rejected';
                            }
                        } catch {
                            shadowRefreshStatus = 'rejected';
                        }
                        render();
                    }
                    : null,
            }));

            const selectedBenchmarkTarget = shadowDiagnosticTargets.find(
                (target) => shadowTargetKey(target) === selectedShadowTargetKey,
            ) || (shadowDiagnosticTargets.length === 1 ? shadowDiagnosticTargets[0] : null);
            const benchmarkSessionState = resolveBenchmarkSessionState(
                benchmarkSessionStateProvider,
                selectedBenchmarkTarget,
            );

            panel.appendChild(renderBenchmarkSessionSection(
                selectedBenchmarkTarget,
                benchmarkSessionState,
                {
                    actionStatus: benchmarkActionStatus,
                    onCapture: typeof benchmarkSampleCapture === 'function'
                        ? async () => {
                            if (benchmarkActionStatus === 'running') return;
                            benchmarkActionStatus = 'running';
                            render();
                            try {
                                let selectedTarget = shadowDiagnosticTargets.find(
                                    (target) => shadowTargetKey(target) === selectedShadowTargetKey,
                                ) || null;

                                if (typeof shadowDiagnosticTargetsProvider === 'function') {
                                    const listed = await shadowDiagnosticTargetsProvider();
                                    const normalizedTargets = normalizeShadowDiagnosticTargets(listed);
                                    if (!normalizedTargets || normalizedTargets.length === 0) {
                                        benchmarkActionStatus = 'rejected';
                                        render();
                                        return;
                                    }

                                    shadowDiagnosticTargets = [...normalizedTargets];
                                    if (shadowDiagnosticTargets.length === 1) {
                                        selectedTarget = shadowDiagnosticTargets[0];
                                        selectedShadowTargetKey = shadowTargetKey(selectedTarget);
                                    } else {
                                        selectedTarget = shadowDiagnosticTargets.find(
                                            (target) => shadowTargetKey(target) === selectedShadowTargetKey,
                                        ) || null;
                                        if (!selectedTarget) {
                                            selectedShadowTargetKey = null;
                                            benchmarkActionStatus = 'selection-required';
                                            render();
                                            return;
                                        }
                                    }
                                }

                                if (!selectedTarget) {
                                    benchmarkActionStatus = 'selection-required';
                                    render();
                                    return;
                                }

                                const result = await benchmarkSampleCapture(selectedTarget);
                                const authorityValid = result
                                    && result.benchmarkOnly === true
                                    && result.productionProfilePromoted === false
                                    && result.routingEligible === false
                                    && result.cutoverAuthorized === false
                                    && result.executionAuthority === 'legacy-dispatcher-only';

                                if (!authorityValid) {
                                    benchmarkActionStatus = 'rejected';
                                } else if (result.status === 'USER_BENCHMARK_SESSION_READY_FOR_REVIEW'
                                    && sameDiagnosticTarget(result.context, selectedTarget)
                                    && result.sampleCount === 3
                                    && result.requiredSamples === 3
                                    && result.readyForReview === true) {
                                    benchmarkActionStatus = 'ready';
                                } else if (result.status === 'USER_BENCHMARK_SESSION_COLLECTING'
                                    && sameDiagnosticTarget(result.context, selectedTarget)
                                    && Number.isInteger(result.sampleCount)
                                    && result.sampleCount >= 1
                                    && result.sampleCount < 3
                                    && result.requiredSamples === 3
                                    && result.readyForReview === false) {
                                    benchmarkActionStatus = 'captured';
                                } else {
                                    benchmarkActionStatus = 'rejected';
                                }
                            } catch {
                                benchmarkActionStatus = 'rejected';
                            }
                            render();
                        }
                        : null,
                },
            ));

            panel.appendChild(renderHardwarePilotExportSection(
                selectedBenchmarkTarget,
                benchmarkSessionState,
                {
                    actionStatus: hardwarePilotExportActionStatus,
                    exportResult: hardwarePilotExportResult,
                    onExport: typeof hardwarePilotBundleBuild === 'function'
                        && typeof hardwarePilotExport === 'function'
                        ? async () => {
                            if (hardwarePilotExportActionStatus === 'running'
                                || !selectedBenchmarkTarget
                                || benchmarkSessionState?.readyForReview !== true) {
                                hardwarePilotExportActionStatus = 'rejected';
                                render();
                                return;
                            }

                            hardwarePilotExportActionStatus = 'running';
                            hardwarePilotExportResult = null;
                            render();

                            try {
                                const pilot = hardwarePilotBundleBuild(selectedBenchmarkTarget);
                                const validPilot = pilot
                                    && pilot.status === 'HARDWARE_PILOT_EVIDENCE_READY'
                                    && pilot.reason === null
                                    && pilot.bundle
                                    && pilot.pilotEvidenceOnly === true
                                    && pilot.requiresHumanReview === true
                                    && pilot.productionProfilePromoted === false
                                    && pilot.routingEligible === false
                                    && pilot.cutoverAuthorized === false
                                    && pilot.executionAuthority === 'legacy-dispatcher-only';

                                if (!validPilot) {
                                    hardwarePilotExportActionStatus = 'rejected';
                                    render();
                                    return;
                                }

                                const result = await hardwarePilotExport(pilot.bundle);
                                if (result?.status === 'HARDWARE_PILOT_EXPORT_CANCELED') {
                                    hardwarePilotExportActionStatus = 'canceled';
                                    render();
                                    return;
                                }

                                const normalized = normalizeHardwarePilotExportResult(result);
                                if (!normalized) {
                                    hardwarePilotExportActionStatus = 'rejected';
                                    render();
                                    return;
                                }

                                hardwarePilotExportResult = normalized;
                                hardwarePilotExportActionStatus = 'written';
                            } catch {
                                hardwarePilotExportActionStatus = 'rejected';
                            }
                            render();
                        }
                        : null,
                },
            ));

            const benchmarkReviewState = resolveBenchmarkReviewState(
                benchmarkReviewSummaryProvider,
                selectedBenchmarkTarget,
            );
            panel.appendChild(renderBenchmarkReviewSection(
                selectedBenchmarkTarget,
                benchmarkSessionState,
                benchmarkReviewState,
                {
                    marginValue: benchmarkSafetyMarginPct,
                    actionStatus: benchmarkReviewActionStatus,
                    onMarginChange: (value) => {
                        benchmarkSafetyMarginPct = value;
                        benchmarkReviewActionStatus = 'idle';
                    },
                    onPrepare: typeof benchmarkReviewPrepare === 'function'
                        ? () => {
                            if (benchmarkReviewActionStatus === 'running'
                                || !selectedBenchmarkTarget
                                || benchmarkSessionState?.readyForReview !== true
                                || !validReviewMarginInput(benchmarkSafetyMarginPct)) {
                                benchmarkReviewActionStatus = 'rejected';
                                render();
                                return;
                            }

                            benchmarkReviewActionStatus = 'running';
                            render();
                            try {
                                const result = benchmarkReviewPrepare({
                                    target: selectedBenchmarkTarget,
                                    safetyMarginPct: Number(benchmarkSafetyMarginPct),
                                });
                                const authorityValid = result
                                    && result.reviewOnly === true
                                    && result.requiresHumanCertification === true
                                    && result.productionProfilePromoted === false
                                    && result.routingEligible === false
                                    && result.cutoverAuthorized === false
                                    && result.executionAuthority === 'legacy-dispatcher-only';

                                if (authorityValid
                                    && result.status === 'USER_BENCHMARK_REVIEW_READY'
                                    && sameDiagnosticTarget(result.context, selectedBenchmarkTarget)
                                    && result.summary?.runCount === 3) {
                                    benchmarkReviewActionStatus = 'ready';
                                } else {
                                    benchmarkReviewActionStatus = 'rejected';
                                }
                            } catch {
                                benchmarkReviewActionStatus = 'rejected';
                            }
                            render();
                        }
                        : null,
                },
            ));

            const benchmarkCertificationState = resolveBenchmarkCertificationState(
                benchmarkCertificationSummaryProvider,
                selectedBenchmarkTarget,
            );
            panel.appendChild(renderBenchmarkCertificationSection(
                selectedBenchmarkTarget,
                benchmarkReviewState,
                benchmarkCertificationState,
                {
                    reviewerId: benchmarkCertificationReviewerId,
                    reviewerDisplayName: benchmarkCertificationReviewerName,
                    reviewNote: benchmarkCertificationReviewNote,
                    approved: benchmarkCertificationApproved,
                    actionStatus: benchmarkCertificationActionStatus,
                    onReviewerIdChange: (value) => {
                        benchmarkCertificationReviewerId = value;
                        benchmarkCertificationActionStatus = 'idle';
                    },
                    onReviewerDisplayNameChange: (value) => {
                        benchmarkCertificationReviewerName = value;
                        benchmarkCertificationActionStatus = 'idle';
                    },
                    onReviewNoteChange: (value) => {
                        benchmarkCertificationReviewNote = value;
                        benchmarkCertificationActionStatus = 'idle';
                    },
                    onApprovalChange: (value) => {
                        benchmarkCertificationApproved = value === true;
                        benchmarkCertificationActionStatus = 'idle';
                    },
                    onCertify: typeof benchmarkCertificationRecord === 'function'
                        ? () => {
                            if (benchmarkCertificationActionStatus === 'running'
                                || !selectedBenchmarkTarget
                                || !benchmarkReviewState?.summary
                                || !validCertificationForm({
                                    reviewerId: benchmarkCertificationReviewerId,
                                    reviewerDisplayName: benchmarkCertificationReviewerName,
                                    reviewNote: benchmarkCertificationReviewNote,
                                    approved: benchmarkCertificationApproved,
                                })) {
                                benchmarkCertificationActionStatus = 'rejected';
                                render();
                                return;
                            }

                            benchmarkCertificationActionStatus = 'running';
                            render();
                            try {
                                const result = benchmarkCertificationRecord({
                                    target: selectedBenchmarkTarget,
                                    decision: 'approve',
                                    reviewer: {
                                        id: benchmarkCertificationReviewerId,
                                        displayName: benchmarkCertificationReviewerName,
                                    },
                                    reviewNote: benchmarkCertificationReviewNote,
                                });
                                const authorityValid = result
                                    && result.certificationOnly === true
                                    && result.runtimeRegistryLoaded === false
                                    && result.reviewerIdentityVerified === false
                                    && result.authenticityVerified === false
                                    && result.routingEligible === false
                                    && result.cutoverAuthorized === false
                                    && result.executionAuthority === 'legacy-dispatcher-only';

                                if (authorityValid
                                    && result.status === 'USER_BENCHMARK_CERTIFICATION_RECORDED'
                                    && sameDiagnosticTarget(result.context, selectedBenchmarkTarget)
                                    && result.summary?.runtimeRegistryLoaded === false) {
                                    benchmarkCertificationActionStatus = 'recorded';
                                } else {
                                    benchmarkCertificationActionStatus = 'rejected';
                                }
                            } catch {
                                benchmarkCertificationActionStatus = 'rejected';
                            }
                            render();
                        }
                        : null,
                },
            ));

            const runtimeCertificationPromotionState = resolveRuntimeCertificationPromotionState(
                runtimeCertificationPromotionSummaryProvider,
                selectedBenchmarkTarget,
            );
            panel.appendChild(renderRuntimeCertificationPromotionSection(
                selectedBenchmarkTarget,
                benchmarkCertificationState,
                runtimeCertificationPromotionState,
                {
                    actionStatus: runtimeCertificationPromotionActionStatus,
                    onPrepare: typeof runtimeCertificationPromotionPrepare === 'function'
                        ? () => {
                            if (runtimeCertificationPromotionActionStatus === 'running'
                                || !selectedBenchmarkTarget
                                || !benchmarkCertificationState?.summary) {
                                runtimeCertificationPromotionActionStatus = 'rejected';
                                render();
                                return;
                            }

                            runtimeCertificationPromotionActionStatus = 'running';
                            render();
                            try {
                                const result = runtimeCertificationPromotionPrepare(selectedBenchmarkTarget);
                                const authorityValid = result
                                    && result.promotionOnly === true
                                    && result.sourceReviewRequired === true
                                    && result.sourceMutationApplied === false
                                    && result.runtimeRegistryLoaded === false
                                    && result.authenticityVerified === false
                                    && result.routingEligible === false
                                    && result.cutoverAuthorized === false
                                    && result.executionAuthority === 'legacy-dispatcher-only';

                                if (authorityValid
                                    && result.status === 'RUNTIME_CERTIFICATION_PROMOTION_READY'
                                    && sameDiagnosticTarget(result.context, selectedBenchmarkTarget)
                                    && result.summary?.sourceMutationApplied === false
                                    && result.summary?.runtimeRegistryLoaded === false) {
                                    runtimeCertificationPromotionActionStatus = 'prepared';
                                } else {
                                    runtimeCertificationPromotionActionStatus = 'rejected';
                                }
                            } catch {
                                runtimeCertificationPromotionActionStatus = 'rejected';
                            }
                            render();
                        }
                        : null,
                },
            ));

            panel.appendChild(makeText(
                'div',
                t('routerDiagnostics.bindingPreviewNote'),
                'font-size:0.62rem;color:rgba(255,255,255,0.26);line-height:1.4;',
            ));

            const metrics = document.createElement('div');
            metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
            metrics.appendChild(makeMetric(t('routerDiagnostics.sessionSamples'), state.sampleCount));
            metrics.appendChild(makeMetric(t('routerDiagnostics.observedRoutes'), report.totals.observedRoutes));
            metrics.appendChild(makeMetric(
                t('routerDiagnostics.targets'),
                report.certification.targetCount,
            ));
            metrics.appendChild(makeMetric(
                t('routerDiagnostics.certification'),
                report.certification.certified
                    ? t('routerDiagnostics.certified')
                    : t('routerDiagnostics.notCertified'),
            ));
            panel.appendChild(metrics);

            const targetHeading = makeText(
                'div',
                t('routerDiagnostics.targetRoutes'),
                'font-size:0.72rem;color:rgba(255,255,255,0.62);font-weight:800;margin-top:0.15rem;',
            );
            panel.appendChild(targetHeading);

            const targetList = document.createElement('div');
            targetList.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';
            for (const route of report.targets) {
                targetList.appendChild(renderTarget(route));
            }
            panel.appendChild(targetList);

            const rawHeading = makeText(
                'div',
                t('routerDiagnostics.textReport'),
                'font-size:0.72rem;color:rgba(255,255,255,0.62);font-weight:800;margin-top:0.15rem;',
            );
            panel.appendChild(rawHeading);

            const pre = document.createElement('pre');
            pre.textContent = formatCurrentStudioParityDiagnosticReport({
                generatedAt: report.generatedAt,
            });
            pre.style.cssText = 'margin:0;padding:0.85rem;border-radius:0.75rem;border:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.6);font-size:0.62rem;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow:auto;max-height:18rem;';
            panel.appendChild(pre);

            panel.appendChild(makeText(
                'div',
                t('routerDiagnostics.readOnlyNote'),
                'font-size:0.62rem;color:rgba(255,255,255,0.26);line-height:1.4;',
            ));
        } catch {
            panel.appendChild(makeText(
                'div',
                t('routerDiagnostics.unavailable'),
                'padding:0.85rem;border:1px solid rgba(239,68,68,0.18);border-radius:0.75rem;background:rgba(239,68,68,0.06);color:#fca5a5;font-size:0.72rem;line-height:1.4;',
            ));
        }
    };

    render();
    return panel;
}
