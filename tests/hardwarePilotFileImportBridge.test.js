const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

test('P1C65 preload exposes import without accepting a renderer path', () => {
    const preload = read('electron/preload.js');
    assert.ok(preload.includes(
        "importPilotBundle: () => ipcRenderer.invoke('compute-router:hardware-pilot-import')"
    ));
    assert.equal(preload.includes('importPilotBundle: (path)'), false);
    assert.equal(preload.includes('importPilotBundle: (filePath)'), false);
});

test('P1C65 bridge authenticates sender and selects the file in Electron main', () => {
    const bridge = read('electron/lib/hardwarePilotFileImportBridge.js');

    assert.ok(bridge.includes("const CHANNEL = 'compute-router:hardware-pilot-import'"));
    assert.ok(bridge.includes('ipcMain.handle(CHANNEL, async (event) =>'));
    assert.ok(bridge.includes('assertTrustedSender(event)'));
    assert.ok(bridge.includes('dialogImpl.showOpenDialog({'));
    assert.ok(bridge.includes("properties: ['openFile']"));
    assert.equal(bridge.includes('event, filePath'), false);
});

test('P1C65 enforces bounded input and returns only sanitized metadata', () => {
    const bridge = read('electron/lib/hardwarePilotFileImportBridge.js');

    assert.ok(bridge.includes('stat.size > MAX_IMPORT_BYTES'));
    assert.ok(bridge.includes('buildHardwarePilotImportIntake({'));
    assert.ok(bridge.includes('sanitizeHardwarePilotImportResult(intake)'));
    assert.ok(bridge.includes('importedBundles.set(intake.sha256'));
    assert.equal(bridge.includes('return intake.bundle'), false);
});

test('P1C65 main registers import bridge without auto-importing', () => {
    const main = read('electron/main.js');

    assert.ok(main.includes("require('./lib/hardwarePilotFileImportBridge')"));
    assert.ok(main.includes('registerHardwarePilotImport();'));
    assert.equal(main.includes('showOpenDialog('), false);
});
