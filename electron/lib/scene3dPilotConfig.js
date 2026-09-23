'use strict';

const path = require('node:path');

const FEATURE_ENV = 'ORBI_SCENE3D_PILOT_ENABLED';
const MODE_ENV = 'ORBI_SCENE3D_LAUNCHER_MODE';

function parseEnabled(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function requireAbsolute(value, label, pathImpl = path) {
    const raw = String(value ?? '').trim();
    if (!raw || !pathImpl.isAbsolute(raw)) {
        throw new Error(`${label} must be an absolute path`);
    }
    return pathImpl.normalize(raw);
}

function resolveScene3DPilotConfig({
    env = process.env,
    userDataPath,
    pathImpl = path,
    platform = process.platform,
} = {}) {
    const enabled = parseEnabled(env[FEATURE_ENV]);

    if (!enabled) {
        return Object.freeze({
            enabled: false,
            mode: 'disabled',
            command: null,
            args: Object.freeze([]),
            cwd: null,
            ledgerPath: null,
        });
    }

    const mode = String(env[MODE_ENV] || 'native').trim().toLowerCase();

    if (mode === 'native') {
        const sidecarPath = requireAbsolute(
            env.ORBI_SCENE3D_SIDECAR_PATH,
            'ORBI_SCENE3D_SIDECAR_PATH',
            pathImpl,
        );
        const pythonExecutable = String(env.ORBI_SCENE3D_PYTHON || 'python').trim();
        if (!pythonExecutable) {
            throw new Error('ORBI_SCENE3D_PYTHON must not be empty');
        }

        const root = requireAbsolute(userDataPath, 'userDataPath', pathImpl);
        const ledgerPath = pathImpl.join(
            root,
            'orbi-scene3d',
            'execution-ledger.sqlite3',
        );

        return Object.freeze({
            enabled: true,
            mode: 'native',
            command: pythonExecutable,
            args: Object.freeze([
                sidecarPath,
                '--ledger',
                ledgerPath,
            ]),
            cwd: pathImpl.dirname(sidecarPath),
            ledgerPath,
        });
    }

    if (mode === 'wsl') {
        if (platform !== 'win32') {
            throw new Error('WSL Scene3D launcher is supported only from Windows');
        }

        const repoPath = requireAbsolute(
            env.ORBI_SCENE3D_WSL_REPO,
            'ORBI_SCENE3D_WSL_REPO',
            pathImpl.posix,
        );
        const pythonPath = requireAbsolute(
            env.ORBI_SCENE3D_WSL_PYTHON,
            'ORBI_SCENE3D_WSL_PYTHON',
            pathImpl.posix,
        );
        const ledgerPath = requireAbsolute(
            env.ORBI_SCENE3D_WSL_LEDGER,
            'ORBI_SCENE3D_WSL_LEDGER',
            pathImpl.posix,
        );
        const sidecarPath = pathImpl.posix.join(
            repoPath,
            'scripts/orbi/qb15_scene3d_sidecar.py',
        );

        const args = [];
        const distro = String(env.ORBI_SCENE3D_WSL_DISTRO || '').trim();
        if (distro) {
            args.push('--distribution', distro);
        }
        args.push(
            '--cd',
            repoPath,
            pythonPath,
            sidecarPath,
            '--ledger',
            ledgerPath,
        );

        return Object.freeze({
            enabled: true,
            mode: 'wsl',
            command: 'wsl.exe',
            args: Object.freeze(args),
            cwd: null,
            ledgerPath,
        });
    }

    throw new Error('ORBI_SCENE3D_LAUNCHER_MODE must be native or wsl');
}

function publicScene3DConfig(config) {
    return Object.freeze({
        enabled: Boolean(config && config.enabled),
        mode: config && config.enabled ? config.mode : 'disabled',
        defaultOff: true,
        rendererCanConfigure: false,
        automaticR2Retry: false,
        reconciliationMutation: false,
    });
}

module.exports = {
    FEATURE_ENV,
    MODE_ENV,
    parseEnabled,
    publicScene3DConfig,
    resolveScene3DPilotConfig,
};
