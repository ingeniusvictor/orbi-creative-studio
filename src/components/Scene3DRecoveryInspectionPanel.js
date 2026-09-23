import { t } from '../lib/i18n.js';

function textNode(tag, text, style = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
}

function defaultStatusProvider() {
    if (typeof window === 'undefined'
        || !window.orbiScene3D
        || typeof window.orbiScene3D.getStatus !== 'function') {
        return Promise.resolve(null);
    }
    return window.orbiScene3D.getStatus();
}

function defaultPendingProvider() {
    if (typeof window === 'undefined'
        || !window.orbiScene3D
        || typeof window.orbiScene3D.pendingRecoveries !== 'function') {
        return Promise.resolve(null);
    }
    return window.orbiScene3D.pendingRecoveries();
}

function defaultHistoryProvider() {
    if (typeof window === 'undefined'
        || !window.orbiScene3D
        || typeof window.orbiScene3D.reconciliationHistory !== 'function') {
        return Promise.resolve(null);
    }
    return window.orbiScene3D.reconciliationHistory();
}

function defaultExportProvider() {
    if (typeof window === 'undefined'
        || !window.orbiScene3D
        || typeof window.orbiScene3D.exportRecoveryEvidence !== 'function') {
        return Promise.resolve(null);
    }
    return window.orbiScene3D.exportRecoveryEvidence();
}

export function normalizeRecoveryStatus(response) {
    if (!response
        || response.ok !== true
        || !response.status
        || response.status.enabled !== true
        || response.status.defaultOff !== true
        || response.status.rendererCanConfigure !== false
        || response.status.automaticR2Retry !== false
        || response.status.reconciliationMutation !== false) {
        return null;
    }
    return Object.freeze({ enabled: true });
}

export function normalizePendingRecoveries(value) {
    if (!Array.isArray(value)) return null;

    const normalized = [];
    for (const item of value) {
        if (!item
            || typeof item !== 'object'
            || !Number.isInteger(item.sequence)
            || item.sequence < 1
            || typeof item.request_id !== 'string'
            || !item.request_id
            || item.outcome !== 'pending'
            || item.provider_called !== null
            || item.replay_reserved !== true) {
            return null;
        }

        normalized.push(Object.freeze({
            sequence: item.sequence,
            requestId: item.request_id,
            operation: typeof item.operation === 'string' ? item.operation : 'execute_recipe',
            outcome: 'pending',
            providerCalled: null,
        }));
    }
    return Object.freeze(normalized);
}

export function normalizeRecoveryExportResult(value) {
    if (!value
        || typeof value !== 'object'
        || value.readOnlyEvidence !== true
        || value.executionAuthorized !== false
        || value.retryAuthorized !== false
        || value.reconciliationAuthorized !== false
        || value.requestIdReleaseAuthorized !== false
        || value.productionCutoverAuthorized !== false) {
        return null;
    }

    if (value.status === 'SCENE3D_RECOVERY_EXPORT_CANCELED') {
        return Object.freeze({ status: 'canceled' });
    }

    if (value.status === 'SCENE3D_RECOVERY_EXPORT_REJECTED') {
        return Object.freeze({ status: 'rejected' });
    }

    if (value.status !== 'SCENE3D_RECOVERY_EXPORT_WRITTEN'
        || typeof value.fileName !== 'string'
        || !value.fileName
        || /[\\/]/.test(value.fileName)
        || typeof value.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(value.sha256)
        || !Number.isInteger(value.bytes)
        || value.bytes <= 0) {
        return null;
    }

    return Object.freeze({
        status: 'written',
        fileName: value.fileName,
        sha256: value.sha256,
        bytes: value.bytes,
    });
}

export function normalizeReconciliationHistory(value) {
    if (!Array.isArray(value)) return null;

    const normalized = [];
    for (const item of value) {
        if (!item
            || typeof item !== 'object'
            || !Number.isInteger(item.reconciliation_sequence)
            || item.reconciliation_sequence < 1
            || typeof item.request_id !== 'string'
            || !item.request_id
            || !['applied', 'not_applied', 'inconclusive'].includes(item.resolution)
            || typeof item.actor !== 'string'
            || !item.actor
            || typeof item.final !== 'boolean'
            || item.reservation_released !== false) {
            return null;
        }

        normalized.push(Object.freeze({
            sequence: item.reconciliation_sequence,
            requestId: item.request_id,
            resolution: item.resolution,
            actor: item.actor,
            final: item.final,
        }));
    }
    return Object.freeze(normalized);
}

