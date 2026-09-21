#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUS = new Set(['success', 'warning', 'error']);
const ARTIFACT_TYPES = new Set(['file', 'commit', 'pull-request', 'workflow', 'artifact', 'url', 'other']);
const EVIDENCE_TYPES = new Set(['test', 'build', 'lint', 'security-scan', 'diff', 'workflow', 'human-approval', 'other']);
const EVIDENCE_OUTCOMES = new Set(['pass', 'fail', 'pending', 'observed']);
const AUTHORITY_DOMAINS = new Set([
  'runtime-certification',
  'compute-router',
  'cutover',
  'provider-secrets',
  'benchmark-evidence',
  'upstream-intake',
  'canonical-git',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function assertKnownKeys(object, allowed, pathName, errors) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      errors.push(`${pathName} contains unsupported key: ${key}`);
    }
  }
}

export function validateAgentObservation(input) {
  const errors = [];

  if (!isObject(input)) {
    return { valid: false, errors: ['observation must be an object'] };
  }

  assertKnownKeys(
    input,
    new Set(['schemaVersion', 'status', 'summary', 'nextActions', 'artifacts', 'evidence', 'authorityImpact', 'recovery']),
    'observation',
    errors,
  );

  if (input.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!STATUS.has(input.status)) errors.push('status must be success, warning, or error');
  if (!nonEmptyString(input.summary, 500)) errors.push('summary must be a non-empty string <= 500 characters');

  if (!Array.isArray(input.nextActions) || input.nextActions.length > 10) {
    errors.push('nextActions must be an array with at most 10 items');
  } else {
    input.nextActions.forEach((value, index) => {
      if (!nonEmptyString(value, 300)) errors.push(`nextActions[${index}] must be a non-empty string <= 300 characters`);
    });
  }

  if (!Array.isArray(input.artifacts) || input.artifacts.length > 20) {
    errors.push('artifacts must be an array with at most 20 items');
  } else {
    input.artifacts.forEach((artifact, index) => {
      if (!isObject(artifact)) {
        errors.push(`artifacts[${index}] must be an object`);
        return;
      }
      assertKnownKeys(artifact, new Set(['type', 'ref', 'note']), `artifacts[${index}]`, errors);
      if (!ARTIFACT_TYPES.has(artifact.type)) errors.push(`artifacts[${index}].type is unsupported`);
      if (!nonEmptyString(artifact.ref, 500)) errors.push(`artifacts[${index}].ref must be a non-empty string <= 500 characters`);
      if (artifact.note !== undefined && (typeof artifact.note !== 'string' || artifact.note.length > 500)) {
        errors.push(`artifacts[${index}].note must be a string <= 500 characters`);
      }
    });
  }

  if (!Array.isArray(input.evidence) || input.evidence.length > 30) {
    errors.push('evidence must be an array with at most 30 items');
  } else {
    input.evidence.forEach((entry, index) => {
      if (!isObject(entry)) {
        errors.push(`evidence[${index}] must be an object`);
        return;
      }
      assertKnownKeys(entry, new Set(['type', 'ref', 'outcome']), `evidence[${index}]`, errors);
      if (!EVIDENCE_TYPES.has(entry.type)) errors.push(`evidence[${index}].type is unsupported`);
      if (!nonEmptyString(entry.ref, 500)) errors.push(`evidence[${index}].ref must be a non-empty string <= 500 characters`);
      if (!EVIDENCE_OUTCOMES.has(entry.outcome)) errors.push(`evidence[${index}].outcome is unsupported`);
    });
  }

  if (!isObject(input.authorityImpact)) {
    errors.push('authorityImpact must be an object');
  } else {
    assertKnownKeys(input.authorityImpact, new Set(['affected', 'domains', 'note']), 'authorityImpact', errors);
    if (typeof input.authorityImpact.affected !== 'boolean') errors.push('authorityImpact.affected must be boolean');

    if (!Array.isArray(input.authorityImpact.domains)) {
      errors.push('authorityImpact.domains must be an array');
    } else {
      const unique = new Set(input.authorityImpact.domains);
      if (unique.size !== input.authorityImpact.domains.length) errors.push('authorityImpact.domains must be unique');
      input.authorityImpact.domains.forEach((domain) => {
        if (!AUTHORITY_DOMAINS.has(domain)) errors.push(`authorityImpact.domains contains unsupported domain: ${domain}`);
      });

      if (input.authorityImpact.affected === false && input.authorityImpact.domains.length !== 0) {
        errors.push('authorityImpact.domains must be empty when affected is false');
      }

      if (input.authorityImpact.affected === true && input.authorityImpact.domains.length === 0) {
        errors.push('authorityImpact.domains must name at least one domain when affected is true');
      }
    }

    if (typeof input.authorityImpact.note !== 'string' || input.authorityImpact.note.length > 1000) {
      errors.push('authorityImpact.note must be a string <= 1000 characters');
    }
  }

  if (input.status === 'error') {
    if (!isObject(input.recovery)) {
      errors.push('recovery is required when status is error');
    }
  }

  if (input.recovery !== undefined) {
    if (!isObject(input.recovery)) {
      errors.push('recovery must be an object');
    } else {
      assertKnownKeys(input.recovery, new Set(['rootCauseHint', 'safeRetry', 'stopCondition']), 'recovery', errors);
      if (!nonEmptyString(input.recovery.rootCauseHint, 1000)) errors.push('recovery.rootCauseHint must be non-empty <= 1000 characters');
      if (!nonEmptyString(input.recovery.safeRetry, 1000)) errors.push('recovery.safeRetry must be non-empty <= 1000 characters');
      if (!nonEmptyString(input.recovery.stopCondition, 1000)) errors.push('recovery.stopCondition must be non-empty <= 1000 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: node scripts/validate-agent-observation.mjs <observation.json>');
    process.exitCode = 2;
    return;
  }

  const absolutePath = path.resolve(process.cwd(), fileArg);
  const input = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  const result = validateAgentObservation(input);

  if (result.valid) {
    console.log('ORBI agent observation: VALID');
    return;
  }

  console.error('ORBI agent observation: INVALID');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
