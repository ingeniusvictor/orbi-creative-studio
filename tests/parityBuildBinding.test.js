const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function modules() {
    const binding = await import('../src/lib/computeRouter/parityBuildBinding.mjs');
    const targets = await import('../src/lib/computeRouter/studioParityTargets.mjs');
    const adapters = await import('../src/lib/computeRouter/providerAdapters.mjs');
    return { ...binding, ...targets, ...adapters };
}

const SOURCE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function capabilityMap(m) {
    return new Map([
        ['sdcpp-device', m.SDCPP_CAPABILITIES],
        ['wan2gp-lan', m.WAN2GP_CAPABILITIES],
        ['muapi-cloud', m.MUAPI_CAPABILITIES],
    ]);
}

function validCertification(m) {
    const caps = capabilityMap(m);
    return {
        schemaVersion: 1,
        certified: true,
        reason: 'PARITY_CERTIFIED',
        maxEvidenceAgeMs: 7 * 24 * 60 * 60 * 1000,
        maxFutureSkewMs: 60 * 1000,
        routes: m.STUDIO_PARITY_TARGETS.map((target) => {
            const capability = caps.get(target.expectedProviderId)
                .find((item) => item.operations.includes(target.operation));
            assert.ok(capability, `fixture capability missing for ${target.routeKey}`);
            return {
                routeKey: target.routeKey,
                expectedProviderId: target.expectedProviderId,
                operation: target.operation,
                minSamples: target.minSamples,
                minDistinctModels: target.minDistinctModels,
                samples: target.minSamples,
                matches: target.minSamples,
                blocked: 0,
                mismatches: 0,
                distinctModels: 1,
                modelIds: [capability.modelId],
                certified: true,
                reasons: [],
            };
        }),
    };
}

test('valid parity certification binds to exact source commit without cutover authority', async () => {
    const m = await modules();
    const certification = validCertification(m);
    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-1',
        boundAt: 1000,
        certification,
    });

    assert.equal(binding.bindingValid, true);
    assert.equal(binding.status, 'PARITY_CERTIFICATION_BOUND');
    assert.equal(binding.sourceCommit, SOURCE);
    assert.equal(binding.profileId, 'studio-image-video-v1');
    assert.equal(binding.cutoverAuthorized, false);
    assert.equal(binding.executionAuthority, 'legacy-dispatcher-only');
    assert.deepEqual(binding.reasons, []);

    const extracted = m.extractBoundCertification(binding, SOURCE);
    assert.equal(extracted.certified, true);
    assert.equal(extracted.routes.length, 9);
});

test('binding snapshots certification so later source mutation does not alter bound evidence', async () => {
    const m = await modules();
    const certification = validCertification(m);
    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-2',
        boundAt: 1000,
        certification,
    });

    certification.routes[0].samples = 0;
    certification.routes[0].matches = 0;
    certification.certified = false;

    assert.equal(binding.certification.certified, true);
    assert.equal(binding.certification.routes[0].samples, 10);
    assert.equal(binding.bindingValid, true);
});

test('weakened or incomplete certification is bound as rejected rather than silently accepted', async () => {
    const m = await modules();
    const certification = validCertification(m);
    certification.maxEvidenceAgeMs = 8 * 24 * 60 * 60 * 1000;
    certification.routes.pop();

    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-rejected',
        boundAt: 1000,
        certification,
    });

    assert.equal(binding.bindingValid, false);
    assert.equal(binding.status, 'PARITY_CERTIFICATION_REJECTED');
    assert.ok(binding.reasons.includes('certification-evidence-age-weakened'));
    assert.ok(binding.reasons.includes('certification-profile-mismatch'));
    assert.throws(
        () => m.extractBoundCertification(binding, SOURCE),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );
});

test('binding rejects malformed commit profile or binding identity', async () => {
    const m = await modules();
    const certification = validCertification(m);

    assert.throws(
        () => m.bindParityCertificationToBuild({
            sourceCommit: 'short-sha',
            bindingId: 'x',
            boundAt: 1000,
            certification,
        }),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );

    assert.throws(
        () => m.bindParityCertificationToBuild({
            sourceCommit: SOURCE,
            bindingId: '',
            boundAt: 1000,
            certification,
        }),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );

    assert.throws(
        () => m.bindParityCertificationToBuild({
            sourceCommit: SOURCE,
            bindingId: 'x',
            boundAt: 1000,
            profileId: 'other-profile',
            certification,
        }),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );
});

test('extract requires the expected release commit to match exactly', async () => {
    const m = await modules();
    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-3',
        boundAt: 1000,
        certification: validCertification(m),
    });

    assert.throws(
        () => m.extractBoundCertification(binding, OTHER),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );
});

test('extract recomputes integrity instead of trusting a forged bindingValid flag', async () => {
    const m = await modules();
    const valid = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-4',
        boundAt: 1000,
        certification: validCertification(m),
    });

    const tamperedCertification = {
        ...valid.certification,
        certified: true,
        reason: 'PARITY_CERTIFIED',
        routes: valid.certification.routes.map((route, index) => index === 0
            ? { ...route, mismatches: 1, matches: route.samples - 1, certified: true }
            : route),
    };
    const forged = {
        ...valid,
        bindingValid: true,
        certification: tamperedCertification,
    };

    assert.throws(
        () => m.extractBoundCertification(forged, SOURCE),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );
});

test('extract rejects any binding that tries to introduce cutover authority', async () => {
    const m = await modules();
    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-5',
        boundAt: 1000,
        certification: validCertification(m),
    });

    assert.throws(
        () => m.extractBoundCertification({ ...binding, cutoverAuthorized: true }, SOURCE),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );
    assert.throws(
        () => m.extractBoundCertification({ ...binding, executionAuthority: 'compute-router' }, SOURCE),
        (error) => error.code === 'INVALID_PARITY_BUILD_BINDING',
    );
});

test('parity build binding remains pure and isolated from Studio execution', () => {
    const source = fs.readFileSync('src/lib/computeRouter/parityBuildBinding.mjs', 'utf8');
    const image = fs.readFileSync('src/components/ImageStudio.js', 'utf8');
    const video = fs.readFileSync('src/components/VideoStudio.js', 'utf8');

    for (const token of [
        'fetch(',
        'ipcRenderer',
        'ipcMain',
        'localAI.generate',
        'muapi.generate',
        'routeGenerationRequest(',
        'localStorage',
        'sessionStorage',
        'window.',
        'globalThis.',
    ]) {
        assert.equal(source.includes(token), false, `unexpected binding side effect token: ${token}`);
    }

    assert.equal(image.includes('parityBuildBinding'), false);
    assert.equal(video.includes('parityBuildBinding'), false);
    assert.ok(source.includes("PARITY_BUILD_EXECUTION_AUTHORITY = 'legacy-dispatcher-only'"));
    assert.ok(source.includes('cutoverAuthorized: false'));
});

test('malformed route entries are rejected without crashing binding snapshot creation', async () => {
    const m = await modules();
    const certification = validCertification(m);
    certification.routes[0] = null;

    const binding = m.bindParityCertificationToBuild({
        sourceCommit: SOURCE,
        bindingId: 'parity-binding-malformed-route',
        boundAt: 1000,
        certification,
    });

    assert.equal(binding.bindingValid, false);
    assert.equal(binding.status, 'PARITY_CERTIFICATION_REJECTED');
    assert.ok(binding.reasons.includes('certification-profile-mismatch'));
    assert.equal(binding.certification.routes.length, 8);
});
