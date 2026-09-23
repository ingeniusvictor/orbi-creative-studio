const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test('QB-20 execution UI exposes only the two certified recipes', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.equal(
        (source.match(/orbi\.blender\.create_cube\.v1/g) || []).length > 0,
        true,
    );
    assert.equal(
        (source.match(/orbi\.blender\.delete_object\.v1/g) || []).length > 0,
        true,
    );

    for (const forbidden of [
        'execute_python',
        'executeBlenderCode',
        'executePython',
        'providerSelector',
        'providerId',
        'qwen_mm_plugins',
        'qwen-mm-plugins',
        'ledgerPath',
        'setProvider',
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }

    // A sanitized boolean is review evidence, not provider identity/configuration.
    assert.ok(source.includes('providerCalled: response.data?.providerCalled ?? null'));
});

test('QB-20 UI requires dry-run review before execution', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('scene3d.dryRunRecipe(payload)'));
    assert.ok(source.includes('response.review?.token'));
    assert.ok(source.includes("executeButton.disabled = true"));
    assert.ok(source.includes('!review || confirmation.checked !== true'));
});

test('QB-20 input changes invalidate local review capability', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('function invalidateFromInput()'));
    assert.ok(source.includes('if (review) clearReview()'));
    assert.ok(source.includes("input.addEventListener('input', invalidateFromInput)"));
    assert.ok(source.includes("input.addEventListener('change', invalidateFromInput)"));
});

test('QB-20 execute consumes local review before awaiting IPC', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    const tokenIndex = source.indexOf('const token = review.token;');
    const clearIndex = source.indexOf("clearReview('Review consumed.");
    const executeIndex = source.indexOf('await scene3d.executeRecipe({');

    assert.ok(tokenIndex >= 0);
    assert.ok(clearIndex > tokenIndex);
    assert.ok(executeIndex > clearIndex);
});

test('QB-20 renderer sends confirmation and opaque review token but no request id', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('confirmed: true'));
    assert.ok(source.includes('reviewToken: token'));
    assert.equal(source.includes('requestId:'), false);
    assert.equal(source.includes('retry:'), false);
});

test('QB-20 review evidence never renders the opaque review token', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    const evidenceStart = source.indexOf('evidence.textContent = formatOutput({');
    const evidenceEnd = source.indexOf('});', evidenceStart);
    assert.ok(evidenceStart >= 0);
    assert.ok(evidenceEnd > evidenceStart);

    const evidenceBlock = source.slice(evidenceStart, evidenceEnd);
    assert.equal(evidenceBlock.includes('token'), false);
    assert.ok(evidenceBlock.includes('fingerprint'));
    assert.ok(evidenceBlock.includes('codeSha256'));
});

test('QB-20 recipe inputs match QB-10 name and numeric bounds', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('/^[A-Za-z0-9_.-]{1,64}$/'));
    assert.ok(source.includes("boundedNumber(numericFields.size, 'Size', 0.01, 1000)"));
    assert.ok(source.includes("boundedNumber(numericFields.x, 'X', -10000, 10000)"));
    assert.ok(source.includes("boundedNumber(numericFields.y, 'Y', -10000, 10000)"));
    assert.ok(source.includes("boundedNumber(numericFields.z, 'Z', -10000, 10000)"));
});

test('QB-20 uncertain execution failure directs user to recovery instead of retry', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('Inspect pending recoveries; do not retry automatically.'));
    assert.equal(source.includes('setTimeout(() => scene3d.executeRecipe'), false);
    assert.equal(source.includes('while ('), false);
});

test('QB-20 execution controls render only when main status says executionEnabled', () => {
    const source = read('src/components/Scene3DPilotDiagnosticsPanel.js');

    assert.ok(source.includes('value.status.executionEnabled === true'));
    assert.ok(source.includes('Scene3DExecutionReviewPanel({ scene3d })'));
    assert.ok(source.includes('Governed execution controls are disabled by main-process policy.'));
});

test('QB-20 provider-derived result and evidence use bounded textContent only', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('evidence.textContent = formatOutput('));
    assert.ok(source.includes('result.textContent = formatOutput('));
    assert.equal(source.includes('evidence.innerHTML'), false);
    assert.equal(source.includes('result.innerHTML'), false);
    assert.ok(source.includes('const MAX_EXECUTION_OUTPUT_CHARS = 65536'));
    assert.ok(source.includes('text.slice(0, MAX_EXECUTION_OUTPUT_CHARS)'));
    assert.ok(source.includes('[execution output truncated]'));
});


test('QB-20 formatter handles empty or unserializable output without exposing a raw exception', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('SCENE3D_EXECUTION_FORMAT_FAILED'));
    assert.ok(source.includes('SCENE3D_EXECUTION_EMPTY_RESULT'));
    assert.ok(source.includes("typeof text !== 'string'"));
});

test('QB-20 execution UI has no retry loop or authority mutation surface', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    for (const forbidden of [
        'setExecutionEnabled',
        'retryExecution',
        'releaseReservation',
        'reconcilePending',
        'setProvider',
        'setLedgerPath',
    ]) {
        assert.equal(source.includes(forbidden), false, forbidden);
    }
});


test('QB-20 opaque review token remains closure-only and is never persisted', () => {
    const source = read('src/components/Scene3DExecutionReviewPanel.js');

    assert.ok(source.includes('let review = null'));
    assert.ok(source.includes('token: response.review.token'));
    assert.equal(source.includes('localStorage'), false);
    assert.equal(source.includes('sessionStorage'), false);
    assert.equal(source.includes('dataset.reviewToken'), false);
    assert.equal(source.includes('setAttribute(\'data-review'), false);
});
