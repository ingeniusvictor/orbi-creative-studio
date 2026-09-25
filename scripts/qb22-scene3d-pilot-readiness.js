#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const {
    createBlockedTemplate,
    evaluateScene3DPilotReadiness,
} = require('./lib/scene3dPilotReadinessEvidence');

function print(value, stream = process.stdout) {
    stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(argv = process.argv.slice(2), {
    readFileSync = fs.readFileSync,
    stdout = process.stdout,
    stderr = process.stderr,
} = {}) {
    if (argv.length === 1 && argv[0] === '--template') {
        print(createBlockedTemplate(), stdout);
        return 0;
    }

    if (argv.length !== 1) {
        print({
            ok: false,
            error: {
                code: 'SCENE3D_READINESS_USAGE',
                message: 'Usage: qb22-scene3d-pilot-readiness.js <evidence.json> | --template',
            },
        }, stderr);
        return 1;
    }

    try {
        const raw = readFileSync(argv[0], 'utf8');
        const evidence = JSON.parse(raw);
        const result = evaluateScene3DPilotReadiness(evidence);
        print(result, stdout);
        return result.complete ? 0 : 2;
    } catch (error) {
        print({
            ok: false,
            error: {
                code: 'SCENE3D_READINESS_EVIDENCE_INVALID',
                message: 'Scene3D readiness evidence could not be validated',
            },
        }, stderr);
        return 1;
    }
}

if (require.main === module) {
    process.exitCode = main();
}

module.exports = {
    main,
};
