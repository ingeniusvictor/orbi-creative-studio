'use strict';

const path = require('node:path');

const FEATURE_ENV = 'ORBI_SCENE3D_PILOT_ENABLED';
const EXECUTION_ENV = 'ORBI_SCENE3D_EXECUTION_ENABLED';
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
    const executionEnabled = enabled && parseEnabled(env[EXECUTION_ENV]);

    if (!enabled) {
        return Object.freeze({
            enabled: false,
            mode: 'disabled',
            command: null,
            args: Object.freeze([]),
            cwd: null,
            ledgerPath: null,
            executionEnabled: false,
        });
    }

    const mode = String(env[MODE_ENV] || 'native').trim().toLowerCase();

    if (mode === 'native') {
        const nativePathImpl = platform === 'win32'
            ? pathImpl.win32
            : pathImpl.posix;

        const sidecarPath = requireAbsolute(
            env.ORBI_SCENE3D_SIDECAR_PATH,
            'ORBI_SCENE3D_SIDECAR_PATH',
            nativePathImpl,
        );
        const pythonExecutable = requireAbsolute(
            env.ORBI_SCENE3D_PYTHON,
            'ORBI_SCENE3D_PYTHON',
            nativePathImpl,
        );

        const root = requireAbsolute(userDataPath, 'userDataPath', nativePathImpl);
        const ledgerPath = nativePathImpl.join(
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
            cwd: nativePathImpl.dirname(sidecarPath),
            ledgerPath,
            executionEnabled,
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

        const systemRoot = requireAbsolute(
            env.SystemRoot || env.WINDIR,
            'SystemRoot',
            pathImpl.win32,
        );
        const wslExecutable = pathImpl.win32.join(
            systemRoot,
            'System32',
            'wsl.exe',
        );

        return Object.freeze({
            enabled: true,
            mode: 'wsl',
            command: wslExecutable,
            args: Object.freeze(args),
            cwd: null,
            ledgerPath,
            executionEnabled,
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
        executionEnabled: Boolean(config && config.executionEnabled),
        executionDefaultOff: true,
    });
}

module.exports = {
    FEATURE_ENV,
    EXECUTION_ENV,
    MODE_ENV,
    parseEnabled,
    publicScene3DConfig,
    resolveScene3DPilotConfig,
};
