'use strict';

const { randomUUID } = require('node:crypto');
const { ipcMain } = require('electron');
const { assertTrustedSender } = require('./providerCredentials');
const {
    publicScene3DConfig,
    resolveScene3DPilotConfig,
} = require('./scene3dPilotConfig');
const {
    createScene3DSidecarClient,
} = require('./scene3dSidecarClient');
const {
    ALLOWED_RECIPES,
    validateHistoryRequestId,
    validateObjectName,
    validateRecipeRequest,
} = require('./scene3dPilotPolicy');

const CHANNELS = Object.freeze({
    status: 'orbi-scene3d:status',
    sceneInfo: 'orbi-scene3d:scene-info',
    objectInfo: 'orbi-scene3d:object-info',
    dryRunRecipe: 'orbi-scene3d:dry-run-recipe',
    executeRecipe: 'orbi-scene3d:execute-recipe',
    pendingRecoveries: 'orbi-scene3d:pending-recoveries',
    reconciliationHistory: 'orbi-scene3d:reconciliation-history',
});

function disabled() {
    return Object.freeze({
        ok: false,
        error: Object.freeze({
            code: 'SCENE3D_PILOT_DISABLED',
            message: 'ORBI Scene3D pilot is disabled',
            retryable: false,
        }),
    });
}

function invalid(message) {
    return Object.freeze({
        ok: false,
        error: Object.freeze({
            code: 'SCENE3D_PILOT_REQUEST_INVALID',
            message,
            retryable: false,
        }),
    });
}

function sanitizeTransportError(error) {
    return Object.freeze({
        ok: false,
        error: Object.freeze({
            code: error && error.code ? String(error.code) : 'SCENE3D_TRANSPORT_ERROR',
            message: error && error.message ? String(error.message) : 'Scene3D transport failed',
            retryable: false,
        }),
    });
}

function unwrapTransport(response) {
    if (!response || response.ok !== true) {
        const transportError = response && response.error ? response.error : {};
        return Object.freeze({
            ok: false,
            error: Object.freeze({
                code: String(transportError.code || 'SCENE3D_TRANSPORT_ERROR'),
                message: String(transportError.message || 'Scene3D transport failed'),
                retryable: false,
            }),
        });
    }
    return response.result;
}

function register({
    appImpl,
    env = process.env,
    ipcMainImpl = ipcMain,
    assertTrustedSenderImpl = assertTrustedSender,
    randomUUIDImpl = randomUUID,
    createClientImpl = createScene3DSidecarClient,
    resolveConfigImpl = resolveScene3DPilotConfig,
    diagnostic = (message) => console.error('[ORBI Scene3D]', message),
} = {}) {
    if (!appImpl || typeof appImpl.getPath !== 'function') {
        throw new TypeError('Electron app implementation is required');
    }

    const config = resolveConfigImpl({
        env,
        userDataPath: appImpl.getPath('userData'),
        platform: process.platform,
    });

    let client = null;

    function getClient() {
        if (!config.enabled) return null;
        if (!client) {
            client = createClientImpl({
                config,
                randomUUIDImpl,
                onDiagnostic: diagnostic,
            });
        }
        return client;
    }

    function withTrust(handler) {
        return async (event, ...args) => {
            assertTrustedSenderImpl(event);
            try {
                return await handler(...args);
            } catch (error) {
                return sanitizeTransportError(error);
            }
        };
    }

    for (const channel of Object.values(CHANNELS)) {
        ipcMainImpl.removeHandler(channel);
    }

    ipcMainImpl.handle(CHANNELS.status, withTrust(async () => {
        return Object.freeze({
            ok: true,
            status: Object.freeze({
                ...publicScene3DConfig(config),
                processStarted: Boolean(client && client.isStarted()),
                recipes: ALLOWED_RECIPES,
            }),
        });
    }));

    ipcMainImpl.handle(CHANNELS.sceneInfo, withTrust(async () => {
        const sidecar = getClient();
        if (!sidecar) return disabled();

        const response = await sidecar.request(
            'scene_info',
            {},
            { requestId: randomUUIDImpl() },
        );
        return unwrapTransport(response);
    }));

    ipcMainImpl.handle(CHANNELS.objectInfo, withTrust(async (objectName) => {
        const sidecar = getClient();
        if (!sidecar) return disabled();

        let name;
        try {
            name = validateObjectName(objectName);
        } catch (error) {
            return invalid(error.message);
        }

        const response = await sidecar.request(
            'object_info',
            { object_name: name },
            { requestId: randomUUIDImpl() },
        );
        return unwrapTransport(response);
    }));

    ipcMainImpl.handle(CHANNELS.dryRunRecipe, withTrust(async (value) => {
        const sidecar = getClient();
        if (!sidecar) return disabled();

        let request;
        try {
            request = validateRecipeRequest(value, { execution: false });
        } catch (error) {
            return invalid(error.message);
        }

        const response = await sidecar.request(
            'dry_run_recipe',
            {
                recipe_id: request.recipeId,
                parameters: request.parameters,
            },
            { requestId: randomUUIDImpl() },
        );
        return unwrapTransport(response);
    }));

    ipcMainImpl.handle(CHANNELS.executeRecipe, withTrust(async (value) => {
        const sidecar = getClient();
        if (!sidecar) return disabled();

        let request;
        try {
            request = validateRecipeRequest(value, { execution: true });
        } catch (error) {
            return invalid(error.message);
        }

        const response = await sidecar.request(
            'execute_recipe',
            {
                recipe_id: request.recipeId,
                parameters: request.parameters,
            },
            { requestId: randomUUIDImpl() },
        );
        return unwrapTransport(response);
    }));

    ipcMainImpl.handle(CHANNELS.pendingRecoveries, withTrust(async () => {
        const sidecar = getClient();
        if (!sidecar) return disabled();

        return unwrapTransport(await sidecar.request('pending_recoveries', {}));
    }));

    ipcMainImpl.handle(CHANNELS.reconciliationHistory, withTrust(async (requestId) => {
        const sidecar = getClient();
        if (!sidecar) return disabled();

        let value;
        try {
            value = validateHistoryRequestId(requestId);
        } catch (error) {
            return invalid(error.message);
        }
        const input = value === null ? {} : { request_id: value };

        return unwrapTransport(await sidecar.request('reconciliation_history', input));
    }));

    return Object.freeze({
        enabled: config.enabled,
        mode: config.mode,
        channels: CHANNELS,
        shutdown: () => {
            if (client) client.close();
        },
        executionAuthority: 'scene3d-pilot-only',
        computeRouterAuthorityChanged: false,
        mhsActuationEnabled: false,
        productionCutoverAuthorized: false,
    });
}

module.exports = {
    CHANNELS,
    register,
};
