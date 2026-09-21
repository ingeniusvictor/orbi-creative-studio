import fs from 'node:fs/promises';
import path from 'node:path';
import {
    applyUpstreamBaselinePolicyDryRun,
    buildUpstreamBaselinePolicyUpdatePlan,
    formatUpstreamBaselinePolicyDryRunMarkdown,
    inspectUpstreamBaselinePolicySource,
} from '../src/lib/upstreamBaselinePolicyDryRun.mjs';

function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
        args[key] = value;
        index += 1;
    }
    return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.proposal) throw new Error('Missing --proposal <baseline-advance-proposal.json>');
const policyPath = args.policy || 'src/lib/upstreamDriftPolicy.mjs';
const outputDir = args['out-dir'] || 'artifacts/upstream-baseline-policy-dry-run';

const [proposalText, policySource] = await Promise.all([
    fs.readFile(args.proposal, 'utf8'),
    fs.readFile(policyPath, 'utf8'),
]);
const proposal = JSON.parse(proposalText);
const currentPolicy = inspectUpstreamBaselinePolicySource(policySource);
const plan = buildUpstreamBaselinePolicyUpdatePlan(proposal, currentPolicy);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(
    path.join(outputDir, 'baseline-policy-update-plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
    'utf8',
);

if (!plan.valid) {
    const markdown = formatUpstreamBaselinePolicyDryRunMarkdown(plan);
    await fs.writeFile(path.join(outputDir, 'baseline-policy-dry-run.md'), markdown, 'utf8');
    process.stdout.write(markdown);
    process.exitCode = 2;
} else {
    const result = applyUpstreamBaselinePolicyDryRun(policySource, plan);
    const markdown = formatUpstreamBaselinePolicyDryRunMarkdown(plan, result);

    await fs.writeFile(
        path.join(outputDir, 'upstreamDriftPolicy.preview.mjs'),
        result.previewSource,
        'utf8',
    );
    await fs.writeFile(
        path.join(outputDir, 'baseline-policy-dry-run.md'),
        markdown,
        'utf8',
    );
    process.stdout.write(markdown);
}
