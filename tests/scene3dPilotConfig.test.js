const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    parseEnabled,
    publicScene3DConfig,
    resolveScene3DPilotConfig,
} = require('../electron/lib/scene3dPilotConfig');

test('QB-16 feature flag is disabled by default', () => {
    const config = resolveScene3DPilotConfig({ env: {} });
    assert.equal(config.enabled, false);
    assert.equal(config.mode, 'disabled');
    assert.equal(config.command, null);
    assert.deepEqual(config.args, []);
});

test('QB-16 feature flag recognizes only explicit truthy values', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', ' Yes ']) {
        assert.equal(parseEnabled(value), true);
    }
    for (const value of [undefined, '', '0', 'false', 'on', 'enabled']) {
        assert.equal(parseEnabled(value), false);
    }
});

test('QB-16 native mode resolves a main-owned ledger under userData', () => {
    const config = resolveScene3DPilotConfig({
        env: {
            ORBI_SCENE3D_PILOT_ENABLED: '1',
            ORBI_SCENE3D_LAUNCHER_MODE: 'native',
            ORBI_SCENE3D_SIDECAR_PATH: '/opt/orbi/qb15_scene3d_sidecar.py',
            ORBI_SCENE3D_PYTHON: '/opt/orbi/.venv/bin/python',
        },
        userDataPath: '/home/test/.config/orbi',
        platform: 'linux',
    });

    assert.equal(config.enabled, true);
    assert.equal(config.mode, 'native');
    assert.equal(config.command, '/opt/orbi/.venv/bin/python');
    assert.deepEqual(config.args, [
        '/opt/orbi/qb15_scene3d_sidecar.py',
        '--ledger',
        path.join('/home/test/.config/orbi', 'orbi-scene3d', 'execution-ledger.sqlite3'),
    ]);
    assert.equal(config.cwd, '/opt/orbi');
    assert.equal(config.executionEnabled, false);
});

test('QB-16 WSL mode launches wsl.exe without shell-owned command text', () => {
    const config = resolveScene3DPilotConfig({
        env: {
            ORBI_SCENE3D_PILOT_ENABLED: 'true',
            ORBI_SCENE3D_LAUNCHER_MODE: 'wsl',
            SystemRoot: 'C:\\Windows',
            ORBI_SCENE3D_WSL_DISTRO: 'Ubuntu-26.04',
            ORBI_SCENE3D_WSL_REPO: '/home/user/code/orbi-qwen-mm-plugins-lab',
            ORBI_SCENE3D_WSL_PYTHON: '/home/user/code/orbi-qwen-mm-plugins-lab/.venv/bin/python',
            ORBI_SCENE3D_WSL_LEDGER: '/home/user/.local/share/orbi/scene3d.sqlite3',
        },
        userDataPath: 'C:\\Users\\User\\AppData\\Roaming\\orbi',
        platform: 'win32',
    });

    assert.equal(config.enabled, true);
    assert.equal(config.mode, 'wsl');
    assert.equal(config.command, 'C:\\Windows\\System32\\wsl.exe');
    assert.deepEqual(config.args, [
        '--distribution',
        'Ubuntu-26.04',
        '--cd',
        '/home/user/code/orbi-qwen-mm-plugins-lab',
        '/home/user/code/orbi-qwen-mm-plugins-lab/.venv/bin/python',
        '/home/user/code/orbi-qwen-mm-plugins-lab/scripts/orbi/qb15_scene3d_sidecar.py',
        '--ledger',
        '/home/user/.local/share/orbi/scene3d.sqlite3',
    ]);
    assert.equal(config.cwd, null);
    assert.equal(config.executionEnabled, false);
});

test('QB-16 WSL mode is rejected outside Windows', () => {
    assert.throws(
        () => resolveScene3DPilotConfig({
            env: {
                ORBI_SCENE3D_PILOT_ENABLED: '1',
                ORBI_SCENE3D_LAUNCHER_MODE: 'wsl',
            },
            userDataPath: '/tmp/app',
            platform: 'linux',
        }),
        /only from Windows/,
    );
});

test('QB-16 enabled native mode requires an absolute sidecar path', () => {
    assert.throws(
        () => resolveScene3DPilotConfig({
            env: {
                ORBI_SCENE3D_PILOT_ENABLED: '1',
                ORBI_SCENE3D_SIDECAR_PATH: 'relative/sidecar.py',
            },
            userDataPath: '/tmp/app',
            platform: 'linux',
        }),
        /absolute path/,
    );
});

test('QB-16 public config never exposes command args or ledger paths', () => {
    const internal = {
        enabled: true,
        mode: 'wsl',
        command: 'wsl.exe',
        args: ['secret-ish-path'],
        cwd: null,
        ledgerPath: '/home/user/private.sqlite3',
    };
    const publicConfig = publicScene3DConfig(internal);

    assert.deepEqual(publicConfig, {
        enabled: true,
        mode: 'wsl',
        defaultOff: true,
        rendererCanConfigure: false,
        automaticR2Retry: false,
        reconciliationMutation: false,
        executionEnabled: false,
        executionDefaultOff: true,
    });
    assert.equal('command' in publicConfig, false);
    assert.equal('args' in publicConfig, false);
    assert.equal('ledgerPath' in publicConfig, false);
});


