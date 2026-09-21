export const UPSTREAM_TRIAGE_KIND = Object.freeze({
    ORBI_CONFLICT: 'ORBI_CONFLICT',
    SECURITY: 'SECURITY',
    NEW_MODEL: 'NEW_MODEL',
    BUGFIX: 'BUGFIX',
    UI: 'UI',
    DOCUMENTATION: 'DOCUMENTATION',
    REVIEW: 'REVIEW',
});

export const UPSTREAM_TRIAGE_ACTION = Object.freeze({
    MANUAL_ADAPT: 'MANUAL_ADAPT',
    SECURITY_REVIEW: 'SECURITY_REVIEW',
    CANDIDATE_REVIEW: 'CANDIDATE_REVIEW',
    REVIEW_ONLY: 'REVIEW_ONLY',
});

const MODEL_PATH_PATTERNS = Object.freeze([
    /Models\.js$/i,
    /Parameters\.js$/i,
    /Registry\.js$/i,
    /modelCapabilities\.js$/i,
    /modelFamilies\.js$/i,
    /videoWorkflows\.js$/i,
    /videoToolCapabilities\.js$/i,
]);

const UI_PATH_PATTERNS = Object.freeze([
    /(^|\/)components\//,
    /(^|\/)app\/(?!api\/)/,
    /(?:Studio|Modal|Shell)\.(?:js|jsx|tsx?)$/i,
]);

const DOC_PATH_PATTERNS = Object.freeze([
    /(^|\/)README(?:\.[^/]+)?$/i,
    /(^|\/)docs\//,
    /\.md$/i,
]);

const SECURITY_PATH_PATTERNS = Object.freeze([
    /(^|\/)app\/api\//,
    /(^|\/)electron\//,
    /muapi/i,
    /credential/i,
    /secret/i,
    /upload/i,
    /auth/i,
    /security/i,
]);

const SECURITY_MESSAGE = /\b(?:security|xss|csrf|ssrf|cve|vulnerab|sanitize|credential|secret|auth)\b/i;
const BUGFIX_MESSAGE = /\b(?:fix|bug|regression|crash|broken|correct|repair|hotfix)\b/i;
const MODEL_MESSAGE = /\b(?:model|kling|veo|sora|seedance|minimax|flux|wan|z-image|sdxl|provider)\b/i;
const DOC_MESSAGE = /\b(?:docs?|readme|documentation)\b/i;

function messageSubject(message) {
    return typeof message === 'string' ? message.split('\n')[0].trim() : '';
}

export function classifyUpstreamFileTriage(file) {
    const path = typeof file?.path === 'string' ? file.path : '';
    const authority = typeof file?.classification === 'string' ? file.classification : 'REVIEW';

    if (authority === 'ORBI_OWNED') {
        return Object.freeze({
            kind: UPSTREAM_TRIAGE_KIND.ORBI_CONFLICT,
            action: UPSTREAM_TRIAGE_ACTION.MANUAL_ADAPT,
            reason: 'Path is under ORBI authority and cannot be replaced from upstream.',
        });
    }

    if (MODEL_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
        return Object.freeze({
            kind: UPSTREAM_TRIAGE_KIND.NEW_MODEL,
            action: authority === 'SECURITY_REVIEW'
                ? UPSTREAM_TRIAGE_ACTION.SECURITY_REVIEW
                : UPSTREAM_TRIAGE_ACTION.CANDIDATE_REVIEW,
            reason: 'Path belongs to model/provider capability metadata.',
        });
    }

    if (SECURITY_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
        return Object.freeze({
            kind: UPSTREAM_TRIAGE_KIND.SECURITY,
            action: UPSTREAM_TRIAGE_ACTION.SECURITY_REVIEW,
            reason: 'Path touches a trust boundary, API surface, credential, upload, or Electron runtime.',
        });
    }

    if (UI_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
        return Object.freeze({
            kind: UPSTREAM_TRIAGE_KIND.UI,
            action: authority === 'SECURITY_REVIEW'
                ? UPSTREAM_TRIAGE_ACTION.SECURITY_REVIEW
                : UPSTREAM_TRIAGE_ACTION.CANDIDATE_REVIEW,
            reason: 'Path changes a user-facing studio/application component.',
        });
    }

    if (DOC_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
        return Object.freeze({
            kind: UPSTREAM_TRIAGE_KIND.DOCUMENTATION,
            action: UPSTREAM_TRIAGE_ACTION.REVIEW_ONLY,
            reason: 'Path is documentation or static explanatory material.',
        });
    }

    return Object.freeze({
        kind: UPSTREAM_TRIAGE_KIND.REVIEW,
        action: UPSTREAM_TRIAGE_ACTION.REVIEW_ONLY,
        reason: 'No narrow semantic triage rule matched the changed path.',
    });
}

