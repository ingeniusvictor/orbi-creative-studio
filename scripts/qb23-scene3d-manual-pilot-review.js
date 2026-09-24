#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const {
    validateManualPilotReview,
} = require('./lib/scene3dManualPilotReview');

function print(value, stream = process.stdout) {
    stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv = process.argv.slice(2), {
    readFileSync = fs.readFileSync,
    stdout = process.stdout,
    stderr = process.stderr,
} = {}) {
    if (argv.length !== 1) {
        print({
            ok: false,
            error: {
                code: 'SCENE3D_MANUAL_REVIEW_USAGE',
                message: 'Usage: qb23-scene3d-manual-pilot-review.js <review.json>',
            },
        }, stderr);
        return 1;
    }

    try {
        const raw = readFileSync(argv[0], 'utf8');
        const review = JSON.parse(raw);
        const result = validateManualPilotReview(review);
        print(result, stdout);
        return 0;
    } catch {
        print({
            ok: false,
            error: {
                code: 'SCENE3D_MANUAL_REVIEW_INVALID',
                message: 'Scene3D manual pilot review could not be validated',
            },
        }, stderr);
        return 1;
    }
}

if (require.main === module) {
    process.exitCode = main();
}

module.exports = { main };
