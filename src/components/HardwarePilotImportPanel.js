import { getLang } from '../lib/i18n.js';

const COPY = Object.freeze({
    en: Object.freeze({
        title: 'Hardware pilot evidence import',
        subtitle: 'Import a previously exported ORBI hardware-pilot JSON artifact for current-contract revalidation and later human review.',
        action: 'Import hardware pilot JSON',
        running: 'Selecting and validating evidence…',
        ready: 'Evidence imported and revalidated. Human review is still required.',
        canceled: 'Import canceled. No evidence was retained.',
        rejected: 'Hardware pilot evidence could not be imported.',
        idle: 'Choose an exported ORBI hardware-pilot JSON artifact to begin review intake.',
        file: 'Imported file',
        target: 'Target',
        samples: 'Samples',
        capture: 'Capture window',
        bytes: 'Bytes',
        sha256: 'File SHA-256',
        evidence: 'Evidence class',
        contract: 'Current contract',
        contractValid: 'Revalidated',
        authenticity: 'Authenticity',
        authenticityPending: 'Not cryptographically verified',
        authority: 'Execution authority',
        boundary: 'Review intake only. The renderer supplies no file location or raw evidence, and import grants no profile promotion, routing, or cutover authority.',
    }),
    'zh-CN': Object.freeze({
        title: '硬件试点证据导入',
        subtitle: '导入之前导出的 ORBI 硬件试点 JSON 证据，并按当前合同重新验证，供后续人工审核。',
        action: '导入硬件试点 JSON',
        running: '正在选择并验证证据…',
        ready: '证据已导入并重新验证。仍需人工审核。',
        canceled: '已取消导入。未保留任何证据。',
        rejected: '无法导入硬件试点证据。',
        idle: '请选择已导出的 ORBI 硬件试点 JSON 证据以开始审核接收。',
        file: '导入文件',
        target: '目标',
        samples: '样本数',
        capture: '采集时间窗',
        bytes: '字节数',
        sha256: '文件 SHA-256',
        evidence: '证据类别',
        contract: '当前合同',
        contractValid: '已重新验证',
        authenticity: '真实性',
        authenticityPending: '未进行加密真实性验证',
        authority: '执行权限',
        boundary: '仅用于审核接收。渲染器不会提供文件位置或原始证据，导入也不会授予配置升级、路由或切换权限。',
    }),
});

function copy() {
    return COPY[getLang()] || COPY.en;
}

function text(tag, value, style = '') {
    const node = document.createElement(tag);
    node.textContent = value;
    if (style) node.style.cssText = style;
    return node;
}

function metric(label, value) {
    const card = document.createElement('div');
    card.style.cssText = 'padding:0.7rem;border:1px solid rgba(255,255,255,0.07);border-radius:0.7rem;background:rgba(255,255,255,0.025);min-width:0;';
    card.appendChild(text(
        'div',
        label,
        'font-size:0.62rem;color:rgba(255,255,255,0.38);text-transform:uppercase;letter-spacing:0.04em;font-weight:700;',
    ));
    card.appendChild(text(
        'div',
        String(value),
        'font-size:0.76rem;color:rgba(255,255,255,0.82);font-weight:700;margin-top:0.2rem;word-break:break-word;',
    ));
    return card;
}

