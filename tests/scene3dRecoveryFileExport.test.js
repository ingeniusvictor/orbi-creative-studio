const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    exportScene3DRecoveryEvidence,
} = require('../electron/lib/scene3dRecoveryFileExport');

function snapshot() {
    return {
        capturedAt: '2026-09-23T05:10:00.000Z',
        pending: [{
            sequence: 1,
            request_id: 'pending-1',
            request_fingerprint: 'f'.repeat(64),
            operation: 'execute_recipe',
            outcome: 'pending',
            provider_called: null,
            replay_reserved: true,
            provider: {
                family: 'qwen-mm-plugins',
                capability: 'blender',
                version: '1.1.0',
            },
        }],
        history: [],
    };
}

async function sha256File(file) {
    const bytes = await fs.promises.readFile(file);
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('QB-19 canceled save writes nothing and grants no authority', async () => {
    const result = await exportScene3DRecoveryEvidence(snapshot(), {
        dialogImpl: {
            showSaveDialog: async () => ({ canceled: true }),
        },
    });

    assert.deepEqual(result, {
        status: 'SCENE3D_RECOVERY_EXPORT_CANCELED',
        reason: null,
        fileName: null,
        sha256: null,
        bytes: 0,
        readOnlyEvidence: true,
        executionAuthorized: false,
        retryAuthorized: false,
        reconciliationAuthorized: false,
        requestIdReleaseAuthorized: false,
        productionCutoverAuthorized: false,
    });
});

test('QB-19 refuses an existing destination without modifying it', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qb19-existing-'));
    const destination = path.join(dir, 'recovery.json');
    fs.writeFileSync(destination, 'ORIGINAL', 'utf8');

    try {
        const result = await exportScene3DRecoveryEvidence(snapshot(), {
            dialogImpl: {
                showSaveDialog: async () => ({ canceled: false, filePath: destination }),
            },
        });

        assert.equal(result.status, 'SCENE3D_RECOVERY_EXPORT_REJECTED');
        assert.equal(result.reason, 'SCENE3D_RECOVERY_EXPORT_DESTINATION_EXISTS');
        assert.equal(fs.readFileSync(destination, 'utf8'), 'ORIGINAL');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('QB-19 writes a create-only hash-verified recovery file and returns basename only', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qb19-write-'));
    const destination = path.join(dir, 'recovery.json');

    try {
        const result = await exportScene3DRecoveryEvidence(snapshot(), {
            dialogImpl: {
                showSaveDialog: async () => ({ canceled: false, filePath: destination }),
            },
            sha256FileImpl: sha256File,
        });

        assert.equal(result.status, 'SCENE3D_RECOVERY_EXPORT_WRITTEN');
        assert.equal(result.fileName, 'recovery.json');
        assert.match(result.sha256, /^[a-f0-9]{64}$/);
        assert.ok(result.bytes > 0);
        assert.equal('filePath' in result, false);
        assert.equal(JSON.stringify(result).includes(dir), false);

        const written = fs.readFileSync(destination, 'utf8');
        assert.ok(written.endsWith('\n'));
        assert.equal(written.includes('qwen-mm-plugins'), false);
        assert.equal(written.includes('request_fingerprint'), false);
        assert.equal(written.includes('"provider":'), false);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('QB-19 hash mismatch removes the promoted destination', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qb19-hash-'));
    const destination = path.join(dir, 'recovery.json');

    try {
        const result = await exportScene3DRecoveryEvidence(snapshot(), {
            dialogImpl: {
                showSaveDialog: async () => ({ canceled: false, filePath: destination }),
            },
            sha256FileImpl: async () => '0'.repeat(64),
        });

        assert.equal(result.status, 'SCENE3D_RECOVERY_EXPORT_REJECTED');
        assert.equal(result.reason, 'SCENE3D_RECOVERY_EXPORT_HASH_MISMATCH');
        assert.equal(fs.existsSync(destination), false);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('QB-19 source is create-only atomic and renderer-path independent', () => {
    const source = fs.readFileSync('electron/lib/scene3dRecoveryFileExport.js', 'utf8');

    assert.ok(source.includes("flag: 'wx'"));
    assert.ok(source.includes('fsImpl.promises.link(tempPath, destination)'));
    assert.ok(source.includes('fsImpl.promises.unlink(tempPath)'));
    assert.ok(source.includes('sha256FileImpl(destination)'));
    assert.ok(source.includes('pathImpl.basename(destination)'));
    assert.ok(source.includes('showSaveDialog({'));

    assert.equal(source.includes('snapshot.filePath'), false);
    assert.equal(source.includes('snapshot.path'), false);
    assert.equal(source.includes('filePath: destination'), false);
    assert.equal(source.includes('promises.rename(tempPath, destination)'), false);
});
