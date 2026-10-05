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
        reviewAction: 'Open human review',
        reviewRunning: 'Building safe review projection…',
        reviewReady: 'Human review projection ready. Check all three measured runs before deciding.',
        reviewRejected: 'The imported evidence could not be projected for review.',
        runtime: 'Runtime',
        average: 'Average time',
        range: 'Time range',
        peakRam: 'Peak system RAM',
        peakVram: 'Peak VRAM',
        run: 'Run',
        reviewNote: 'Human review note',
        reviewNotePlaceholder: 'Record why this evidence should be approved or rejected…',
        approve: 'Approve pilot evidence',
        reject: 'Reject pilot evidence',
        deciding: 'Recording immutable human decision…',
        decisionApproved: 'Approved for pilot evidence review scope only.',
        decisionRejected: 'Pilot evidence rejected.',
        decisionError: 'The human review decision could not be recorded.',
        profile: 'Pilot profile',
        profileScope: 'Scope',
        profileStatus: 'Status',
        profileSafe: 'This profile is evidence-scoped only. It cannot route traffic or authorize cutover.',
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
        reviewAction: '打开人工审核',
        reviewRunning: '正在构建安全审核视图…',
        reviewReady: '人工审核视图已就绪。请在决策前检查三次实测运行。',
        reviewRejected: '无法为导入的证据构建审核视图。',
        runtime: '运行时',
        average: '平均时间',
        range: '时间范围',
        peakRam: '系统内存峰值',
        peakVram: '显存峰值',
        run: '运行',
        reviewNote: '人工审核说明',
        reviewNotePlaceholder: '记录批准或拒绝该证据的原因…',
        approve: '批准试点证据',
        reject: '拒绝试点证据',
        deciding: '正在记录不可变的人工决策…',
        decisionApproved: '已批准，仅限试点证据审核范围。',
        decisionRejected: '试点证据已拒绝。',
        decisionError: '无法记录人工审核决策。',
        profile: '试点配置',
        profileScope: '范围',
        profileStatus: '状态',
        profileSafe: '该配置仅用于证据审核范围，不能路由流量或授权切换。',
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

function sameTarget(left, right) {
    return Boolean(left && right
        && left.modelId === right.modelId
        && left.backend === right.backend
        && left.width === right.width
        && left.height === right.height);
}

