'use strict';

const BACKEND_DEVICE_PATTERNS = Object.freeze({
    cpu: /^cpu\d*$/i,
    cuda12: /^cuda\d+$/i,
    vulkan: /^vulkan\d+$/i,
    rocm: /^(?:rocm|hip)\d+$/i,
    metal: /^metal\d*$/i,
});

function parseDeviceList(stdout) {
    return String(stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [name, ...descriptionParts] = line.split('\t');
            return Object.freeze({
                name: String(name || '').trim(),
                description: descriptionParts.join('\t').trim(),
            });
        })
        .filter((device) => device.name);
}

function evaluateBackendActivation({ backend, stdout, exitCode = 0 } = {}) {
    const pattern = BACKEND_DEVICE_PATTERNS[backend];

    if (!pattern) {
        return Object.freeze({
            verified: false,
            reason: 'BACKEND_ACTIVATION_UNSUPPORTED',
            backend: backend || null,
            devices: Object.freeze([]),
        });
    }

    if (exitCode !== 0) {
        return Object.freeze({
            verified: false,
            reason: 'BACKEND_DEVICE_PROBE_FAILED',
            backend,
            devices: Object.freeze([]),
        });
    }

    const devices = parseDeviceList(stdout);
    const matchedDevice = devices.find((device) => pattern.test(device.name)) || null;

    return Object.freeze({
        verified: Boolean(matchedDevice),
        reason: matchedDevice ? null : 'EXPECTED_BACKEND_DEVICE_NOT_FOUND',
        backend,
        selectedDeviceName: matchedDevice?.name || null,
        devices: Object.freeze(devices),
    });
}

function resolveGenerationBackendArgs({ runtime, activation } = {}) {
    if (!runtime || runtime.requested === 'auto') {
        return Object.freeze([]);
    }

    if (
        activation?.verified !== true
        || typeof activation.selectedDeviceName !== 'string'
        || !activation.selectedDeviceName
    ) {
        throw new Error(
            `Explicit backend "${runtime.backend || runtime.requested || 'unknown'}" is not active in the pinned sd.cpp runtime.`
        );
    }

    const pattern = BACKEND_DEVICE_PATTERNS[runtime.backend];
    if (!pattern || !pattern.test(activation.selectedDeviceName)) {
        throw new Error(
            `Explicit backend "${runtime.backend || runtime.requested || 'unknown'}" resolved to an invalid device.`
        );
    }

    return Object.freeze(['--backend', activation.selectedDeviceName]);
}

function probeRuntimeBackend({
    binaryPath,
    backend,
    env = process.env,
    execFileImpl,
    timeoutMs = 15_000,
} = {}) {
    if (typeof binaryPath !== 'string' || !binaryPath) {
        return Promise.resolve(Object.freeze({
            verified: false,
            reason: 'BACKEND_BINARY_PATH_MISSING',
            backend: backend || null,
            devices: Object.freeze([]),
        }));
    }
    if (typeof execFileImpl !== 'function') {
        throw new TypeError('execFileImpl is required');
    }

    return new Promise((resolve) => {
        execFileImpl(
            binaryPath,
            ['--list-devices'],
            {
                env,
                timeout: timeoutMs,
                windowsHide: true,
                maxBuffer: 1024 * 1024,
            },
            (error, stdout) => {
                if (error) {
                    resolve(Object.freeze({
                        verified: false,
                        reason: 'BACKEND_DEVICE_PROBE_FAILED',
                        backend: backend || null,
                        devices: Object.freeze([]),
                    }));
                    return;
                }

                resolve(evaluateBackendActivation({
                    backend,
                    stdout,
                    exitCode: 0,
                }));
            },
        );
    });
}

module.exports = {
    BACKEND_DEVICE_PATTERNS,
    evaluateBackendActivation,
    parseDeviceList,
    probeRuntimeBackend,
    resolveGenerationBackendArgs,
};
