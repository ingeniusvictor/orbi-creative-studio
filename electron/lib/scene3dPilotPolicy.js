'use strict';

const DELETE_RECIPE = 'orbi.blender.delete_object.v1';
const ALLOWED_RECIPES = Object.freeze([
    'orbi.blender.create_cube.v1',
    DELETE_RECIPE,
]);
const ALLOWED_RECIPE_SET = new Set(ALLOWED_RECIPES);

function assertPlainObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${label} must be an object`);
    }
    return value;
}

function assertExactKeys(value, allowedKeys, label) {
    const keys = Object.keys(value);
    const unknown = keys.filter((key) => !allowedKeys.has(key));
    if (unknown.length > 0) {
        throw new TypeError(
            `${label} contains unexpected field(s): ${unknown.sort().join(', ')}`,
        );
    }
}

function validateRecipeRequest(value, { execution }) {
    const request = assertPlainObject(value, 'Scene3D recipe request');
    const allowed = execution
        ? new Set(['recipeId', 'parameters', 'confirmed', 'reviewToken'])
        : new Set(['recipeId', 'parameters']);
    assertExactKeys(request, allowed, 'Scene3D recipe request');

    const recipeId = typeof request.recipeId === 'string' ? request.recipeId.trim() : '';
    if (!ALLOWED_RECIPE_SET.has(recipeId)) {
        throw new TypeError('Scene3D recipe is not allowlisted');
    }

    const parameters = request.parameters === undefined ? {} : request.parameters;
    assertPlainObject(parameters, 'Scene3D recipe parameters');

    if (!execution) {
        return Object.freeze({
            recipeId,
            parameters,
        });
    }

    if (request.confirmed !== true) {
        throw new TypeError(
            'Scene3D execution requires explicit product confirmation',
        );
    }

    const reviewToken = typeof request.reviewToken === 'string'
        ? request.reviewToken.trim()
        : '';
    if (!reviewToken || reviewToken.length > 128) {
        throw new TypeError(
            'Scene3D execution requires a valid dry-run review token',
        );
    }

    return Object.freeze({
        recipeId,
        parameters,
        reviewToken,
    });
}

function validateObjectName(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name.length > 128) {
        throw new TypeError(
            'objectName must be a non-empty string up to 128 characters',
        );
    }
    return name;
}

function validateHistoryRequestId(value) {
    if (value === undefined || value === null) return null;

    const requestId = typeof value === 'string' ? value.trim() : '';
    if (!requestId || requestId.length > 256) {
        throw new TypeError(
            'requestId must be a non-empty string up to 256 characters',
        );
    }
    return requestId;
}

module.exports = {
    ALLOWED_RECIPES,
    DELETE_RECIPE,
    validateHistoryRequestId,
    validateObjectName,
    validateRecipeRequest,
};
