const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { sanitizeSdCppEvidence } = require('../electron/lib/providerReadinessSnapshotCore');

test('P1C54 probes backend only after installation integrity succeeds', () => {
    const source = fs.readFileSync('electron/lib/localInference.js', 'utf8');

    const integrityCheck = source.indexOf('installationIntegrity?.integrityVerified === true');
    const probeCall = source.indexOf('await probeRuntimeBackend({');

    assert.ok(integrityCheck >= 0);
    assert.ok(probeCall > integrityCheck);
    assert.ok(source.includes("reason: 'INSTALLATION_INTEGRITY_REQUIRED'"));
});

test('P1C54 readiness exports only backend activation boolean, not device identity', () => {
    const sanitized = sanitizeSdCppEvidence({
        binaryStatus: {
            exists: true,
            runtime: {
                backend: 'cuda12',
                manifestPinned: true,
                installationIntegrityVerified: true,
                backendActivationVerified: true,
                devices: [
                    { name: 'CUDA0', description: 'SECRET GPU MODEL' },
                ],
            },
        },
    });

    assert.equal(sanitized.binaryStatus.runtime.backendActivationVerified, true);
    assert.equal(JSON.stringify(sanitized).includes('SECRET GPU MODEL'), false);
    assert.equal(JSON.stringify(sanitized).includes('CUDA0'), false);
    assert.equal(Object.hasOwn(sanitized.binaryStatus.runtime, 'devices'), false);
});

test('P1C54 failed activation remains visible as false readiness', () => {
    const sanitized = sanitizeSdCppEvidence({
        binaryStatus: {
            exists: true,
            runtime: {
                backend: 'vulkan',
                manifestPinned: true,
                installationIntegrityVerified: true,
                backendActivationVerified: false,
            },
        },
    });

    assert.equal(sanitized.binaryStatus.runtime.backendActivationVerified, false);
});
