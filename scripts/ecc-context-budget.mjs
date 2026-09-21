#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALWAYS_INSTRUCTION_PATHS = [
  'AGENTS.md',
  'CLAUDE.md',
  '.codex/AGENTS.md',
];

const CONFIG_REFERENCE_PATHS = [
  '.mcp.json',
  '.codex/config.toml',
  '.orbi/ecc-profile.json',
];

function normalizeRelative(value) {
  return value.split(path.sep).join('/');
}

export function estimateContent(content) {
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const words = (content.match(/\S+/g) || []).length;
  const chars = content.length;

  return {
    lines,
    words,
    chars,
    proseEstimateTokens: Math.round(words * 1.3),
    charEstimateTokens: Math.round(chars / 4),
  };
}

export function classifySurface(relativePath) {
  const normalized = normalizeRelative(relativePath);

  if (ALWAYS_INSTRUCTION_PATHS.includes(normalized)) {
    return 'always-instructions';
  }

  if (/^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(normalized)) {
    return 'discoverable-skill';
  }

  if (CONFIG_REFERENCE_PATHS.includes(normalized)) {
    return 'config-reference';
  }

  return 'other';
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function collectSkillPaths(rootDir) {
  const skillsRoot = path.join(rootDir, '.agents', 'skills');

  let entries;
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const paths = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relative = path.join('.agents', 'skills', entry.name, 'SKILL.md');
    if (await fileExists(path.join(rootDir, relative))) {
      paths.push(relative);
    }
  }

  return paths.sort((a, b) => a.localeCompare(b));
}

export async function collectContextBudget(rootDir = process.cwd()) {
  const candidatePaths = [...ALWAYS_INSTRUCTION_PATHS, ...CONFIG_REFERENCE_PATHS];
  candidatePaths.push(...await collectSkillPaths(rootDir));

  const uniquePaths = [...new Set(candidatePaths)];
  const surfaces = [];

  for (const relativePath of uniquePaths) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!await fileExists(absolutePath)) continue;

    const content = await fs.readFile(absolutePath, 'utf8');
    const stats = estimateContent(content);
    const kind = classifySurface(relativePath);

    surfaces.push({
      path: normalizeRelative(relativePath),
      kind,
      ...stats,
      flags: [
        ...(kind === 'always-instructions' && stats.lines > 150 ? ['large-always-instruction'] : []),
        ...(kind === 'discoverable-skill' && stats.lines > 250 ? ['large-skill'] : []),
      ],
    });
  }

  const byKind = (kind) => surfaces.filter((surface) => surface.kind === kind);
  const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);

  const always = byKind('always-instructions');
  const skills = byKind('discoverable-skill');
  const config = byKind('config-reference');

  return {
    schemaVersion: 1,
    model: 'orbi-context-budget-estimate',
    note: 'Only always-instructions are counted as persistent repository instruction overhead. Discoverable skills and config references are reported separately and are not assumed to be loaded.',
    counts: {
      alwaysInstructions: always.length,
      discoverableSkills: skills.length,
      configReferences: config.length,
    },
    estimates: {
      persistentInstructionTokens: sum(always, 'proseEstimateTokens'),
      discoverableSkillTokensIfFullyRead: sum(skills, 'proseEstimateTokens'),
      configReferenceTokensIfFullyRead: sum(config, 'proseEstimateTokens'),
    },
    surfaces,
  };
}

export function formatContextBudget(report) {
  const lines = [
    'ORBI CONTEXT BUDGET REPORT',
    '',
    `Always instructions: ${report.counts.alwaysInstructions}`,
    `Discoverable skills: ${report.counts.discoverableSkills}`,
    `Config references: ${report.counts.configReferences}`,
    '',
    `Estimated persistent instruction overhead: ~${report.estimates.persistentInstructionTokens} tokens`,
    `Discoverable skills if fully read: ~${report.estimates.discoverableSkillTokensIfFullyRead} tokens`,
    `Config references if fully read: ~${report.estimates.configReferenceTokensIfFullyRead} tokens`,
    '',
    'Surfaces:',
  ];

  for (const surface of report.surfaces) {
    const flags = surface.flags.length ? ` [${surface.flags.join(', ')}]` : '';
    lines.push(
      `- ${surface.path} :: ${surface.kind} :: ${surface.lines} lines :: ~${surface.proseEstimateTokens} tokens${flags}`,
    );
  }

  lines.push('');
  lines.push('Important: discoverable skills are not counted as persistent context merely because they exist.');

  return lines.join('\n');
}

async function main() {
  const rootDir = process.cwd();
  const report = await collectContextBudget(rootDir);

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatContextBudget(report)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
