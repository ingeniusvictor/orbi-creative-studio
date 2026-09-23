import { t } from '../lib/i18n.js';

function textNode(tag, text, style = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
}

function metric(label, value) {
    const card = document.createElement('div');
    card.style.cssText = 'padding:0.7rem;border:1px solid rgba(34,211,238,0.12);border-radius:0.7rem;background:rgba(34,211,238,0.025);min-width:0;';
    card.appendChild(textNode(
        'div',
        label,
        'font-size:0.62rem;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.04em;font-weight:700;',
    ));
    card.appendChild(textNode(
        'div',
        String(value),
        'font-size:0.85rem;color:#e0f2fe;font-weight:800;margin-top:0.25rem;word-break:break-word;',
    ));
    return card;
}

export function normalizeScene3DStatus(response) {
    if (!response
        || response.ok !== true
        || !response.status
        || typeof response.status !== 'object'
        || response.status.enabled !== true
        || !['native', 'wsl'].includes(response.status.mode)
        || response.status.defaultOff !== true
        || response.status.rendererCanConfigure !== false
        || response.status.automaticR2Retry !== false
        || response.status.reconciliationMutation !== false
        || typeof response.status.processStarted !== 'boolean'
        || !Array.isArray(response.status.recipes)
        || response.status.recipes.some((value) => typeof value !== 'string' || !value)) {
        return null;
    }

    return Object.freeze({
        enabled: true,
        mode: response.status.mode,
        processStarted: response.status.processStarted,
        recipes: Object.freeze([...response.status.recipes]),
        defaultOff: true,
        rendererCanConfigure: false,
        automaticR2Retry: false,
        reconciliationMutation: false,
    });
}

function defaultStatusProvider() {
    if (typeof window === 'undefined'
        || !window.orbiScene3D
        || typeof window.orbiScene3D.getStatus !== 'function') {
        return Promise.resolve(null);
    }
    return window.orbiScene3D.getStatus();
}

export function Scene3DPilotDiagnosticsPanel({
    statusProvider = defaultStatusProvider,
} = {}) {
    const root = document.createElement('section');
    root.dataset.orbiScene3dDiagnostics = 'read-only';
    root.style.cssText = 'display:none;flex-direction:column;gap:0.65rem;padding:0.9rem;border:1px solid rgba(34,211,238,0.12);border-radius:0.85rem;background:rgba(8,145,178,0.025);';

    async function refresh() {
        let status = null;
        try {
            status = normalizeScene3DStatus(await statusProvider());
        } catch {
            status = null;
        }

        root.innerHTML = '';
        if (!status) {
            root.style.display = 'none';
            return null;
        }

        root.style.display = 'flex';
        root.appendChild(textNode(
            'div',
            t('scene3dDiagnostics.title'),
            'font-size:0.75rem;color:#fff;font-weight:800;',
        ));
        root.appendChild(textNode(
            'div',
            t('scene3dDiagnostics.subtitle'),
            'font-size:0.64rem;color:rgba(255,255,255,0.38);line-height:1.45;',
        ));

        const metrics = document.createElement('div');
        metrics.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.55rem;';
        metrics.appendChild(metric(
            t('scene3dDiagnostics.mode'),
            status.mode === 'wsl' ? 'WSL' : t('scene3dDiagnostics.native'),
        ));
        metrics.appendChild(metric(
            t('scene3dDiagnostics.process'),
            status.processStarted
                ? t('scene3dDiagnostics.started')
                : t('scene3dDiagnostics.notStarted'),
        ));
        root.appendChild(metrics);

        root.appendChild(textNode(
            'div',
            t('scene3dDiagnostics.recipes'),
            'font-size:0.64rem;color:rgba(255,255,255,0.48);font-weight:700;margin-top:0.1rem;',
        ));

        const recipeList = document.createElement('div');
        recipeList.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;';
        for (const recipe of status.recipes) {
            recipeList.appendChild(textNode(
                'code',
                recipe,
                'font-size:0.62rem;color:#a5f3fc;background:rgba(34,211,238,0.05);border-radius:0.45rem;padding:0.35rem 0.45rem;word-break:break-word;',
            ));
        }
        root.appendChild(recipeList);

        root.appendChild(textNode(
            'div',
            t('scene3dDiagnostics.boundary'),
            'font-size:0.61rem;color:rgba(255,255,255,0.26);line-height:1.45;',
        ));

        return status;
    }

    Object.defineProperty(root, 'refreshScene3DStatus', {
        value: refresh,
        enumerable: false,
    });

    void refresh();
    return root;
}
