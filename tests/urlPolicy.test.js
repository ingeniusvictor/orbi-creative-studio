const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isAllowedExternalUrl,
    isLocalWan2gpHost,
    normalizeWan2gpBaseUrl,
} = require('../electron/lib/urlPolicy');

test('external URL policy permits only ordinary HTTP(S) URLs without embedded credentials', () => {
    assert.equal(isAllowedExternalUrl('https://muapi.ai/access-keys'), true);
    assert.equal(isAllowedExternalUrl('http://192.168.1.20:7860/output'), true);
    assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
    assert.equal(isAllowedExternalUrl('file:///etc/passwd'), false);
    assert.equal(isAllowedExternalUrl('data:text/html,test'), false);
    assert.equal(isAllowedExternalUrl('https://user:secret@example.com/'), false);
});

test('Wan2GP local-host classification covers loopback and RFC1918 IPv4', () => {
    for (const host of ['localhost', 'gpu-box.local', '127.0.0.1', '10.1.2.3', '192.168.50.10', '172.16.0.2', '172.31.255.254', '::1']) {
        assert.equal(isLocalWan2gpHost(host), true, host);
    }
    for (const host of ['172.15.0.1', '172.32.0.1', '8.8.8.8', 'example.com']) {
        assert.equal(isLocalWan2gpHost(host), false, host);
    }
});

test('Wan2GP URL normalization allows HTTP on trusted local/LAN addresses', () => {
    assert.equal(normalizeWan2gpBaseUrl(' http://127.0.0.1:7860/ '), 'http://127.0.0.1:7860');
    assert.equal(normalizeWan2gpBaseUrl('http://192.168.1.20:7860/gradio/'), 'http://192.168.1.20:7860/gradio');
    assert.equal(normalizeWan2gpBaseUrl('http://gpu-box.local:7860/'), 'http://gpu-box.local:7860');
});

test('Wan2GP URL normalization permits public HTTPS and rejects public HTTP', () => {
    assert.equal(normalizeWan2gpBaseUrl('https://gpu.example.com:7860/'), 'https://gpu.example.com:7860');
    assert.throws(
        () => normalizeWan2gpBaseUrl('http://gpu.example.com:7860/'),
        /Public Wan2GP endpoints must use HTTPS/
    );
});

test('Wan2GP URL policy rejects dangerous schemes, credentials, query strings, fragments and link-local IPv4', () => {
    assert.throws(() => normalizeWan2gpBaseUrl('file:///tmp/server'), /http:\/\/ or https:\/\//);
    assert.throws(() => normalizeWan2gpBaseUrl('http://user:pass@127.0.0.1:7860'), /embedded credentials/);
    assert.throws(() => normalizeWan2gpBaseUrl('http://127.0.0.1:7860/?token=x'), /query string or fragment/);
    assert.throws(() => normalizeWan2gpBaseUrl('http://169.254.169.254/latest/meta-data'), /link-local/);
});
