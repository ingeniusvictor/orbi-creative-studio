import { LocalModelManager } from './LocalModelManager.js';
import { isLocalAIAvailable } from '../lib/localInferenceClient.js';
import { t } from '../lib/i18n.js';
import { getMuapiKey, setMuapiCredential } from '../lib/providerCredentials.mjs';
import { RouterDiagnosticsPanel } from './RouterDiagnosticsPanel.js';
import { Scene3DPilotDiagnosticsPanel } from './Scene3DPilotDiagnosticsPanel.js';
import { readShadowCompatibilitySnapshot } from '../lib/computeRouter/shadowCompatibilitySnapshotHandoff.mjs';
import {
    getRuntimeCertifiedResourceProfileRegistryStatus,
} from '../lib/computeRouter/runtimeCertifiedResourceProfileRegistry.mjs';
import {
    listUserShadowDiagnosticTargets,
    runUserShadowDiagnosticRefresh,
} from '../lib/computeRouter/userShadowDiagnosticRefresh.mjs';
import {
    captureUserBenchmarkSample,
    getUserBenchmarkSessionState,
} from '../lib/computeRouter/userBenchmarkSession.mjs';
import {
    getUserBenchmarkReviewSummary,
    prepareUserBenchmarkReview,
} from '../lib/computeRouter/userBenchmarkReview.mjs';
import {
    getUserBenchmarkCertificationSummary,
    recordUserBenchmarkCertification,
} from '../lib/computeRouter/userBenchmarkCertification.mjs';
import {
    getRuntimeCertificationPromotionSummary,
    prepareRuntimeCertificationPromotion,
} from '../lib/computeRouter/runtimeCertificationPromotion.mjs';
import { buildUserHardwarePilotEvidenceBundle } from '../lib/computeRouter/hardwarePilotEvidenceBundle.mjs';

