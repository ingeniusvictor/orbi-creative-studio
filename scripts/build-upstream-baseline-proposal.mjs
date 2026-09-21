import fs from 'node:fs/promises';
import path from 'node:path';
import {
    evaluateUpstreamReviewDecisions,
} from '../src/lib/upstreamReviewDecisions.mjs';
import {
    buildUpstreamBaselineAdvanceProposal,
    formatUpstreamBaselineAdvanceProposalMarkdown,
    validateUpstreamBaselineAdvanceProposal,
} from '../src/lib/upstreamBaselineAdvanceProposal.mjs';

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const value = argv[i + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
        args[key] = value;
        i += 1;
    }
    return args;
}

async function readJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

const args = parseArgs(process.argv.slice(2));
for (const required of ['drift', 'manifest', 'decisions']) {
    if (!args[required]) {
        throw new Error(`Usage requires --drift, --manifest and --decisions (missing --${required})`);
    }
}

const outputDir = args['out-dir'] || 'artifacts/upstream-baseline-proposal';
const [driftReport, adoptionManifest, decisionSubmission] = await Promise.all([
    readJson(args.drift),
    readJson(args.manifest),
    readJson(args.decisions),
]);

const reviewResult = evaluateUpstreamReviewDecisions(adoptionManifest, decisionSubmission);
const proposal = buildUpstreamBaselineAdvanceProposal({
    driftReport,
    adoptionManifest,
    reviewResult,
});

if (proposal.valid) {
    const validation = validateUpstreamBaselineAdvanceProposal(proposal);
    if (!validation.valid) {
        throw new Error(`Generated baseline proposal is invalid: ${validation.errors.join('; ')}`);
    }
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(
    path.join(outputDir, 'baseline-advance-proposal.json'),
    `${JSON.stringify(proposal, null, 2)}\n`,
    'utf8',
);
await fs.writeFile(
    path.join(outputDir, 'baseline-advance-proposal.md'),
    formatUpstreamBaselineAdvanceProposalMarkdown(proposal),
    'utf8',
);

if (!proposal.valid) {
    process.exitCode = 2;
}

process.stdout.write(formatUpstreamBaselineAdvanceProposalMarkdown(proposal));
