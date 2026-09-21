import {
    OPEN_GENERATIVE_AI_UPSTREAM,
    classifyUpstreamPath,
    directUpstreamReplacementAllowed,
} from './upstreamDriftPolicy.mjs';

function finiteInteger(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeFile(file) {
    const path = typeof file?.filename === 'string' ? file.filename : '';
    return Object.freeze({
        path,
        status: typeof file?.status === 'string' ? file.status : 'unknown',
        additions: finiteInteger(file?.additions),
        deletions: finiteInteger(file?.deletions),
        changes: finiteInteger(file?.changes),
        classification: classifyUpstreamPath(path),
        directReplacementAllowed: directUpstreamReplacementAllowed(path),
    });
}

export function buildUpstreamDriftReport(compare, options = {}) {
    if (!compare || typeof compare !== 'object') {
        throw new TypeError('GitHub compare payload is required');
    }

    const files = Array.isArray(compare.files)
        ? compare.files.map(normalizeFile).filter((file) => file.path)
        : [];

    const classifications = {};
    for (const file of files) {
        classifications[file.classification] = (classifications[file.classification] || 0) + 1;
    }

    const compareHeadSha = typeof compare?.head_commit?.sha === 'string'
        ? compare.head_commit.sha
        : null;
    const baselineSha = OPEN_GENERATIVE_AI_UPSTREAM.baselineSha;
    const headSha = typeof options.headSha === 'string' && options.headSha
        ? options.headSha
        : (compareHeadSha || (compare.status === 'identical' ? baselineSha : null));
    const headDate = typeof options.headDate === 'string' && options.headDate
        ? options.headDate
        : null;
    const headMessage = typeof options.headMessage === 'string' && options.headMessage
        ? options.headMessage
        : null;
    const aheadBy = finiteInteger(compare.ahead_by);

    return Object.freeze({
        schemaVersion: 2,
        upstream: OPEN_GENERATIVE_AI_UPSTREAM,
        observedAt: options.observedAt || new Date().toISOString(),
        compareStatus: typeof compare.status === 'string' ? compare.status : 'unknown',
        baselineSha,
        headSha,
        headDate,
        headMessage,
        aheadBy,
        behindBy: finiteInteger(compare.behind_by),
        totalCommits: finiteInteger(compare.total_commits),
        changedFiles: files.length,
        hasDrift: Boolean(
            aheadBy > 0
            || files.length > 0
            || (headSha && headSha !== baselineSha)
        ),
        classifications: Object.freeze(classifications),
        files: Object.freeze(files),
        directReplacementAllowed: false,
    });
}

export function formatUpstreamDriftMarkdown(report) {
    const lines = [
        '# ORBI Upstream Drift Report',
        '',
        `- Upstream: \`${report.upstream.repository}\``,
        `- Tracked branch: \`${report.upstream.branch}\``,
        `- Baseline: \`${report.baselineSha}\``,
        `- Current upstream head: \`${report.headSha || 'unknown'}\``,
        `- Upstream head date: ${report.headDate || 'unknown'}`,
        `- Upstream head message: ${report.headMessage || 'unknown'}`,
        `- Compare status: \`${report.compareStatus}\``,
        `- Commits ahead: **${report.aheadBy}**`,
        `- Changed files: **${report.changedFiles}**`,
        `- Drift detected: **${report.hasDrift ? 'YES' : 'NO'}**`,
        '- Direct replacement: **FORBIDDEN**',
        '',
        '## Intake classes',
        '',
    ];

    const entries = Object.entries(report.classifications);
    if (entries.length === 0) {
        lines.push('- No changed paths.');
    } else {
        for (const [classification, count] of entries.sort(([a], [b]) => a.localeCompare(b))) {
            lines.push(`- \`${classification}\`: ${count}`);
        }
    }

    if (report.files.length > 0) {
        lines.push('', '## Changed paths', '');
        for (const file of report.files) {
            lines.push(
                `- \`${file.classification}\` — \`${file.path}\` (${file.status}, +${file.additions}/-${file.deletions})`,
            );
        }
    }

    return `${lines.join('\n')}\n`;
}