function validIso(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function normalizeTarget(target) {
    if (!target
        || typeof target !== 'object'
        || Array.isArray(target)
        || typeof target.modelId !== 'string'
        || !target.modelId.trim()
        || !['cpu', 'cuda12'].includes(target.backend)
        || !Number.isInteger(target.width)
        || target.width <= 0
        || !Number.isInteger(target.height)
        || target.height <= 0) {
        return null;
    }

    return Object.freeze({
        modelId: target.modelId.trim(),
        backend: target.backend,
        width: target.width,
        height: target.height,
    });
}

export function normalizeHardwarePilotImportResult(result) {
    const target = normalizeTarget(result?.target);
    if (!result
        || typeof result !== 'object'
        || result.status !== 'HARDWARE_PILOT_IMPORT_REVIEW_READY'
        || typeof result.fileName !== 'string'
        || !result.fileName.trim()
        || /[\\/]/.test(result.fileName)
        || typeof result.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(result.sha256)
        || !Number.isInteger(result.bytes)
        || result.bytes <= 0
        || !target
        || result.sampleCount !== 3
        || !validIso(result.capturedFrom)
        || !validIso(result.capturedTo)
        || result.evidenceClass !== 'real-runtime-hardware-pilot'
        || result.cryptographicAuthenticityVerified !== false
        || result.importedFileHashVerified !== true
        || result.revalidatedAgainstCurrentContract !== true
        || result.requiresHumanReview !== true
        || result.productionProfilePromoted !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    return Object.freeze({
        fileName: result.fileName.trim(),
        sha256: result.sha256,
        bytes: result.bytes,
        target,
        sampleCount: 3,
        capturedFrom: result.capturedFrom,
        capturedTo: result.capturedTo,
        evidenceClass: result.evidenceClass,
        cryptographicAuthenticityVerified: false,
        importedFileHashVerified: true,
        revalidatedAgainstCurrentContract: true,
        requiresHumanReview: true,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function targetLabel(target) {
    return `${target.modelId} · ${target.backend} · ${target.width}×${target.height}`;
}

function captureLabel(result) {
    return `${result.capturedFrom} → ${result.capturedTo}`;
}

export function HardwarePilotImportPanel({ hardwarePilotImport = null } = {}) {
    const section = document.createElement('div');
    section.dataset.orbiHardwarePilotImport = 'user-initiated-review-intake';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(167,139,250,0.16);border-radius:0.75rem;background:rgba(139,92,246,0.03);margin-top:1rem;';

    let actionStatus = 'idle';
    let importResult = null;

    const render = () => {
        const c = copy();
        section.innerHTML = '';

        section.appendChild(text(
            'div',
            c.title,
            'font-size:0.72rem;color:rgba(255,255,255,0.7);font-weight:800;',
        ));
        section.appendChild(text(
            'div',
            c.subtitle,
            'font-size:0.62rem;color:rgba(255,255,255,0.32);line-height:1.45;',
        ));

        if (importResult) {
            const grid = document.createElement('div');
            grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
            grid.appendChild(metric(c.file, importResult.fileName));
            grid.appendChild(metric(c.target, targetLabel(importResult.target)));
            grid.appendChild(metric(c.samples, `${importResult.sampleCount}/3`));
            grid.appendChild(metric(c.bytes, importResult.bytes));
            grid.appendChild(metric(c.sha256, importResult.sha256));
            grid.appendChild(metric(c.evidence, importResult.evidenceClass));
            grid.appendChild(metric(c.capture, captureLabel(importResult)));
            grid.appendChild(metric(c.contract, c.contractValid));
            grid.appendChild(metric(c.authenticity, c.authenticityPending));
            grid.appendChild(metric(c.authority, importResult.executionAuthority));
            section.appendChild(grid);
        } else {
            const message = {
                running: c.running,
                canceled: c.canceled,
                rejected: c.rejected,
                idle: c.idle,
            }[actionStatus] || c.idle;
            section.appendChild(text(
                'div',
                message,
                'padding:0.65rem;border-radius:0.6rem;background:rgba(255,255,255,0.025);color:rgba(255,255,255,0.42);font-size:0.68rem;line-height:1.4;',
            ));
        }

        if (importResult && actionStatus === 'ready') {
            section.appendChild(text(
                'div',
                c.ready,
                'font-size:0.64rem;color:#c4b5fd;font-weight:700;line-height:1.4;',
            ));
        }

        if (typeof hardwarePilotImport === 'function') {
            const action = document.createElement('div');
            action.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';

            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.orbiHardwarePilotImport = 'explicit-user-open';
            button.textContent = c.action;
            button.disabled = actionStatus === 'running';
            button.style.cssText = 'padding:0.42rem 0.72rem;border-radius:0.5rem;background:rgba(139,92,246,0.11);border:1px solid rgba(167,139,250,0.25);color:#ddd6fe;font-size:0.68rem;font-weight:700;cursor:pointer;';
            button.onclick = async () => {
                if (actionStatus === 'running') return;
                actionStatus = 'running';
                importResult = null;
                render();

                try {
                    const result = await hardwarePilotImport();
                    if (result?.status === 'HARDWARE_PILOT_IMPORT_CANCELED') {
                        actionStatus = 'canceled';
                        render();
                        return;
                    }

                    const normalized = normalizeHardwarePilotImportResult(result);
                    if (!normalized) {
                        actionStatus = 'rejected';
                        render();
                        return;
                    }

                    importResult = normalized;
                    actionStatus = 'ready';
                } catch {
                    actionStatus = 'rejected';
                }
                render();
            };
            action.appendChild(button);
            section.appendChild(action);
        }

        section.appendChild(text(
            'div',
            c.boundary,
            'font-size:0.61rem;color:rgba(255,255,255,0.24);line-height:1.45;',
        ));
    };

    render();
    return section;
}