function positive(value) {
    return Number.isFinite(value) && value > 0;
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

function normalizeReviewRun(run, expectedIndex, backend) {
    if (!run
        || run.runIndex !== expectedIndex
        || !validIso(run.measuredAt)
        || !positive(run.durationMs)
        || !positive(run.peakSystemRamMiB)
        || (backend === 'cuda12' && !positive(run.peakVramMiB))
        || (backend === 'cpu' && run.peakVramMiB !== null)) {
        return null;
    }
    return Object.freeze({
        runIndex: expectedIndex,
        measuredAt: run.measuredAt,
        durationMs: run.durationMs,
        peakSystemRamMiB: run.peakSystemRamMiB,
        peakVramMiB: run.peakVramMiB,
    });
}

export function normalizeHardwarePilotReviewResult(result, expectedSha, expectedTarget) {
    const target = normalizeTarget(result?.target);
    if (!result
        || result.status !== 'HARDWARE_PILOT_REVIEW_READY'
        || result.sha256 !== expectedSha
        || !/^[a-f0-9]{64}$/.test(result.sha256)
        || !target
        || !sameTarget(target, expectedTarget)
        || result.sampleCount !== 3
        || !validIso(result.capturedFrom)
        || !validIso(result.capturedTo)
        || !Array.isArray(result.runs)
        || result.runs.length !== 3
        || !result.runtime
        || typeof result.runtime.runtimeIdentity !== 'string'
        || !result.runtime.runtimeIdentity.trim()
        || typeof result.runtime.runtimeVersion !== 'string'
        || !result.runtime.runtimeVersion.trim()
        || typeof result.runtime.harnessVersion !== 'string'
        || !result.runtime.harnessVersion.trim()
        || !result.timing
        || !positive(result.timing.minDurationMs)
        || !positive(result.timing.maxDurationMs)
        || !positive(result.timing.averageDurationMs)
        || !result.observedResources
        || !positive(result.observedResources.peakSystemRamMiB)
        || (target.backend === 'cuda12' && !positive(result.observedResources.peakVramMiB))
        || (target.backend === 'cpu' && result.observedResources.peakVramMiB !== null)
        || result.reviewOnly !== true
        || result.requiresHumanReview !== true
        || result.humanReviewCompleted !== false
        || result.reviewerIdentityVerified !== false
        || result.cryptographicAuthenticityVerified !== false
        || result.productionProfilePromoted !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }

    const runs = result.runs.map((run, index) => normalizeReviewRun(run, index + 1, target.backend));
    if (runs.some((run) => !run)) return null;

    return Object.freeze({
        sha256: result.sha256,
        target,
        sampleCount: 3,
        capturedFrom: result.capturedFrom,
        capturedTo: result.capturedTo,
        runtime: Object.freeze({ ...result.runtime }),
        runs: Object.freeze(runs),
        timing: Object.freeze({ ...result.timing }),
        observedResources: Object.freeze({ ...result.observedResources }),
        reviewOnly: true,
        requiresHumanReview: true,
        humanReviewCompleted: false,
        reviewerIdentityVerified: false,
        cryptographicAuthenticityVerified: false,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

function normalizePilotProfile(profile, expectedSha, expectedTarget) {
    const target = normalizeTarget(profile?.target);
    if (!profile
        || profile.status !== 'pilot-certified'
        || profile.certificationScope !== 'hardware-pilot-evidence-review-only'
        || profile.evidenceSha256 !== expectedSha
        || !target
        || !sameTarget(target, expectedTarget)
        || profile.sampleCount !== 3
        || !validIso(profile.certifiedAt)
        || profile.reviewerIdentityVerified !== false
        || profile.cryptographicAuthenticityVerified !== false
        || profile.productionProfilePromoted !== false
        || profile.routingEligible !== false
        || profile.cutoverAuthorized !== false
        || profile.executionAuthority !== 'legacy-dispatcher-only') {
        return null;
    }
    return Object.freeze({
        status: profile.status,
        certificationScope: profile.certificationScope,
        evidenceSha256: profile.evidenceSha256,
        target,
        sampleCount: 3,
        timing: Object.freeze({ ...profile.timing }),
        observedResources: Object.freeze({ ...profile.observedResources }),
        certifiedAt: profile.certifiedAt,
        productionProfilePromoted: false,
        routingEligible: false,
        cutoverAuthorized: false,
        executionAuthority: 'legacy-dispatcher-only',
    });
}

export function normalizeHardwarePilotDecisionResult(result, expectedSha, expectedTarget) {
    const approved = result?.status === 'HARDWARE_PILOT_REVIEW_APPROVED';
    const rejected = result?.status === 'HARDWARE_PILOT_REVIEW_DECISION_REJECTED';
    const target = normalizeTarget(result?.target);
    if (!result
        || (!approved && !rejected)
        || result.sha256 !== expectedSha
        || !target
        || !sameTarget(target, expectedTarget)
        || result.sampleCount !== 3
        || result.reviewNoteRecorded !== true
        || !validIso(result.decidedAt)
        || result.humanReviewCompleted !== true
        || result.requiresHumanReview !== false
        || result.reviewerIdentityVerified !== false
        || result.cryptographicAuthenticityVerified !== false
        || result.productionProfilePromoted !== false
        || result.routingEligible !== false
        || result.cutoverAuthorized !== false
        || result.executionAuthority !== 'legacy-dispatcher-only'
        || (approved && result.decision !== 'approve')
        || (rejected && result.decision !== 'reject')) {
        return null;
    }

    const profile = approved ? normalizePilotProfile(result.profile, expectedSha, expectedTarget) : null;
    if (approved && !profile) return null;
    if (rejected && result.profile !== null) return null;

    return Object.freeze({
        status: result.status,
        sha256: result.sha256,
        decision: result.decision,
        decidedAt: result.decidedAt,
        target,
        humanReviewCompleted: true,
        requiresHumanReview: false,
        profile,
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

function reviewMetrics(c, reviewResult) {
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
    grid.appendChild(metric(c.runtime, `${reviewResult.runtime.runtimeIdentity} · ${reviewResult.runtime.runtimeVersion}`));
    grid.appendChild(metric(c.average, `${reviewResult.timing.averageDurationMs} ms`));
    grid.appendChild(metric(c.range, `${reviewResult.timing.minDurationMs}–${reviewResult.timing.maxDurationMs} ms`));
    grid.appendChild(metric(c.peakRam, `${reviewResult.observedResources.peakSystemRamMiB} MiB`));
    if (reviewResult.observedResources.peakVramMiB !== null) {
        grid.appendChild(metric(c.peakVram, `${reviewResult.observedResources.peakVramMiB} MiB`));
    }
    return grid;
}

function runsView(c, reviewResult) {
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;';
    reviewResult.runs.forEach((run) => {
        const details = [
            `${run.durationMs} ms`,
            `RAM ${run.peakSystemRamMiB} MiB`,
            ...(run.peakVramMiB === null ? [] : [`VRAM ${run.peakVramMiB} MiB`]),
            run.measuredAt,
        ].join(' · ');
        list.appendChild(text(
            'div',
            `${c.run} ${run.runIndex}: ${details}`,
            'padding:0.5rem 0.6rem;border-radius:0.55rem;background:rgba(255,255,255,0.025);font-size:0.64rem;color:rgba(255,255,255,0.58);line-height:1.4;',
        ));
    });
    return list;
}

export function HardwarePilotImportPanel({
    hardwarePilotImport = null,
    hardwarePilotReview = null,
    hardwarePilotDecision = null,
} = {}) {
    const section = document.createElement('div');
    section.dataset.orbiHardwarePilotImport = 'user-initiated-review-intake';
    section.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;padding:0.85rem;border:1px solid rgba(167,139,250,0.16);border-radius:0.75rem;background:rgba(139,92,246,0.03);margin-top:1rem;';

    let actionStatus = 'idle';
    let importResult = null;
    let reviewStatus = 'idle';
    let reviewResult = null;
    let decisionStatus = 'idle';
    let decisionResult = null;
    let noteValue = '';

    const resetReview = () => {
        reviewStatus = 'idle';
        reviewResult = null;
        decisionStatus = 'idle';
        decisionResult = null;
        noteValue = '';
    };

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

        if (importResult && typeof hardwarePilotReview === 'function') {
            const reviewButton = document.createElement('button');
            reviewButton.type = 'button';
            reviewButton.dataset.orbiHardwarePilotReview = 'explicit-human-review';
            reviewButton.textContent = c.reviewAction;
            reviewButton.disabled = reviewStatus === 'running' || Boolean(decisionResult);
            reviewButton.style.cssText = 'align-self:flex-start;padding:0.42rem 0.72rem;border-radius:0.5rem;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.22);color:#a5f3fc;font-size:0.68rem;font-weight:700;cursor:pointer;';
            reviewButton.onclick = async () => {
                reviewStatus = 'running';
                reviewResult = null;
                decisionStatus = 'idle';
                decisionResult = null;
                render();
                try {
                    const result = await hardwarePilotReview(importResult.sha256);
                    const normalized = normalizeHardwarePilotReviewResult(result, importResult.sha256, importResult.target);
                    if (!normalized) {
                        reviewStatus = 'rejected';
                        render();
                        return;
                    }
                    reviewResult = normalized;
                    reviewStatus = 'ready';
                } catch {
                    reviewStatus = 'rejected';
                }
                render();
            };
            section.appendChild(reviewButton);
        }

        if (reviewStatus === 'running') {
            section.appendChild(text('div', c.reviewRunning, 'font-size:0.64rem;color:#a5f3fc;'));
        }
        if (reviewStatus === 'rejected') {
            section.appendChild(text('div', c.reviewRejected, 'font-size:0.64rem;color:#fca5a5;'));
        }
        if (reviewResult) {
            section.appendChild(text('div', c.reviewReady, 'font-size:0.64rem;color:#a5f3fc;font-weight:700;line-height:1.4;'));
            section.appendChild(reviewMetrics(c, reviewResult));
            section.appendChild(runsView(c, reviewResult));
        }

        if (reviewResult && !decisionResult && typeof hardwarePilotDecision === 'function') {
            const noteLabel = text('label', c.reviewNote, 'font-size:0.62rem;color:rgba(255,255,255,0.42);font-weight:700;');
            const note = document.createElement('textarea');
            note.dataset.orbiHardwarePilotReview = 'human-review-note';
            note.value = noteValue;
            note.maxLength = 2000;
            note.placeholder = c.reviewNotePlaceholder;
            note.style.cssText = 'width:100%;box-sizing:border-box;min-height:4.5rem;resize:vertical;padding:0.55rem 0.65rem;border-radius:0.55rem;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.035);color:#fff;font-size:0.68rem;';
            note.oninput = () => { noteValue = note.value; };
            section.appendChild(noteLabel);
            section.appendChild(note);

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;';
            const decide = async (decision) => {
                noteValue = note.value;
                if (!noteValue.trim() || decisionStatus === 'running') return;
                decisionStatus = 'running';
                render();
                try {
                    const result = await hardwarePilotDecision({
                        sha256: importResult.sha256,
                        decision,
                        reviewNote: noteValue.trim(),
                    });
                    const normalized = normalizeHardwarePilotDecisionResult(result, importResult.sha256, importResult.target);
                    if (!normalized) {
                        decisionStatus = 'error';
                        render();
                        return;
                    }
                    decisionResult = normalized;
                    decisionStatus = normalized.decision === 'approve' ? 'approved' : 'rejected';
                } catch {
                    decisionStatus = 'error';
                }
                render();
            };

            const rejectButton = document.createElement('button');
            rejectButton.type = 'button';
            rejectButton.dataset.orbiHardwarePilotDecision = 'reject';
            rejectButton.textContent = c.reject;
            rejectButton.disabled = decisionStatus === 'running';
            rejectButton.style.cssText = 'padding:0.42rem 0.72rem;border-radius:0.5rem;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.22);color:#fca5a5;font-size:0.68rem;font-weight:700;cursor:pointer;';
            rejectButton.onclick = () => decide('reject');

            const approveButton = document.createElement('button');
            approveButton.type = 'button';
            approveButton.dataset.orbiHardwarePilotDecision = 'approve';
            approveButton.textContent = c.approve;
            approveButton.disabled = decisionStatus === 'running';
            approveButton.style.cssText = 'padding:0.42rem 0.72rem;border-radius:0.5rem;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.22);color:#a7f3d0;font-size:0.68rem;font-weight:700;cursor:pointer;';
            approveButton.onclick = () => decide('approve');

            actions.appendChild(rejectButton);
            actions.appendChild(approveButton);
            section.appendChild(actions);
        }

        if (decisionStatus === 'running') {
            section.appendChild(text('div', c.deciding, 'font-size:0.64rem;color:#fde68a;'));
        }
        if (decisionStatus === 'error') {
            section.appendChild(text('div', c.decisionError, 'font-size:0.64rem;color:#fca5a5;'));
        }
        if (decisionResult) {
            const message = decisionResult.decision === 'approve' ? c.decisionApproved : c.decisionRejected;
            section.appendChild(text(
                'div',
                message,
                `font-size:0.66rem;font-weight:800;line-height:1.4;color:${decisionResult.decision === 'approve' ? '#a7f3d0' : '#fca5a5'};`,
            ));
            if (decisionResult.profile) {
                const profileGrid = document.createElement('div');
                profileGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.6rem;';
                profileGrid.appendChild(metric(c.profileStatus, decisionResult.profile.status));
                profileGrid.appendChild(metric(c.profileScope, decisionResult.profile.certificationScope));
                profileGrid.appendChild(metric(c.target, targetLabel(decisionResult.profile.target)));
                profileGrid.appendChild(metric(c.authority, decisionResult.profile.executionAuthority));
                section.appendChild(profileGrid);
                section.appendChild(text('div', c.profileSafe, 'font-size:0.61rem;color:#fde68a;line-height:1.45;'));
            }
        }

        if (typeof hardwarePilotImport === 'function') {
            const action = document.createElement('div');
            action.style.cssText = 'display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;';

            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.orbiHardwarePilotImport = 'explicit-user-open';
            button.textContent = c.action;
            button.disabled = actionStatus === 'running' || decisionStatus === 'running';
            button.style.cssText = 'padding:0.42rem 0.72rem;border-radius:0.5rem;background:rgba(139,92,246,0.11);border:1px solid rgba(167,139,250,0.25);color:#ddd6fe;font-size:0.68rem;font-weight:700;cursor:pointer;';
            button.onclick = async () => {
                if (actionStatus === 'running') return;
                actionStatus = 'running';
                importResult = null;
                resetReview();
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
