function makeText(tag, text, style = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
}

function makeButton(label) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.style.cssText = 'padding:0.45rem 0.7rem;border-radius:0.55rem;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:0.7rem;font-weight:700;cursor:pointer;';
    return node;
}

function boundedNumber(input, label, min, max) {
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new TypeError(`${label} must be between ${min} and ${max}`);
    }
    return value;
}

function governedObjectName(input) {
    const value = input.value.trim();
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(value)) {
        throw new TypeError(
            'Object name must use 1-64 characters from A-Z, a-z, 0-9, _, ., or -',
        );
    }
    return value;
}

export function Scene3DExecutionReviewPanel({ scene3d }) {
    if (!scene3d
        || typeof scene3d.dryRunRecipe !== 'function'
        || typeof scene3d.executeRecipe !== 'function') {
        throw new TypeError('Scene3D governed execution bridge is required');
    }

    const root = document.createElement('div');
    root.dataset.orbiScene3dExecutionReview = 'governed';
    root.style.cssText = 'display:flex;flex-direction:column;gap:0.8rem;padding:0.9rem;border:1px solid rgba(34,211,238,0.14);border-radius:0.8rem;background:rgba(34,211,238,0.025);';

    root.appendChild(makeText(
        'div',
        'Governed Scene3D execution',
        'font-size:0.75rem;color:#fff;font-weight:800;',
    ));
    root.appendChild(makeText(
        'div',
        'Execution requires: dry-run → review evidence → explicit confirmation. Any input change invalidates the current review.',
        'font-size:0.64rem;color:rgba(255,255,255,0.4);line-height:1.45;',
    ));

    const recipeRow = document.createElement('label');
    recipeRow.style.cssText = 'display:flex;flex-direction:column;gap:0.3rem;font-size:0.65rem;color:rgba(255,255,255,0.5);';
    recipeRow.appendChild(document.createTextNode('Recipe'));
    const recipe = document.createElement('select');
    recipe.dataset.scene3dField = 'recipe';
    recipe.style.cssText = 'background:#171717;color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;padding:0.5rem;';
    for (const [value, label] of [
        ['orbi.blender.create_cube.v1', 'Create cube'],
        ['orbi.blender.delete_object.v1', 'Delete object'],
    ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        recipe.appendChild(option);
    }
    recipeRow.appendChild(recipe);
    root.appendChild(recipeRow);

    const nameRow = document.createElement('label');
    nameRow.style.cssText = recipeRow.style.cssText;
    nameRow.appendChild(document.createTextNode('Object name'));
    const objectName = document.createElement('input');
    objectName.type = 'text';
    objectName.maxLength = 64;
    objectName.value = 'ORBI_Cube';
    objectName.dataset.scene3dField = 'name';
    objectName.style.cssText = 'background:rgba(255,255,255,0.04);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;padding:0.5rem;';
    nameRow.appendChild(objectName);
    root.appendChild(nameRow);

    const createFields = document.createElement('div');
    createFields.dataset.scene3dCreateFields = 'true';
    createFields.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0.5rem;';

    const numericFields = {};
    for (const [key, label, value, min, max, step] of [
        ['size', 'Size', '1', '0.01', '1000', '0.01'],
        ['x', 'X', '0', '-10000', '10000', '0.1'],
        ['y', 'Y', '0', '-10000', '10000', '0.1'],
        ['z', 'Z', '0', '-10000', '10000', '0.1'],
    ]) {
        const wrap = document.createElement('label');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.25rem;font-size:0.62rem;color:rgba(255,255,255,0.45);';
        wrap.appendChild(document.createTextNode(label));
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        input.min = min;
        input.max = max;
        input.step = step;
        input.dataset.scene3dField = key;
        input.style.cssText = 'min-width:0;background:rgba(255,255,255,0.04);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;padding:0.45rem;';
        numericFields[key] = input;
        wrap.appendChild(input);
        createFields.appendChild(wrap);
    }
    root.appendChild(createFields);

    const confirmationRow = document.createElement('label');
    confirmationRow.style.cssText = 'display:flex;align-items:flex-start;gap:0.5rem;font-size:0.64rem;color:rgba(255,255,255,0.55);line-height:1.4;';
    const confirmation = document.createElement('input');
    confirmation.type = 'checkbox';
    confirmation.dataset.scene3dConfirmation = 'explicit';
    confirmationRow.appendChild(confirmation);
    confirmationRow.appendChild(document.createTextNode(
        'I reviewed the dry-run evidence and explicitly authorize this one execution attempt.',
    ));
    root.appendChild(confirmationRow);

    const evidence = document.createElement('pre');
    evidence.dataset.scene3dReviewEvidence = 'sanitized';
    evidence.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;padding:0.7rem;border-radius:0.65rem;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.06);font-size:0.61rem;color:rgba(255,255,255,0.62);';
    evidence.textContent = 'No reviewed dry-run yet.';
    root.appendChild(evidence);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;';
    const reviewButton = makeButton('Review dry-run');
    reviewButton.dataset.scene3dAction = 'review';
    const executeButton = makeButton('Execute reviewed action');
    executeButton.dataset.scene3dAction = 'execute-reviewed';
    executeButton.disabled = true;
    executeButton.style.opacity = '0.45';
    actions.appendChild(reviewButton);
    actions.appendChild(executeButton);
    root.appendChild(actions);

    const result = document.createElement('pre');
    result.dataset.scene3dExecutionResult = 'sanitized';
    result.style.cssText = evidence.style.cssText;
    result.textContent = 'No execution result yet.';
    root.appendChild(result);

    let review = null;
    let busy = false;

    function currentPayload() {
        const recipeId = recipe.value;
        const name = governedObjectName(objectName);

        if (recipeId === 'orbi.blender.delete_object.v1') {
            return {
                recipeId,
                parameters: { name },
            };
        }

        return {
            recipeId,
            parameters: {
                name,
                size: boundedNumber(numericFields.size, 'Size', 0.01, 1000),
                location: [
                    boundedNumber(numericFields.x, 'X', -10000, 10000),
                    boundedNumber(numericFields.y, 'Y', -10000, 10000),
                    boundedNumber(numericFields.z, 'Z', -10000, 10000),
                ],
            },
        };
    }

    function clearReview(reason = 'Review invalidated. Run dry-run again.') {
        review = null;
        confirmation.checked = false;
        executeButton.disabled = true;
        executeButton.style.opacity = '0.45';
        evidence.textContent = reason;
    }

    function setBusy(value) {
        busy = value;
        reviewButton.disabled = value;
        executeButton.disabled = value || !review || confirmation.checked !== true;
        reviewButton.style.opacity = value ? '0.55' : '1';
        executeButton.style.opacity = executeButton.disabled ? '0.45' : '1';
    }

    function refreshRecipeFields() {
        createFields.style.display = recipe.value === 'orbi.blender.create_cube.v1'
            ? 'grid'
            : 'none';
    }

    function invalidateFromInput() {
        if (review) clearReview();
        else {
            confirmation.checked = false;
            executeButton.disabled = true;
            executeButton.style.opacity = '0.45';
        }
    }

    for (const input of root.querySelectorAll('[data-scene3d-field]')) {
        input.addEventListener('input', invalidateFromInput);
        input.addEventListener('change', invalidateFromInput);
    }
    recipe.addEventListener('change', refreshRecipeFields);
    refreshRecipeFields();

    confirmation.addEventListener('change', () => {
        executeButton.disabled = busy || !review || confirmation.checked !== true;
        executeButton.style.opacity = executeButton.disabled ? '0.45' : '1';
    });

    reviewButton.onclick = async () => {
        clearReview('Preparing reviewed dry-run…');
        result.textContent = 'No execution result yet.';

        let payload;
        try {
            payload = currentPayload();
        } catch {
            evidence.textContent = 'Invalid recipe input.';
            return;
        }

        setBusy(true);
        try {
            const response = await scene3d.dryRunRecipe(payload);
            if (!response || response.ok !== true || !response.review?.token) {
                evidence.textContent = JSON.stringify(response, null, 2);
                return;
            }

            review = Object.freeze({
                token: response.review.token,
                recipeId: payload.recipeId,
                parameters: payload.parameters,
                fingerprint: response.review.fingerprint ?? null,
                codeSha256: response.review.codeSha256 ?? null,
                expiresAt: response.review.expiresAt ?? null,
            });

            evidence.textContent = JSON.stringify({
                recipeId: review.recipeId,
                parameters: review.parameters,
                fingerprint: review.fingerprint,
                codeSha256: review.codeSha256,
                expiresAt: review.expiresAt,
                oneShot: true,
                providerCalled: response.data?.providerCalled ?? null,
                networkAllowed: response.data?.recipe?.network_allowed ?? null,
                filesystemScope: response.data?.recipe?.filesystem_scope ?? null,
            }, null, 2);
        } catch {
            evidence.textContent = 'Dry-run review failed.';
        } finally {
            setBusy(false);
        }
    };

    executeButton.onclick = async () => {
        if (!review || confirmation.checked !== true || busy) return;

        const token = review.token;
        let payload;
        try {
            payload = currentPayload();
        } catch {
            clearReview('Invalid recipe input. Run dry-run again.');
            return;
        }

        // Clear the local capability before awaiting IPC so double-clicks, renderer retries,
        // or exception paths cannot reuse the same one-shot review token.
        clearReview('Review consumed. A new dry-run is required for any further execution.');
        setBusy(true);
        result.textContent = 'Executing reviewed action…';

        try {
            const response = await scene3d.executeRecipe({
                ...payload,
                confirmed: true,
                reviewToken: token,
            });
            result.textContent = JSON.stringify(response, null, 2);
        } catch {
            result.textContent = JSON.stringify({
                ok: false,
                error: {
                    code: 'SCENE3D_EXECUTION_CALL_FAILED',
                    message: 'Execution result is uncertain. Inspect pending recoveries; do not retry automatically.',
                },
            }, null, 2);
        } finally {
            setBusy(false);
        }
    };

    return root;
}