export function classifyUpstreamCommitTriage(commit) {
    const subject = messageSubject(commit?.message);

    let kind = UPSTREAM_TRIAGE_KIND.REVIEW;
    if (SECURITY_MESSAGE.test(subject)) kind = UPSTREAM_TRIAGE_KIND.SECURITY;
    else if (BUGFIX_MESSAGE.test(subject)) kind = UPSTREAM_TRIAGE_KIND.BUGFIX;
    else if (MODEL_MESSAGE.test(subject)) kind = UPSTREAM_TRIAGE_KIND.NEW_MODEL;
    else if (DOC_MESSAGE.test(subject)) kind = UPSTREAM_TRIAGE_KIND.DOCUMENTATION;

    return Object.freeze({
        sha: typeof commit?.sha === 'string' ? commit.sha : null,
        subject,
        date: typeof commit?.date === 'string' ? commit.date : null,
        kind,
    });
}

export function buildUpstreamTriageReport(driftReport, commits = []) {
    if (!driftReport || typeof driftReport !== 'object') {
        throw new TypeError('Drift report is required');
    }

    const files = (Array.isArray(driftReport.files) ? driftReport.files : []).map((file) => {
        const triage = classifyUpstreamFileTriage(file);
        return Object.freeze({
            ...file,
            triageKind: triage.kind,
            triageAction: triage.action,
            triageReason: triage.reason,
            automaticAdoptionAllowed: false,
        });
    });

    const commitTriage = (Array.isArray(commits) ? commits : [])
        .map(classifyUpstreamCommitTriage)
        .filter((commit) => commit.sha || commit.subject);

    const fileKinds = {};
    const actions = {};
    for (const file of files) {
        fileKinds[file.triageKind] = (fileKinds[file.triageKind] || 0) + 1;
        actions[file.triageAction] = (actions[file.triageAction] || 0) + 1;
    }

    const commitKinds = {};
    for (const commit of commitTriage) {
        commitKinds[commit.kind] = (commitKinds[commit.kind] || 0) + 1;
    }

    return Object.freeze({
        schemaVersion: 1,
        upstream: driftReport.upstream,
        observedAt: driftReport.observedAt,
        baselineSha: driftReport.baselineSha,
        headSha: driftReport.headSha,
        hasDrift: Boolean(driftReport.hasDrift),
        automaticAdoptionAllowed: false,
        fileKinds: Object.freeze(fileKinds),
        actions: Object.freeze(actions),
        commitKinds: Object.freeze(commitKinds),
        files: Object.freeze(files),
        commits: Object.freeze(commitTriage),
    });
}

export function formatUpstreamTriageMarkdown(report) {
    const lines = [
        '# ORBI Upstream Change Triage',
        '',
        `- Baseline: \`${report.baselineSha}\``,
        `- Upstream head: \`${report.headSha || 'unknown'}\``,
        `- Drift detected: **${report.hasDrift ? 'YES' : 'NO'}**`,
        '- Automatic adoption: **FORBIDDEN**',
        '',
        '## File triage',
        '',
    ];

    if (report.files.length === 0) {
        lines.push('- No changed paths to triage.');
    } else {
        for (const file of report.files) {
            lines.push(
                `- \`${file.triageKind}\` / \`${file.triageAction}\` — \`${file.path}\` — ${file.triageReason}`,
            );
        }
    }

    lines.push('', '## Commit triage', '');
    if (report.commits.length === 0) {
        lines.push('- No upstream commits beyond the reviewed baseline.');
    } else {
        for (const commit of report.commits) {
            lines.push(
                `- \`${commit.kind}\` — \`${commit.sha || 'unknown'}\` — ${commit.subject || '(no subject)'}`,
            );
        }
    }

    return `${lines.join('\n')}\n`;
}