test('QB-16 enabled native mode requires an absolute Python executable', () => {
    assert.throws(
        () => resolveScene3DPilotConfig({
            env: {
                ORBI_SCENE3D_PILOT_ENABLED: '1',
                ORBI_SCENE3D_LAUNCHER_MODE: 'native',
                ORBI_SCENE3D_SIDECAR_PATH: '/opt/orbi/qb15_scene3d_sidecar.py',
                ORBI_SCENE3D_PYTHON: 'python',
            },
            userDataPath: '/tmp/app',
            platform: 'linux',
        }),
        /ORBI_SCENE3D_PYTHON must be an absolute path/,
    );
});


test('QB-16 WSL mode requires trusted absolute SystemRoot', () => {
    assert.throws(
        () => resolveScene3DPilotConfig({
            env: {
                ORBI_SCENE3D_PILOT_ENABLED: '1',
                ORBI_SCENE3D_LAUNCHER_MODE: 'wsl',
                ORBI_SCENE3D_WSL_REPO: '/home/user/code/orbi-qwen-mm-plugins-lab',
                ORBI_SCENE3D_WSL_PYTHON: '/home/user/code/orbi-qwen-mm-plugins-lab/.venv/bin/python',
                ORBI_SCENE3D_WSL_LEDGER: '/home/user/.local/share/orbi/scene3d.sqlite3',
            },
            userDataPath: 'C:\\Users\\User\\AppData\\Roaming\\orbi',
            platform: 'win32',
        }),
        /SystemRoot must be an absolute path/,
    );
});


test('QB-18 execution authority is OFF unless both pilot and execution flags are explicit', () => {
    const disabledPilot = resolveScene3DPilotConfig({
        env: {
            ORBI_SCENE3D_EXECUTION_ENABLED: '1',
        },
    });
    assert.equal(disabledPilot.enabled, false);
    assert.equal(disabledPilot.executionEnabled, false);

    const readOnlyPilot = resolveScene3DPilotConfig({
        env: {
            ORBI_SCENE3D_PILOT_ENABLED: '1',
            ORBI_SCENE3D_EXECUTION_ENABLED: '0',
            ORBI_SCENE3D_SIDECAR_PATH: '/opt/orbi/qb15_scene3d_sidecar.py',
            ORBI_SCENE3D_PYTHON: '/opt/orbi/.venv/bin/python',
        },
        userDataPath: '/tmp/orbi',
        platform: 'linux',
    });
    assert.equal(readOnlyPilot.enabled, true);
    assert.equal(readOnlyPilot.executionEnabled, false);

    const executionPilot = resolveScene3DPilotConfig({
        env: {
            ORBI_SCENE3D_PILOT_ENABLED: '1',
            ORBI_SCENE3D_EXECUTION_ENABLED: 'yes',
            ORBI_SCENE3D_SIDECAR_PATH: '/opt/orbi/qb15_scene3d_sidecar.py',
            ORBI_SCENE3D_PYTHON: '/opt/orbi/.venv/bin/python',
        },
        userDataPath: '/tmp/orbi',
        platform: 'linux',
    });
    assert.equal(executionPilot.enabled, true);
    assert.equal(executionPilot.executionEnabled, true);
});

test('QB-18 renderer cannot enable execution through public config mutation', () => {
    const publicConfig = publicScene3DConfig({
        enabled: true,
        mode: 'native',
        executionEnabled: false,
        command: '/private/python',
        args: ['/private/sidecar.py'],
        ledgerPath: '/private/ledger.sqlite3',
    });

    assert.equal(publicConfig.executionEnabled, false);
    assert.equal(publicConfig.executionDefaultOff, true);
    assert.equal('setExecutionEnabled' in publicConfig, false);
    assert.equal('executionEnv' in publicConfig, false);
});


test('QB-18 non-explicit execution flag values remain disabled', () => {
    for (const value of [undefined, '', '0', 'false', 'on', 'enabled', '2']) {
        const config = resolveScene3DPilotConfig({
            env: {
                ORBI_SCENE3D_PILOT_ENABLED: '1',
                ORBI_SCENE3D_EXECUTION_ENABLED: value,
                ORBI_SCENE3D_SIDECAR_PATH: '/opt/orbi/qb15_scene3d_sidecar.py',
                ORBI_SCENE3D_PYTHON: '/opt/orbi/.venv/bin/python',
            },
            userDataPath: '/tmp/orbi',
            platform: 'linux',
        });
        assert.equal(config.executionEnabled, false, String(value));
    }
});
