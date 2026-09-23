const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ALLOWED_RECIPES,
    DELETE_RECIPE,
    validateHistoryRequestId,
    validateObjectName,
    validateRecipeRequest,
} = require('../electron/lib/scene3dPilotPolicy');

test('QB-16 product allowlist is exactly the certified QB-10 pair', () => {
    assert.deepEqual(ALLOWED_RECIPES, [
        'orbi.blender.create_cube.v1',
        'orbi.blender.delete_object.v1',
    ]);
});

test('QB-19 every execution requires explicit confirmation and review token', () => {
    assert.throws(
        () => validateRecipeRequest({
            recipeId: 'orbi.blender.create_cube.v1',
            parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
        }, { execution: true }),
        /explicit product confirmation/,
    );

    assert.throws(
        () => validateRecipeRequest({
            recipeId: 'orbi.blender.create_cube.v1',
            parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
            confirmed: true,
        }, { execution: true }),
        /dry-run review token/,
    );

    const request = validateRecipeRequest({
        recipeId: 'orbi.blender.create_cube.v1',
        parameters: { name: 'Cube', size: 1, location: [0, 0, 0] },
        confirmed: true,
        reviewToken: 'review-token',
    }, { execution: true });

    assert.equal(request.recipeId, 'orbi.blender.create_cube.v1');
    assert.equal(request.parameters.name, 'Cube');
    assert.equal(request.reviewToken, 'review-token');
    assert.equal('confirmed' in request, false);
});

test('QB-19 delete execution requires confirmation and reviewed dry-run token', () => {
    assert.throws(
        () => validateRecipeRequest({
            recipeId: DELETE_RECIPE,
            parameters: { name: 'Cube' },
        }, { execution: true }),
        /explicit product confirmation/,
    );

    const request = validateRecipeRequest({
        recipeId: DELETE_RECIPE,
        parameters: { name: 'Cube' },
        confirmed: true,
        reviewToken: 'delete-review-token',
    }, { execution: true });

    assert.equal(request.recipeId, DELETE_RECIPE);
    assert.deepEqual(request.parameters, { name: 'Cube' });
    assert.equal(request.reviewToken, 'delete-review-token');
    assert.equal('confirmed' in request, false);
});

test('QB-16 delete dry-run does not require destructive confirmation', () => {
    const request = validateRecipeRequest({
        recipeId: DELETE_RECIPE,
        parameters: { name: 'Cube' },
    }, { execution: false });

    assert.equal(request.recipeId, DELETE_RECIPE);
});

test('QB-16 recipe request rejects provider code identity and retry smuggling', () => {
    for (const [key, value] of [
        ['code', 'import os'],
        ['provider', 'qwen'],
        ['requestId', 'attacker-id'],
        ['retry', true],
        ['ledgerPath', '/tmp/x'],
    ]) {
        assert.throws(
            () => validateRecipeRequest({
                recipeId: 'orbi.blender.create_cube.v1',
                parameters: {},
                [key]: value,
            }, { execution: true }),
            /unexpected field/,
        );
    }
});

test('QB-16 recipe allowlist rejects unknown recipes', () => {
    assert.throws(
        () => validateRecipeRequest({
            recipeId: 'orbi.blender.execute_python.v1',
            parameters: {},
        }, { execution: true }),
        /not allowlisted/,
    );
});

test('QB-16 object name and recovery request-id readers are bounded', () => {
    assert.equal(validateObjectName(' Cube '), 'Cube');
    assert.throws(() => validateObjectName(''), /non-empty/);
    assert.throws(() => validateObjectName('x'.repeat(129)), /128/);

    assert.equal(validateHistoryRequestId(undefined), null);
    assert.equal(validateHistoryRequestId(' req-1 '), 'req-1');
    assert.throws(() => validateHistoryRequestId(''), /non-empty/);
    assert.throws(() => validateHistoryRequestId('x'.repeat(257)), /256/);
});
