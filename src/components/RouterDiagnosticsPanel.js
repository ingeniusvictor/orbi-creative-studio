import { t } from '../lib/i18n.js';
import {
    buildCurrentStudioParityDiagnosticReport,
    formatCurrentStudioParityDiagnosticReport,
    getStudioParitySessionState,
} from '../lib/computeRouter/paritySession.mjs';

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

export function RouterDiagnosticsPanel() {
    const panel = document.createElement('div');
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