export function SettingsModal(onClose) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:100;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-card,#111);border-radius:1rem;border:1px solid rgba(255,255,255,0.08);width:min(90vw,36rem);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;';

    // ── Header ────────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;';
    header.innerHTML = `
        <h2 style="font-size:1rem;font-weight:800;color:#fff;margin:0;">${t('settings.title')}</h2>
        <button id="settings-close-btn" style="color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;padding:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
    `;
    modal.appendChild(header);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const TABS = [
        { id: 'api', label: t('settings.apiKey') },
        ...(isLocalAIAvailable() ? [
            { id: 'local', label: t('settings.localModels') },
            { id: 'diagnostics', label: t('settings.routerDiagnostics') },
        ] : []),
    ];

    let activeTab = 'api';

    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:0.25rem;padding:0.75rem 1.5rem 0;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;';

    const tabBtns = {};
    TABS.forEach(({ id, label }) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = 'padding:0.4rem 0.75rem;border-radius:0.5rem 0.5rem 0 0;font-size:0.75rem;font-weight:700;border:none;cursor:pointer;transition:all 0.15s;';
        btn.onclick = () => switchTab(id);
        tabBtns[id] = btn;
        tabBar.appendChild(btn);
    });
    modal.appendChild(tabBar);

    // ── Body ──────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:1.5rem;';
    modal.appendChild(body);

    // ── Tab: API Key ──────────────────────────────────────────────────────────
    const apiPanel = document.createElement('div');
    apiPanel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <div>
                <label style="display:block;font-size:0.75rem;color:rgba(255,255,255,0.5);margin-bottom:0.4rem;font-weight:600;">${t('settings.muapiKeyLabel')}</label>
                <input id="settings-api-key" type="password"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.6rem 0.9rem;color:#fff;font-size:0.875rem;outline:none;"
                    placeholder="${t('settings.keyPlaceholder')}"
                    value="${getMuapiKey() || ''}">
            </div>
            <p style="font-size:0.7rem;color:rgba(255,255,255,0.3);margin:0;">
                ${t('settings.keyNote')}
            </p>
            <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.5rem;">
                <button id="settings-cancel-btn" style="padding:0.5rem 1rem;border-radius:0.5rem;background:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);font-size:0.75rem;font-weight:700;cursor:pointer;">${t('common.cancel')}</button>
                <button id="settings-save-btn" style="padding:0.5rem 1rem;border-radius:0.5rem;background:var(--color-primary,#22d3ee);color:#000;font-size:0.75rem;font-weight:700;cursor:pointer;border:none;">${t('common.save')}</button>
            </div>
        </div>
    `;

    // ── Tab: Local Models ─────────────────────────────────────────────────────
    const localPanel = LocalModelManager();
    const diagnosticsPanel = isLocalAIAvailable()
        ? RouterDiagnosticsPanel({
            shadowCompatibilitySnapshotProvider: readShadowCompatibilitySnapshot,
            shadowDiagnosticRefresh: runUserShadowDiagnosticRefresh,
            shadowDiagnosticTargetsProvider: listUserShadowDiagnosticTargets,
            runtimeCertificationStatusProvider: getRuntimeCertifiedResourceProfileRegistryStatus,
            benchmarkSampleCapture: captureUserBenchmarkSample,
            benchmarkSessionStateProvider: getUserBenchmarkSessionState,
            benchmarkReviewPrepare: prepareUserBenchmarkReview,
            benchmarkReviewSummaryProvider: getUserBenchmarkReviewSummary,
            benchmarkCertificationRecord: recordUserBenchmarkCertification,
            benchmarkCertificationSummaryProvider: getUserBenchmarkCertificationSummary,
            runtimeCertificationPromotionPrepare: prepareRuntimeCertificationPromotion,
            runtimeCertificationPromotionSummaryProvider: getRuntimeCertificationPromotionSummary,
            hardwarePilotBundleBuild: buildUserHardwarePilotEvidenceBundle,
            hardwarePilotExport: (bundle) => window.orbiBenchmark?.exportPilotBundle(bundle),
        })
        : null;

    const scene3dDiagnosticsPanel = isLocalAIAvailable()
        ? Scene3DPilotDiagnosticsPanel()
        : null;

    const diagnosticsContainer = diagnosticsPanel
        ? document.createElement('div')
        : null;
    if (diagnosticsContainer) {
        diagnosticsContainer.style.cssText = 'display:flex;flex-direction:column;gap:0.85rem;';
        diagnosticsContainer.appendChild(diagnosticsPanel);
        if (scene3dDiagnosticsPanel) {
            diagnosticsContainer.appendChild(scene3dDiagnosticsPanel);
        }
    }

    // ── Tab switching ─────────────────────────────────────────────────────────
    const switchTab = (id) => {
        activeTab = id;
        body.innerHTML = '';

        TABS.forEach(({ id: tid }) => {
            const btn = tabBtns[tid];
            if (tid === id) {
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.color = '#fff';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'rgba(255,255,255,0.4)';
            }
        });

        if (id === 'api') body.appendChild(apiPanel);
        if (id === 'local') body.appendChild(localPanel);
        if (id === 'diagnostics' && diagnosticsContainer) body.appendChild(diagnosticsContainer);
    };

    switchTab('api');

    // ── API key save/cancel handlers ──────────────────────────────────────────
    const close = () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        if (onClose) onClose();
    };

    apiPanel.querySelector('#settings-cancel-btn').onclick = close;
    apiPanel.querySelector('#settings-save-btn').onclick = async () => {
        const key = apiPanel.querySelector('#settings-api-key').value.trim();
        if (!key) {
            alert(t('settings.invalidKey'));
            return;
        }

        try {
            await setMuapiCredential(key);
            close();
        } catch (error) {
            console.error('[Credentials] Failed to update MuAPI credential:', error);
            alert(`Unable to store the API key securely: ${error.message}`);
        }
    };

    header.querySelector('#settings-close-btn').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.appendChild(modal);
    return overlay;
}
