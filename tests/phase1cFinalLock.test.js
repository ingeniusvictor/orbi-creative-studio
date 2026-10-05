const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function workflowNames() {
    return fs.readdirSync('.github/workflows');
}

test('P1C70 master status closes Phase 1C and routes future work to Phase 2', () => {
    const status = read('ORBI-CREATIVE-STUDIO-MASTER-STATUS.md');
    const lock = read('src/lib/computeRouter/phase1cFinalLock.mjs');

    assert.ok(status.includes('P1C70 — Phase 1C Final Lock'));
    assert.ok(status.includes('There is no P1C71 continuation'));
    assert.ok(status.includes('Phase 2 — Creative Product Integration & ORBI UX'));
    assert.ok(status.includes('Do not create `P1C71`, `P1C72`'));

    assert.ok(lock.includes("finalMilestone: 'P1C70'"));
    assert.ok(lock.includes('closed: true'));
    assert.ok(lock.includes("'P1C71'"));
    assert.ok(lock.includes('productionProfilePromoted: false'));
    assert.ok(lock.includes('routingEligible: false'));
    assert.ok(lock.includes('cutoverAuthorized: false'));
    assert.ok(lock.includes("executionAuthority: 'legacy-dispatcher-only'"));
});

test('P1C70 blocks accidental new Phase 1C milestone workflows beyond P1C70', () => {
    const forbidden = workflowNames().filter((name) => /p1c(?:7[1-9]|[89][0-9]|[1-9][0-9]{2,})/i.test(name));
    assert.deepEqual(forbidden, []);
});

test('P1C70 closeout files remain present as the governed boundary', () => {
    for (const file of [
        'electron/lib/hardwarePilotReviewCore.js',
        'electron/lib/hardwarePilotReviewBridge.js',
        'src/lib/computeRouter/phase1cFinalLock.mjs',
        'ORBI-CREATIVE-STUDIO-MASTER-STATUS.md',
    ]) {
        assert.equal(fs.existsSync(path.resolve(file)), true, `missing closeout file: ${file}`);
    }
});
