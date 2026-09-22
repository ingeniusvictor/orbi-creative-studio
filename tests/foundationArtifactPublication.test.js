const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const workflow = fs.readFileSync('.github/workflows/orbi-foundation-certification.yml', 'utf8');

test('P1C65 uploads commit-bound Windows and macOS package artifacts', () => {
    assert.ok(workflow.includes('uses: actions/upload-artifact@v4'));
    assert.ok(workflow.includes('name: orbi-foundation-windows-${{ github.sha }}'));
    assert.ok(workflow.includes('name: orbi-foundation-macos-${{ github.sha }}'));
    assert.ok(workflow.includes('release/SHA256SUMS-windows.txt'));
    assert.ok(workflow.includes('release/SHA256SUMS-macos.txt'));
    assert.ok(workflow.includes('release/Open Generative AI Setup *.exe'));
    assert.ok(workflow.includes('release/Open Generative AI-2.0.0.dmg'));
    assert.ok(workflow.includes('release/Open Generative AI-2.0.0-arm64.dmg'));
});

test('P1C65 fails closed on missing package files and retains artifacts only temporarily', () => {
    assert.equal((workflow.match(/if-no-files-found: error/g) || []).length, 2);
    assert.equal((workflow.match(/retention-days: 14/g) || []).length, 2);
});

test('P1C65 creates checksum manifests before artifact upload', () => {
    const winManifest = workflow.indexOf('Write Windows checksum manifest');
    const winUpload = workflow.indexOf('Upload certified Windows pilot artifact');
    const macHashes = workflow.indexOf('Verify DMGs and hashes');
    const macUpload = workflow.indexOf('Upload certified macOS pilot artifacts');

    assert.ok(winManifest >= 0 && winUpload > winManifest);
    assert.ok(macHashes >= 0 && macUpload > macHashes);
    assert.ok(workflow.includes('Get-FileHash $installer.FullName -Algorithm SHA256'));
    assert.ok(workflow.includes('shasum -a 256'));
});

test('P1C65 preserves read-only repository permissions and never publishes a release', () => {
    assert.match(workflow, /permissions:\n\s+contents: read/);
    for (const forbidden of [
        'contents: write',
        'pull-requests: write',
        'releases: write',
        'gh release',
        'softprops/action-gh-release',
        'electron-builder --win --publish always',
        'electron-builder --mac --publish always',
    ]) {
        assert.equal(workflow.includes(forbidden), false, `unexpected publication authority: ${forbidden}`);
    }
});

test('P1C65 keeps existing Windows install smoke and macOS package verification', () => {
    assert.ok(workflow.includes('FOUNDATION_WINDOWS_INSTALL_UNINSTALL_PASS'));
    assert.ok(workflow.includes('FOUNDATION_WINDOWS_DESKTOP_PASS'));
    assert.ok(workflow.includes('FOUNDATION_MACOS_PACKAGE_PASS'));
    assert.ok(workflow.includes('Package Windows installer'));
    assert.ok(workflow.includes('Package macOS x64 and arm64'));
});