function renderEmpty(container, text) {
    container.appendChild(textNode(
        'div',
        text,
        'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.4);font-size:0.66rem;',
    ));
}

function renderPending(container, pending) {
    container.appendChild(textNode(
        'div',
        t('scene3dRecovery.pendingTitle'),
        'font-size:0.64rem;color:rgba(255,255,255,0.48);font-weight:800;',
    ));

    if (pending.length === 0) {
        renderEmpty(container, t('scene3dRecovery.noPending'));
        return;
    }

    for (const item of pending) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:0.65rem;border:1px solid rgba(251,191,36,0.14);border-radius:0.65rem;background:rgba(245,158,11,0.025);display:flex;flex-direction:column;gap:0.25rem;';
        row.appendChild(textNode(
            'code',
            item.requestId,
            'font-size:0.62rem;color:#fde68a;word-break:break-all;',
        ));
        row.appendChild(textNode(
            'div',
            `#${item.sequence} · ${item.operation} · ${t('scene3dRecovery.unknownOutcome')}`,
            'font-size:0.6rem;color:rgba(255,255,255,0.34);',
        ));
        container.appendChild(row);
    }
}

function resolutionLabel(resolution) {
    return {
        applied: t('scene3dRecovery.applied'),
        not_applied: t('scene3dRecovery.notApplied'),
        inconclusive: t('scene3dRecovery.inconclusive'),
    }[resolution] || resolution;
}

function renderHistory(container, history) {
    container.appendChild(textNode(
        'div',
        t('scene3dRecovery.historyTitle'),
        'font-size:0.64rem;color:rgba(255,255,255,0.48);font-weight:800;margin-top:0.15rem;',
    ));

    if (history.length === 0) {
        renderEmpty(container, t('scene3dRecovery.noHistory'));
        return;
    }

    for (const item of history) {
        const row = document.createElement('div');
        row.style.cssText = 'padding:0.65rem;border:1px solid rgba(34,211,238,0.1);border-radius:0.65rem;background:rgba(8,145,178,0.02);display:flex;flex-direction:column;gap:0.25rem;';
        row.appendChild(textNode(
            'code',
            item.requestId,
            'font-size:0.62rem;color:#a5f3fc;word-break:break-all;',
        ));
        row.appendChild(textNode(
            'div',
            `#${item.sequence} · ${resolutionLabel(item.resolution)} · ${item.final ? t('scene3dRecovery.final') : t('scene3dRecovery.nonFinal')}`,
            'font-size:0.6rem;color:rgba(255,255,255,0.34);',
        ));
        container.appendChild(row);
    }
}

