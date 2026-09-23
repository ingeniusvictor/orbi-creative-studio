'use strict';

const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

const PROTOCOL = 'orbi.scene3d-sidecar/v1';
const MAX_REQUEST_BYTES = 262144;
const MAX_RESPONSE_BYTES = 1048576;
const DEFAULT_TIMEOUT_MS = 15000;

function createError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function createScene3DSidecarClient({
    config,
    spawnImpl = spawn,
    randomUUIDImpl = randomUUID,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onDiagnostic = () => {},
} = {}) {
    if (!config || config.enabled !== true) {
        throw createError('SCENE3D_PILOT_DISABLED', 'Scene3D pilot is disabled');
    }

    let child = null;
    let stdoutBuffer = '';
    const pending = new Map();

    function rejectAll(error) {
        for (const item of pending.values()) {
            clearTimeout(item.timer);
            item.reject(error);
        }
        pending.clear();
    }

    function handleLine(line) {
        if (!line.trim()) return;

        let response;
        try {
            response = JSON.parse(line);
        } catch {
            rejectAll(createError(
                'SCENE3D_SIDECAR_PROTOCOL_ERROR',
                'Scene3D sidecar emitted invalid JSON',
            ));
            if (child && !child.killed) child.kill();
            return;
        }

        if (response.protocol !== PROTOCOL) {
            const error = createError(
                'SCENE3D_SIDECAR_PROTOCOL_ERROR',
                'Scene3D sidecar protocol version mismatch',
            );
            rejectAll(error);
            if (child && !child.killed) child.kill();
            return;
        }

        const transportId = typeof response.id === 'string' ? response.id : '';
        const item = pending.get(transportId);
        if (!item) {
            onDiagnostic(`unmatched Scene3D sidecar response id: ${transportId}`);
            return;
        }

        pending.delete(transportId);
        clearTimeout(item.timer);
        item.resolve(response);
    }

    function onStdout(chunk) {
        stdoutBuffer += chunk.toString('utf8');
        if (Buffer.byteLength(stdoutBuffer, 'utf8') > MAX_RESPONSE_BYTES) {
            const error = createError(
                'SCENE3D_SIDECAR_RESPONSE_TOO_LARGE',
                'Scene3D sidecar response exceeded the bounded buffer',
            );
            rejectAll(error);
            if (child && !child.killed) child.kill();
            return;
        }

        while (true) {
            const index = stdoutBuffer.indexOf('\n');
            if (index < 0) break;
            const line = stdoutBuffer.slice(0, index);
            stdoutBuffer = stdoutBuffer.slice(index + 1);
            handleLine(line);
        }
    }

    function ensureStarted() {
        if (child) return child;

        child = spawnImpl(config.command, [...config.args], {
            cwd: config.cwd || undefined,
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        child.stdout.on('data', onStdout);
        child.stderr.on('data', (chunk) => {
            onDiagnostic(chunk.toString('utf8'));
        });
        child.on('error', (error) => {
            rejectAll(createError(
                'SCENE3D_SIDECAR_START_FAILED',
                error && error.message ? error.message : String(error),
            ));
        });
        child.on('exit', (code, signal) => {
            const error = createError(
                'SCENE3D_SIDECAR_EXITED',
                `Scene3D sidecar exited (code=${code}, signal=${signal || 'none'})`,
            );
            rejectAll(error);
            child = null;
            stdoutBuffer = '';
        });

        return child;
    }

    function request(operation, input = {}, { requestId = undefined } = {}) {
        const transportId = randomUUIDImpl();
        const message = {
            protocol: PROTOCOL,
            id: transportId,
            operation,
            input,
        };
        if (requestId !== undefined) {
            message.request_id = requestId;
        }

        const serialized = JSON.stringify(message);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BYTES) {
            return Promise.reject(createError(
                'SCENE3D_REQUEST_TOO_LARGE',
                'Scene3D request exceeds the bounded message size',
            ));
        }

        const proc = ensureStarted();

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(transportId);
                reject(createError(
                    'SCENE3D_SIDECAR_TIMEOUT',
                    `Scene3D sidecar request timed out after ${timeoutMs}ms`,
                ));
            }, timeoutMs);

            pending.set(transportId, { resolve, reject, timer });

            proc.stdin.write(`${serialized}\n`, 'utf8', (error) => {
                if (!error) return;
                const item = pending.get(transportId);
                if (!item) return;
                pending.delete(transportId);
                clearTimeout(item.timer);
                reject(createError(
                    'SCENE3D_SIDECAR_WRITE_FAILED',
                    error.message || String(error),
                ));
            });
        });
    }

    function close() {
        if (!child) return;
        try {
            child.stdin.end();
        } catch {
            // Best-effort graceful EOF shutdown.
        }
    }

    return Object.freeze({
        request,
        close,
        isStarted: () => child !== null,
        protocol: PROTOCOL,
        automaticRetry: false,
    });
}

module.exports = {
    DEFAULT_TIMEOUT_MS,
    MAX_REQUEST_BYTES,
    MAX_RESPONSE_BYTES,
    PROTOCOL,
    createScene3DSidecarClient,
};
