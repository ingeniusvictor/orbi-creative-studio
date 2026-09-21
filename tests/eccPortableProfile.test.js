const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('P9 portable profile preserves selective-adoption safety boundaries', async () => {
    const file = path.join(process.cwd(), '.orbi', 'ecc-portable-profile.json');
    const profile = JSON.parse(await fs.readFile(file, 'utf8'));

    assert.equal(profile.schemaVersion, 1);
    assert.equal(profile.status, 'selective-reuse-ready');

    assert.equal(profile.adoptionPolicy.fullInstall, false);
    assert.equal(profile.adoptionPolicy.copyAllAgents, false);
    assert.equal(profile.adoptionPolicy.copyAllSkills, false);
    assert.equal(profile.adoptionPolicy.oneVariableAtATime, true);
    assert.equal(profile.adoptionPolicy.gitAndGovernedEvidenceRemainCanonical, true);

    assert.equal(profile.deferred.hooks, false);
    assert.equal(profile.deferred.mcp, false);
    assert.equal(profile.deferred.continuousLearningV2, false);
    assert.equal(profile.deferred.unifiedMemory, false);
    assert.equal(profile.deferred.autonomousLoops, false);
    assert.equal(profile.deferred.multiAgentRoles, false);

    const names = new Set(profile.portableComponents.map((component) => component.name));
    assert.ok(names.has('orbi-verification-loop'));
    assert.ok(names.has('orbi-security-review'));
    assert.ok(names.has('orbi-context-budget'));
    assert.ok(names.has('orbi-agent-harness'));
    assert.ok(names.has('agent-observation-contract'));

    const security = profile.portableComponents.find((component) => component.name === 'orbi-security-review');
    assert.equal(security.reuse, 'adapt-required');

    const agentShield = profile.portableComponents.find((component) => component.name === 'agentshield-report-only-pattern');
    assert.equal(agentShield.reuse, 'adapt-required');
});

test('P9 portable profile remains pinned to the reviewed ECC and AgentShield references', async () => {
    const profile = JSON.parse(
        await fs.readFile(path.join(process.cwd(), '.orbi', 'ecc-portable-profile.json'), 'utf8'),
    );

    assert.equal(profile.upstream.ecc.version, '2.2.2');
    assert.equal(profile.upstream.ecc.commit, '91ba9b4cf6c47c8130829004f8bb64762a76ccbb');

    assert.equal(profile.upstream.agentShield.version, '1.6.0');
    assert.equal(profile.upstream.agentShield.commit, 'b0891303bdcd6037376a94263d45cfd2ff3dfb98');
});
