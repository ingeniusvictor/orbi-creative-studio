function textNode(tag, text, style = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
}

function button(label, onClick) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.style.cssText = 'padding:0.45rem 0.7rem;border-radius:0.55rem;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:0.7rem;font-weight:700;cursor:pointer;';
    node.onclick = onClick;
    return node;
}

const MAX_DIAGNOSTIC_CHARS = 65536;

function pretty(value) {
    let text;
    try {
        text = JSON.stringify(value, null, 2);
    } catch {
        text = JSON.stringify({
            ok: false,
            error: {
                code: 'SCENE3D_DIAGNOSTIC_FORMAT_FAILED',
                message: 'Scene3D diagnostic result could not be formatted',
            },
        }, null, 2);
    }

    if (typeof text !== 'string') {
        text = JSON.stringify({
            ok: false,
            error: {
                code: 'SCENE3D_DIAGNOSTIC_EMPTY_RESULT',
                message: 'Scene3D diagnostic returned no serializable result',
            },
        }, null, 2);
    }

    if (text.length <= MAX_DIAGNOSTIC_CHARS) return text;
    return `${text.slice(0, MAX_DIAGNOSTIC_CHARS)}
… [diagnostic output truncated]`;
}

export function Scene3DPilotDiagnosticsPanel({
    scene3d = typeof window !== 'undefined' ? window.orbiScene3D : null,
} = {}) {
    const root = document.createElement('div');
    root.dataset.orbiScene3dDiagnostics = 'read-only';
    root.style.cssText = 'display:flex;flex-direction:column;gap:0.85rem;';

    root.appendChild(textNode(
        'div',
        'ORBI Scene3D Pilot',
        'font-size:0.9rem;color:#fff;font-weight:800;',
    ));
    root.appendChild(textNode(
        'div',
        'Read-only diagnostics. This panel cannot execute recipes, retry operations, release reservations, or reconcile pending executions.',
        'font-size:0.68rem;color:rgba(255,255,255,0.42);line-height:1.45;',
    ));

    const statusBox = document.createElement('div');
    statusBox.style.cssText = 'padding:0.8rem;border:1px solid rgba(255,255,255,0.08);border-radius:0.75rem;background:rgba(255,255,255,0.025);';
    root.appendChild(statusBox);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;';
    root.appendChild(actions);

    const objectRow = document.createElement('div');
    objectRow.style.cssText = 'display:flex;gap:0.5rem;';
    const objectInput = document.createElement('input');
    objectInput.type = 'text';
    objectInput.placeholder = 'Blender object name';
    objectInput.maxLength = 128;
    objectInput.style.cssText = 'flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:0.55rem;padding:0.5rem 0.65rem;color:#fff;font-size:0.72rem;';
    objectRow.appendChild(objectInput);
    root.appendChild(objectRow);

    const output = document.createElement('pre');
    output.dataset.orbiScene3dOutput = 'sanitized';
    output.style.cssText = 'margin:0;max-height:18rem;overflow:auto;white-space:pre-wrap;word-break:break-word;padding:0.75rem;border-radius:0.75rem;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);font-size:0.64rem;color:rgba(255,255,255,0.66);';
    output.textContent = 'No diagnostic result yet.';
    root.appendChild(output);

    let status = null;

    function setEnabledActions(enabled) {
        objectInput.disabled = !enabled;
        for (const node of actions.querySelectorAll('[data-requires-enabled="true"]')) {
            node.disabled = !enabled;
            node.style.opacity = enabled ? '1' : '0.45';
        }
    }

    function setBusy(value) {
        for (const node of actions.querySelectorAll('button')) {
            node.disabled = value;
            node.style.opacity = value ? '0.55' : '1';
        }
    }

    function renderStatus(value) {
        status = value;
        statusBox.replaceChildren();

        const enabled = Boolean(value && value.ok === true && value.status?.enabled === true);
        setEnabledActions(enabled);

        if (!value || value.ok !== true || !value.status) {
            statusBox.appendChild(textNode(
                'div',
                'Scene3D bridge unavailable',
                'font-size:0.72rem;color:#fca5a5;font-weight:800;',
            ));
            return;
        }
        statusBox.appendChild(textNode(
            'div',
            enabled ? 'Pilot enabled' : 'Pilot disabled',
            `font-size:0.72rem;font-weight:800;color:${enabled ? '#67e8f9' : '#fde68a'};`,
        ));
        statusBox.appendChild(textNode(
            'div',
            `mode=${value.status.mode} · processStarted=${Boolean(value.status.processStarted)} · automaticR2Retry=${Boolean(value.status.automaticR2Retry)}`,
            'font-size:0.64rem;color:rgba(255,255,255,0.42);margin-top:0.35rem;',
        ));
    }

    async function run(label, fn) {
        setBusy(true);
        output.textContent = `${label}…`;
        try {
            const result = await fn();
            output.textContent = pretty(result);
            return result;
        } catch (error) {
            output.textContent = pretty({
                ok: false,
                error: {
                    code: 'SCENE3D_DIAGNOSTIC_CALL_FAILED',
                    message: 'Scene3D diagnostic call failed',
                },
            });
            return null;
        } finally {
            setBusy(false);
            if (status?.status?.enabled !== true) {
                setEnabledActions(false);
            }
        }
    }

    const refresh = button('Refresh status', async () => {
        if (!scene3d?.getStatus) return;
        const value = await run('Refreshing status', () => scene3d.getStatus());
        if (value) renderStatus(value);
    });
    actions.appendChild(refresh);

    const scene = button('Read scene', () => run('Reading scene', () => scene3d.sceneInfo()));
    scene.dataset.requiresEnabled = 'true';
    actions.appendChild(scene);

    const pending = button('Pending recoveries', () => run(
        'Reading pending recoveries',
        () => scene3d.pendingRecoveries(),
    ));
    pending.dataset.requiresEnabled = 'true';
    actions.appendChild(pending);

    const history = button('Reconciliation history', () => run(
        'Reading reconciliation history',
        () => scene3d.reconciliationHistory(),
    ));
    history.dataset.requiresEnabled = 'true';
    actions.appendChild(history);

    const objectLookup = button('Read object', () => {
        const name = objectInput.value.trim();
        if (!name) {
            output.textContent = pretty({
                ok: false,
                error: {
                    code: 'SCENE3D_OBJECT_NAME_REQUIRED',
                    message: 'Enter an object name',
                },
            });
            return null;
        }
        return run('Reading object', () => scene3d.objectInfo(name));
    });
    objectLookup.dataset.requiresEnabled = 'true';
    objectRow.appendChild(objectLookup);

    // All provider-touching diagnostics are fail-closed until getStatus explicitly
    // confirms that the pilot is enabled.
    setEnabledActions(false);

    if (!scene3d?.getStatus) {
        renderStatus(null);
        refresh.disabled = true;
        objectInput.disabled = true;
    } else {
        // Status is intentionally the only automatic request. QB-16 guarantees that
        // getStatus() does not create the sidecar child process.
        scene3d.getStatus()
            .then(renderStatus)
            .catch(() => renderStatus(null));
    }

    return root;
}
