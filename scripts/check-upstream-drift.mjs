import fs from 'node:fs/promises';
import path from 'node:path';
import {
    OPEN_GENERATIVE_AI_UPSTREAM,
} from '../src/lib/upstreamDriftPolicy.mjs';
import {
    buildUpstreamDriftReport,
    formatUpstreamDriftMarkdown,
} from '../src/lib/upstreamDriftReport.mjs';

const apiBase = process.env.ORBI_UPSTREAM_API_BASE || 'https://api.github.com';
const outputDir = process.env.ORBI_UPSTREAM_DRIFT_DIR || 'artifacts/upstream-drift';
const { repository, branch, baselineSha } = OPEN_GENERATIVE_AI_UPSTREAM;

function headers() {
    const result = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'orbi-creative-studio-upstream-drift-scanner',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (process.env.GITHUB_TOKEN) {
        result.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return result;
}

async function fetchCompare() {
    const url = `${apiBase}/repos/${repository}/compare/${baselineSha}...${encodeURIComponent(branch)}`;
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `Upstream compare failed: HTTP ${response.status} ${response.statusText}: ${body.slice(0, 300)}`,
        );
    }
    return response.json();
}

async function writeOutputs(report, markdown) {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
        path.join(outputDir, 'open-generative-ai-drift.json'),
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8',
    );
    await fs.writeFile(
        path.join(outputDir, 'open-generative-ai-drift.md'),
        markdown,
        'utf8',
    );

    if (process.env.GITHUB_STEP_SUMMARY) {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
    }
}

const compare = await fetchCompare();
const report = buildUpstreamDriftReport(compare);
const markdown = formatUpstreamDriftMarkdown(report);
await writeOutputs(report, markdown);

process.stdout.write(markdown);
