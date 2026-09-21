const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('P7 context budget distinguishes persistent instructions from discoverable skills', async () => {
    const audit = await import('../scripts/ecc-context-budget.mjs');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orbi-context-budget-'));

    try {
        await fs.mkdir(path.join(root, '.agents', 'skills', 'demo-skill'), { recursive: true });
        await fs.mkdir(path.join(root, '.orbi'), { recursive: true });

        await fs.writeFile(path.join(root, 'AGENTS.md'), '# Instructions\nAlways verify evidence.\n');
        await fs.writeFile(
            path.join(root, '.agents', 'skills', 'demo-skill', 'SKILL.md'),
            '---\nname: demo-skill\n---\n# Demo\nUse only when needed.\n',
        );
        await fs.writeFile(path.join(root, '.orbi', 'ecc-profile.json'), '{"profile":"demo"}\n');

        const report = await audit.collectContextBudget(root);

        assert.equal(report.counts.alwaysInstructions, 1);
        assert.equal(report.counts.discoverableSkills, 1);
        assert.equal(report.counts.configReferences, 1);

        const agents = report.surfaces.find((surface) => surface.path === 'AGENTS.md');
        const skill = report.surfaces.find((surface) => surface.path.endsWith('/SKILL.md'));
        const config = report.surfaces.find((surface) => surface.path === '.orbi/ecc-profile.json');

        assert.equal(agents.kind, 'always-instructions');
        assert.equal(skill.kind, 'discoverable-skill');
        assert.equal(config.kind, 'config-reference');

        assert.equal(
            report.estimates.persistentInstructionTokens,
            agents.proseEstimateTokens,
            'skill/config tokens must not be counted as persistent instruction overhead',
        );
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('P7 context budget reports large surfaces without enforcing arbitrary token limits', async () => {
    const audit = await import('../scripts/ecc-context-budget.mjs');

    const instruction = Array.from({ length: 151 }, (_, index) => `instruction ${index}`).join('\n');
    const skill = Array.from({ length: 251 }, (_, index) => `skill line ${index}`).join('\n');

    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orbi-context-budget-flags-'));

    try {
        await fs.mkdir(path.join(root, '.agents', 'skills', 'heavy'), { recursive: true });
        await fs.writeFile(path.join(root, 'AGENTS.md'), instruction);
        await fs.writeFile(path.join(root, '.agents', 'skills', 'heavy', 'SKILL.md'), skill);

        const report = await audit.collectContextBudget(root);
        const agents = report.surfaces.find((surface) => surface.path === 'AGENTS.md');
        const heavy = report.surfaces.find((surface) => surface.path.includes('heavy'));

        assert.deepEqual(agents.flags, ['large-always-instruction']);
        assert.deepEqual(heavy.flags, ['large-skill']);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
