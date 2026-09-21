import fs from 'node:fs/promises';
import path from 'node:path';
import {
    OPEN_GENERATIVE_AI_UPSTREAM,
} from '../src/lib/upstreamDriftPolicy.mjs';
import {
    buildUpstreamDriftReport,
    formatUpstreamDriftMarkdown,
} from '../src/lib/upstreamDriftReport.mjs';
import {
    buildUpstreamTriageReport,
    formatUpstreamTriageMarkdown,
} from '../src/lib/upstreamChangeTriage.mjs';

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

async function fetchHead() {
    const url = `${apiBase}/repos/${repository}/commits/${encodeURIComponent(branch)}`;
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `Upstream head lookup failed: HTTP ${response.status} ${response.statusText}: ${body.slice(0, 300)}`,
        );
    }
    const payload = await response.json();
    return {
        sha: typeof payload?.sha === 'string' ? payload.sha : null,
        date: payload?.commit?.author?.date || payload?.commit?.committer?.date || null,
        message: typeof payload?.commit?.message === 'string'
            ? payload.commit.message.split('\n')[0]
            : null,
    };
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

function normalizeCompareCommits(compare) {
    return (Array.isArray(compare?.commits) ? compare.commits : []).map((commit) => ({
        sha: typeof commit?.sha === 'string' ? commit.sha : null,
        message: typeof commit?.commit?.message === 'string' ? commit.commit.message : '',
        date: commit?.commit?.author?.date || commit?.commit?.committer?.date || null,
    }));
}

async function writeOutputs(report, markdown, triage, triageMarkdown) {
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
    await fs.writeFile(
        path.join(outputDir, 'open-generative-ai-triage.json'),
        `${JSON.stringify(triage, null, 2)}\n`,
        'utf8',
    );
    await fs.writeFile(
        path.join(outputDir, 'open-generative-ai-triage.md'),
        triageMarkdown,
        'utf8',
    );

    if (process.env.GITHUB_STEP_SUMMARY) {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n${triageMarkdown}`, 'utf8');
    }
}

const [head, compare] = await Promise.all([
    fetchHead(),
    fetchCompare(),
]);

if (!head.sha) {
    throw new Error('Upstream head lookup returned no commit SHA');
}

const report = buildUpstreamDriftReport(compare, {
    headSha: head.sha,
    headDate: head.date,
    headMessage: head.message,
});
const markdown = formatUpstreamDriftMarkdown(report);
const triage = buildUpstreamTriageReport(report, normalizeCompareCommits(compare));
const triageMarkdown = formatUpstreamTriageMarkdown(triage);
await writeOutputs(report, markdown, triage, triageMarkdown);

process.stdout.write(`${markdown}\n${triageMarkdown}`);
