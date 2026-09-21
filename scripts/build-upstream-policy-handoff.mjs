import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildUpstreamPolicyHandoffPackage,
  formatUpstreamPolicyHandoffMarkdown,
} from '../src/lib/upstreamPolicyHandoff.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
for (const key of ['proposal','plan','policy','preview']) {
  if (!args[key]) throw new Error(`Missing --${key}`);
}
const outDir = args['out-dir'] || 'artifacts/upstream-policy-handoff';
const [proposalText, planText, policySource, previewPolicySource] = await Promise.all([
  fs.readFile(args.proposal, 'utf8'),
  fs.readFile(args.plan, 'utf8'),
  fs.readFile(args.policy, 'utf8'),
  fs.readFile(args.preview, 'utf8'),
]);

const bundle = buildUpstreamPolicyHandoffPackage({
  proposal: JSON.parse(proposalText),
  plan: JSON.parse(planText),
  currentPolicySource: policySource,
  previewPolicySource,
});
const markdown = formatUpstreamPolicyHandoffMarkdown(bundle);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'upstream-policy-handoff.json'), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
await fs.writeFile(path.join(outDir, 'upstream-policy-handoff.md'), markdown, 'utf8');
process.stdout.write(markdown);
if (!bundle.valid) process.exitCode = 2;
