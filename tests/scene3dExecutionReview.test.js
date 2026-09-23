const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createScene3DExecutionReviewRegistry,
    executionFingerprint,
    normalizeJson,
} = require('../electron/lib/scene3dExecutionReview');

function dryRunResponse({
    recipeId = 'orbi.blender.create_cube.v1',
    parameters = { name: 'Cube', size: 1, location: [0, 0, 0] },
    codeSha256 = 'a'.repeat(64),
} = {}) {
    return {
        ok: true,
        data: {
            execution: 'dry-run',
            recipe: {
                recipe_id: recipeId,
                parameters,
                code_sha256: codeSha256,
                filesystem_scope: [],
                network_allowed: false,
            },
            providerCalled: false,
        },
    };
}

test('QB-19 fingerprint is deterministic across object key order', () => {
    const a = executionFingerprint(
        'orbi.blender.create_cube.v1',
        { name: 'Cube', size: 1, location: [0, 0, 0] },
    );
    const b = executionFingerprint(
        'orbi.blender.create_cube.v1',
        { location: [0, 0, 0], size: 1, name: 'Cube' },
    );

    assert.equal(a, b);
    assert.equal(a.length, 64);
});

test('QB-19 fingerprint changes when reviewed execution payload changes', () => {
    const a = executionFingerprint(
        'orbi.blender.create_cube.v1',
        { name: 'Cube', size: 1, location: [0, 0, 0] },
    );
    const b = executionFingerprint(
        'orbi.blender.create_cube.v1',
        { name: 'Cube', size: 2, location: [0, 0, 0] },
    );

    assert.notEqual(a, b);
});

test('QB-19 canonical JSON rejects non-finite and non-JSON values', () => {
    assert.throws(
        () => normalizeJson({ size: Number.NaN }),
        /finite JSON numbers/,
    );
    assert.throws(
        () => normalizeJson({ value: undefined }),
        /must not be undefined/,
    );
    assert.throws(
        () => normalizeJson({ date: new Date() }),
        /plain JSON objects/,
    );
});

test('QB-19 issue requires successful provider-free dry-run', () => {
    const registry = createScene3DExecutionReviewRegistry({
        randomUUIDImpl: () => 'review-1',
        nowImpl: () => 1000,
    });

    for (const response of [
        null,
        { ok: false },
        { ok: true, data: { execution: 'executed', providerCalled: true } },
        { ok: true, data: { execution: 'dry-run', providerCalled: true } },
    ]) {
        assert.throws(
            () => registry.issue({
                recipeId: 'orbi.blender.create_cube.v1',
                parameters: {},
                dryRunResponse: response,
            }),
            (error) => error && error.code === 'SCENE3D_REVIEW_DRY_RUN_REQUIRED',
        );
    }
});

test('QB-19 issued review exposes bounded evidence and is one-shot', () => {
    let now = 1000;
    const registry = createScene3DExecutionReviewRegistry({
        randomUUIDImpl: () => 'review-token',
        nowImpl: () => now,
        ttlMs: 5000,
    });
    const parameters = { name: 'Cube', size: 1, location: [0, 0, 0] };

    const review = registry.issue({
        recipeId: 'orbi.blender.create_cube.v1',
        parameters,
        dryRunResponse: dryRunResponse({ parameters }),
    });

    assert.deepEqual(review, {
        token: 'review-token',
        recipeId: 'orbi.blender.create_cube.v1',
        fingerprint: executionFingerprint(
            'orbi.blender.create_cube.v1',
            parameters,
        ),
        codeSha256: 'a'.repeat(64),
        expiresAt: 6000,
        oneShot: true,
    });
    assert.equal(registry.size(), 1);

    const consumed = registry.consume({
        token: review.token,
        recipeId: review.recipeId,
        parameters,
    });

    assert.equal(consumed.fingerprint, review.fingerprint);
    assert.equal(registry.size(), 0);

    assert.throws(
        () => registry.consume({
            token: review.token,
            recipeId: review.recipeId,
            parameters,
        }),
        (error) => error && error.code === 'SCENE3D_REVIEW_REQUIRED',
    );
});

test('QB-19 payload mismatch consumes the token and blocks later reuse', () => {
    const registry = createScene3DExecutionReviewRegistry({
        randomUUIDImpl: () => 'review-mismatch',
        nowImpl: () => 1000,
    });
    const original = { name: 'Cube', size: 1, location: [0, 0, 0] };

    const review = registry.issue({
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: original,
        dryRunResponse: dryRunResponse({ parameters: original }),
    });

    assert.throws(
        () => registry.consume({
            token: review.token,
            recipeId: review.recipeId,
            parameters: { ...original, size: 2 },
        }),
        (error) => error && error.code === 'SCENE3D_REVIEW_MISMATCH',
    );
    assert.equal(registry.size(), 0);

    assert.throws(
        () => registry.consume({
            token: review.token,
            recipeId: review.recipeId,
            parameters: original,
        }),
        (error) => error && error.code === 'SCENE3D_REVIEW_REQUIRED',
    );
});

test('QB-19 expired review cannot authorize execution', () => {
    let now = 1000;
    const registry = createScene3DExecutionReviewRegistry({
        randomUUIDImpl: () => 'review-expired',
        nowImpl: () => now,
        ttlMs: 1000,
    });

    const review = registry.issue({
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
        dryRunResponse: dryRunResponse({ parameters: {} }),
    });

    now = 2500;

    assert.throws(
        () => registry.consume({
            token: review.token,
            recipeId: review.recipeId,
            parameters: {},
        }),
        (error) => error && error.code === 'SCENE3D_REVIEW_EXPIRED',
    );
});

test('QB-19 review capacity is bounded', () => {
    let id = 0;
    const registry = createScene3DExecutionReviewRegistry({
        randomUUIDImpl: () => `review-${++id}`,
        nowImpl: () => 1000,
        maxReviews: 2,
    });

    for (let index = 0; index < 2; index += 1) {
        registry.issue({
            recipeId: 'orbi.blender.create_cube.v1',
            parameters: { name: `Cube${index}` },
            dryRunResponse: dryRunResponse({
                parameters: { name: `Cube${index}` },
            }),
        });
    }

    assert.throws(
        () => registry.issue({
            recipeId: 'orbi.blender.create_cube.v1',
            parameters: { name: 'Cube3' },
            dryRunResponse: dryRunResponse({
                parameters: { name: 'Cube3' },
            }),
        }),
        (error) => error && error.code === 'SCENE3D_REVIEW_CAPACITY',
    );
});

test('QB-19 invalidateAll revokes outstanding review capabilities', () => {
    const registry = createScene3DExecutionReviewRegistry({
        randomUUIDImpl: () => 'review-reset',
        nowImpl: () => 1000,
    });
    registry.issue({
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: {},
        dryRunResponse: dryRunResponse({ parameters: {} }),
    });

    assert.equal(registry.size(), 1);
    registry.invalidateAll();
    assert.equal(registry.size(), 0);
});