export function Scene3DRecoveryInspectionPanel({
    statusProvider = defaultStatusProvider,
    pendingProvider = defaultPendingProvider,
    historyProvider = defaultHistoryProvider,
    exportProvider = defaultExportProvider,
} = {}) {
    const root = document.createElement('section');
    root.dataset.orbiScene3dRecovery = 'user-initiated-read-only';
    root.style.cssText = 'display:none;flex-direction:column;gap:0.65rem;padding:0.9rem;border:1px solid rgba(251,191,36,0.13);border-radius:0.85rem;background:rgba(245,158,11,0.02);';

    let loading = false;
    let exportReady = false;

    async function initialize() {
        let enabled = null;
        try {
            enabled = normalizeRecoveryStatus(await statusProvider());
        } catch {
            enabled = null;
        }

        if (!enabled) {
            root.style.display = 'none';
            return null;
        }

        root.innerHTML = '';
        root.style.display = 'flex';

        root.appendChild(textNode(
            'div',
            t('scene3dRecovery.title'),
            'font-size:0.75rem;color:#fff;font-weight:800;',
        ));
        root.appendChild(textNode(
            'div',
            t('scene3dRecovery.subtitle'),
            'font-size:0.64rem;color:rgba(255,255,255,0.38);line-height:1.45;',
        ));

        const action = document.createElement('button');
        action.type = 'button';
        action.dataset.orbiScene3dRecoveryLoad = 'explicit-user-action';
        action.textContent = t('scene3dRecovery.load');
        action.style.cssText = 'align-self:flex-start;padding:0.45rem 0.75rem;border-radius:0.5rem;background:rgba(245,158,11,0.08);border:1px solid rgba(251,191,36,0.2);color:#fde68a;font-size:0.66rem;font-weight:800;cursor:pointer;';

        const output = document.createElement('div');
        output.dataset.orbiScene3dRecoveryOutput = 'sanitized-read-only';
        output.style.cssText = 'display:flex;flex-direction:column;gap:0.45rem;';

        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.dataset.orbiScene3dRecoveryExport = 'explicit-user-save';
        exportButton.textContent = t('scene3dRecovery.export');
        exportButton.disabled = true;
        exportButton.style.cssText = 'align-self:flex-start;padding:0.45rem 0.75rem;border-radius:0.5rem;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.16);color:#a5f3fc;font-size:0.66rem;font-weight:800;cursor:pointer;';

        const exportResult = document.createElement('div');
        exportResult.dataset.orbiScene3dRecoveryExportResult = 'sanitized-metadata-only';
        exportResult.style.cssText = 'display:flex;flex-direction:column;gap:0.25rem;';

        action.onclick = async () => {
            if (loading) return;
            loading = true;
            action.disabled = true;
            exportReady = false;
            exportButton.disabled = true;
            exportResult.innerHTML = '';
            output.innerHTML = '';
            output.appendChild(textNode(
                'div',
                t('scene3dRecovery.loading'),
                'font-size:0.64rem;color:rgba(255,255,255,0.38);',
            ));

            try {
                const [pendingRaw, historyRaw] = await Promise.all([
                    pendingProvider(),
                    historyProvider(),
                ]);
                const pending = normalizePendingRecoveries(pendingRaw);
                const history = normalizeReconciliationHistory(historyRaw);

                output.innerHTML = '';
                if (!pending || !history) {
                    exportReady = false;
                    exportButton.disabled = true;
                    renderEmpty(output, t('scene3dRecovery.unavailable'));
                    return;
                }

                renderPending(output, pending);
                renderHistory(output, history);
                exportReady = true;
                exportButton.disabled = false;
                output.appendChild(textNode(
                    'div',
                    t('scene3dRecovery.boundary'),
                    'font-size:0.6rem;color:rgba(255,255,255,0.25);line-height:1.45;margin-top:0.15rem;',
                ));
            } catch {
                output.innerHTML = '';
                exportReady = false;
                exportButton.disabled = true;
                renderEmpty(output, t('scene3dRecovery.unavailable'));
            } finally {
                loading = false;
                action.disabled = false;
            }
        };

        exportButton.onclick = async () => {
            if (!exportReady || loading) return;

            exportButton.disabled = true;
            exportResult.innerHTML = '';
            exportResult.appendChild(textNode(
                'div',
                t('scene3dRecovery.exporting'),
                'font-size:0.62rem;color:rgba(255,255,255,0.35);',
            ));

            try {
                const normalized = normalizeRecoveryExportResult(await exportProvider());
                exportResult.innerHTML = '';

                if (!normalized) {
                    renderEmpty(exportResult, t('scene3dRecovery.exportRejected'));
                } else if (normalized.status === 'canceled') {
                    renderEmpty(exportResult, t('scene3dRecovery.exportCanceled'));
                } else if (normalized.status === 'rejected') {
                    renderEmpty(exportResult, t('scene3dRecovery.exportRejected'));
                } else {
                    exportResult.appendChild(textNode(
                        'div',
                        `${t('scene3dRecovery.exportFile')}: ${normalized.fileName}`,
                        'font-size:0.62rem;color:rgba(255,255,255,0.4);word-break:break-word;',
                    ));
                    exportResult.appendChild(textNode(
                        'code',
                        normalized.sha256,
                        'font-size:0.58rem;color:#a5f3fc;word-break:break-all;',
                    ));
                    exportResult.appendChild(textNode(
                        'div',
                        `${normalized.bytes} ${t('scene3dRecovery.exportBytes')}`,
                        'font-size:0.6rem;color:rgba(255,255,255,0.3);',
                    ));
                }
            } catch {
                exportResult.innerHTML = '';
                renderEmpty(exportResult, t('scene3dRecovery.exportRejected'));
            } finally {
                exportButton.disabled = !exportReady;
            }
        };

        root.appendChild(action);
        root.appendChild(output);
        root.appendChild(exportButton);
        root.appendChild(exportResult);
        return enabled;
    }

    Object.defineProperty(root, 'initializeScene3DRecoveryInspection', {
        value: initialize,
        enumerable: false,
    });

    void initialize();
    return root;
}
