const crypto = require('crypto');
const fs = require('fs');

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function verifyFileSha256(filePath, expectedSha256) {
    const expected = String(expectedSha256 || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) {
        throw new Error('Expected SHA-256 must be a 64-character hexadecimal string');
    }

    const actual = await sha256File(filePath);
    return {
        ok: actual === expected,
        expected,
        actual,
    };
}

module.exports = {
    sha256File,
    verifyFileSha256,
};
