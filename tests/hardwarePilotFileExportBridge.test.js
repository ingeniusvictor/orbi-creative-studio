const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

test('P1C63 preload exposes export only inside the existing benchmark capability', () => {
    const preload = read('electron/preload.js');

    assert.equal((preload.match(/exposeInMainWorld\('orbiBenchmark'/g) || []).length, 1);
    assert.ok(preload.includes(
        "exportPilotBundle: (bundle) => ipcRenderer.invoke('compute-router:hardware-pilot-export', bundle)"
    ));
    assert.equal(preload.includes('exportPilotBundle: (bundle, path)'), false);
    assert.equal(preload.includes('exportPilotBundle: (path'), false);
});

test('P1C63 bridge authenticates sender and chooses destination in Electron main', () => {
    const bridge = read('electron/lib/hardwarePilotFileExportBridge.js');

    assert.ok(bridge.includes("const CHANNEL = 'compute-router:hardware-pilot-export'"));
    assert.ok(bridge.includes('ipcMain.handle(CHANNEL, async (event, bundle) =>'));
    assert.ok(bridge.includes('assertTrustedSender(event)'));
    assert.ok(bridge.includes('createHardwarePilotExportPlan(bundle)'));
    assert.ok(bridge.includes('dialogImpl.showSaveDialog({'));
    assert.ok(bridge.includes('defaultPath: plan.defaultFilename'));
    assert.equal(bridge.includes('bundle.filePath'), false);
    assert.equal(bridge.includes('bundle.path'), false);
});

test('P1C63 file promotion is create-only, atomic and hash-verified', () => {
    const bridge = read('electron/lib/hardwarePilotFileExportBridge.js');

    assert.ok(bridge.includes("HARDWARE_PILOT_EXPORT_DESTINATION_EXISTS"));
    assert.ok(bridge.includes("flag: 'wx'"));
    assert.ok(bridge.includes('fsImpl.promises.link(tempPath, destination)'));
    assert.ok(bridge.includes('fsImpl.promises.unlink(tempPath)'));
    assert.ok(bridge.includes('sha256FileImpl(destination)'));
    assert.ok(bridge.includes("HARDWARE_PILOT_EXPORT_HASH_MISMATCH"));
    assert.equal(bridge.includes('promises.rename(tempPath, destination)'), false);
});

test('P1C63 successful response never returns the full destination path', () => {
    const bridge = read('electron/lib/hardwarePilotFileExportBridge.js');

    assert.ok(bridge.includes('fileName: pathImpl.basename(destination)'));
    assert.equal(bridge.includes('filePath: destination'), false);
    assert.equal(bridge.includes('path: destination'), false);
    assert.ok(bridge.includes('sha256: actualSha256'));
});

test('P1C63 main registers export bridge without auto-exporting', () => {
    const main = read('electron/main.js');

    assert.ok(main.includes("require('./lib/hardwarePilotFileExportBridge')"));
    assert.ok(main.includes('registerHardwarePilotExport();'));
    assert.equal(main.includes('exportPilotBundle('), false);
    assert.equal(main.includes('showSaveDialog('), false);
});
