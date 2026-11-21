#!/usr/bin/env node

/**
 * Universal Security Standard (USS) - Reusable Consumer Workflow Validator
 *
 * Validates consumer CI workflow files (e.g. .github/workflows/consumer-security-scans.yml)
 * against mandatory structural security invariants, ensuring protections are not
 * weakened or removed by subsequent edits in consuming repositories.
 *
 * Usage:
 *   node tools/validate-consumer-workflow.mjs [--file <path-to-workflow>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_WORKFLOW_KEYS = new Set(['name', 'on', 'permissions', 'jobs', 'defaults', 'concurrency']);
const APPROVED_JOB_KEYS = {
  secrets: new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'steps']),
  gitleaks: new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'steps']),
  semgrep: new Set(['name', 'runs-on', 'timeout-minutes', 'container', 'permissions', 'steps']),
  codeql: new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'steps']),
  osv: new Set(['name', 'permissions', 'uses', 'with'])
};
const ALLOWED_STEP_KEYS = new Set(['name', 'uses', 'with', 'shell', 'run', 'env', 'id']);
const APPROVED_SHELLS = new Set([
  'bash',
  'bash --noprofile --norc -eo pipefail {0}',
  'bash --noprofile --norc -e -o pipefail {0}'
]);
const APPROVED_STEP_ENVS = {
  gitleaks: new Set(['GITHUB_TOKEN', 'GITLEAKS_ENABLE_COMMENTS', 'GITLEAKS_ENABLE_UPLOAD_ARTIFACT']),
  semgrep: new Set(['SEMGREP_SEND_METRICS'])
};
const UNTRUSTED_EXPRESSION_REGEX = /\$\{\{\s*(?:github(?:\s*\.\s*|\s*\[\s*['"])(?:event|head_ref|actor|ref_name|base_ref|ref|triggering_actor)\b|inputs(?:\s*\.\s*|\s*\[\s*['"]))/i;

export function parseArgs(argv) {
  let filePath = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && i + 1 < argv.length) {
      filePath = argv[++i];
    } else if (argv[i].startsWith('--file=')) {
      filePath = argv[i].slice('--file='.length);
    }
  }
  return { file: filePath };
}

export async function loadYamlParser() {
  try {
    const mod = await import('yaml');
    return mod.default || mod;
  } catch {
    try {
      const localYamlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/yaml/index.js');
      const mod = await import(localYamlPath);
      return mod.default || mod;
    } catch {
      throw new Error("The 'yaml' parser is required to validate workflows. Run 'npm ci --ignore-scripts' in USS root first.");
    }
  }
}

export function validateConsumerWorkflowStructure(parsed, label = 'consumer-security-scans.yml') {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${label}: workflow root must be an object`);
  }

  // 1. Workflow-level keys allowlist
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_WORKFLOW_KEYS.has(key)) {
      throw new Error(`${label}: unapproved workflow-level key '${key}'`);
    }
  }

  // 2. Workflow-level permissions
  if (!parsed.permissions) {
    throw new Error(`${label}: must declare workflow-level permissions`);
  }
  if (typeof parsed.permissions === 'string') {
    if (parsed.permissions !== 'read-all') {
      throw new Error(`${label}: string permissions must be 'read-all', got '${parsed.permissions}'`);
    }
  } else if (typeof parsed.permissions === 'object') {
    if (parsed.permissions.contents !== 'read') {
      throw new Error(`${label}: workflow-level permissions must be contents: read`);
    }
    for (const [scope, perm] of Object.entries(parsed.permissions)) {
      if (perm === 'write' || perm === 'write-all') {
        throw new Error(`${label}: workflow-level permissions must not grant write access to ${scope}`);
      }
    }
  } else {
    throw new Error(`${label}: invalid permissions type`);
  }

  // 3. Workflow triggers
  const rawTriggers = parsed.on ?? parsed['true'];
  if (!rawTriggers) {
    throw new Error(`${label}: must define trigger conditions`);
  }
  const triggers = typeof rawTriggers === 'object' && !Array.isArray(rawTriggers) ? rawTriggers : {};
  if (!triggers.push) throw new Error(`${label}: must define push trigger`);
  if (!triggers.pull_request) throw new Error(`${label}: must define pull_request trigger`);
  if (!triggers.schedule) throw new Error(`${label}: must define schedule trigger for periodic full-history scan`);
  if (!Array.isArray(triggers.schedule) || triggers.schedule.length === 0) {
    throw new Error(`${label}: schedule must be a non-empty array`);
  }
  if (!triggers.schedule.some(s => s?.cron === '17 5 * * 1')) {
    throw new Error(`${label}: schedule must include weekly full-history scan cron "17 5 * * 1"`);
  }

  // 4. Defaults & Concurrency
  if (parsed.defaults) {
    if (parsed.defaults.run?.['working-directory']) {
      throw new Error(`${label}: defaults.run must not override working-directory`);
    }
    if (parsed.defaults.run?.shell) {
      if (!APPROVED_SHELLS.has(parsed.defaults.run.shell.trim())) {
        throw new Error(`${label}: unapproved shell in defaults: '${parsed.defaults.run.shell}'`);
      }
    }
  }
  if (parsed.concurrency) {
    if (parsed.concurrency['cancel-in-progress'] === true) {
      throw new Error(`${label}: must not enable concurrency cancel-in-progress: true`);
    }
  }

  // 5. Environment allowlist at workflow level: none allowed
  if (parsed.env && Object.keys(parsed.env).length > 0) {
    throw new Error(`${label}: workflow-level env is not permitted`);
  }

  // 6. Mandatory jobs
  const jobs = parsed.jobs || {};
  const secretJobId = jobs.secrets ? 'secrets' : (jobs.gitleaks ? 'gitleaks' : null);
  if (!secretJobId) throw new Error(`${label}: missing secret scan job ('secrets' or 'gitleaks')`);
  for (const req of [secretJobId, 'semgrep', 'codeql', 'osv']) {
    if (!jobs[req]) throw new Error(`${label}: missing required job '${req}'`);
  }

  // 7. Validate each job
  for (const [jobId, job] of Object.entries(jobs)) {
    const allowedKeys = APPROVED_JOB_KEYS[jobId];
    if (!allowedKeys) {
      throw new Error(`${label}: unapproved job '${jobId}'`);
    }
    for (const key of Object.keys(job)) {
      if (!allowedKeys.has(key)) {
        throw new Error(`${label}: job '${jobId}' contains unapproved key '${key}'`);
      }
    }

    if (job.if !== undefined) throw new Error(`${label}: mandatory job '${jobId}' must not be conditional`);
    if (job.needs !== undefined) throw new Error(`${label}: mandatory job '${jobId}' must not depend on other jobs`);
    if (job['continue-on-error']) throw new Error(`${label}: job '${jobId}' must not set continue-on-error: true`);
    if (job.env && Object.keys(job.env).length > 0) throw new Error(`${label}: job '${jobId}' env is not permitted`);

    if (jobId === 'osv') {
      if (!job.uses || !job.uses.startsWith('google/osv-scanner-action/')) {
        throw new Error(`${label}: osv job must use google/osv-scanner-action reusable workflow`);
      }
      const parts = job.uses.split('@');
      if (parts.length !== 2 || !/^[0-9a-f]{40}$/i.test(parts[1])) {
        throw new Error(`${label}: osv job must pin reusable workflow to a full 40-character commit SHA`);
      }
      if (job.with?.['fail-on-vuln'] !== true) {
        throw new Error(`${label}: osv job must set fail-on-vuln: true`);
      }
      continue;
    }

    if (job['runs-on'] !== 'ubuntu-latest') {
      throw new Error(`${label}: job '${jobId}' runs-on must be 'ubuntu-latest'`);
    }
    if (!Number.isInteger(job['timeout-minutes']) || job['timeout-minutes'] <= 0) {
      throw new Error(`${label}: job '${jobId}' must set positive timeout-minutes`);
    }

    if (jobId === 'semgrep') {
      if (!job.container?.image || !/^semgrep\/semgrep:[^@]+@sha256:[a-f0-9]{64}$/.test(job.container.image)) {
        throw new Error(`${label}: semgrep job must pin container image by immutable sha256 digest`);
      }
    }

    const steps = job.steps || [];
    if (steps.length === 0) throw new Error(`${label}: job '${jobId}' has no steps`);

    if (jobId === secretJobId || jobId === 'semgrep') {
      const guardStep = steps.find(s => s.name === 'Reject unreviewed scanner configuration');
      if (!guardStep) {
        throw new Error(`${label}: job '${jobId}' is missing required scanner configuration guard`);
      }
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      for (const k of Object.keys(step)) {
        if (!ALLOWED_STEP_KEYS.has(k)) {
          throw new Error(`${label}: job '${jobId}' step ${i} contains unapproved key '${k}'`);
        }
      }
      if (step.if !== undefined) throw new Error(`${label}: job '${jobId}' step ${i} must not be conditional`);
      if (step['continue-on-error']) throw new Error(`${label}: job '${jobId}' step ${i} must not set continue-on-error`);
      if (step['working-directory']) throw new Error(`${label}: job '${jobId}' step ${i} must not set working-directory`);

      if (step.shell && !APPROVED_SHELLS.has(step.shell.trim())) {
        throw new Error(`${label}: job '${jobId}' step ${i} specifies unapproved shell '${step.shell}'`);
      }

      if (step.uses) {
        const parts = step.uses.split('@');
        if (parts.length !== 2 || !/^[0-9a-f]{40}$/i.test(parts[1])) {
          throw new Error(`${label}: job '${jobId}' step ${i} unpinned action: '${step.uses}'`);
        }
        if (step.uses.startsWith('actions/checkout')) {
          if (step.with?.['persist-credentials'] !== false) {
            throw new Error(`${label}: checkout step must set persist-credentials: false`);
          }
        }
      }

      if (step.env) {
        let allowed = new Set();
        if (jobId === secretJobId && step.uses?.includes('gitleaks')) allowed = APPROVED_STEP_ENVS.gitleaks;
        else if (jobId === 'semgrep' && step.run?.includes('semgrep')) allowed = APPROVED_STEP_ENVS.semgrep;
        for (const [envKey, envVal] of Object.entries(step.env)) {
          if (!allowed.has(envKey)) {
            throw new Error(`${label}: job '${jobId}' step ${i} defines unapproved env '${envKey}'`);
          }
          if (typeof envVal === 'string' && UNTRUSTED_EXPRESSION_REGEX.test(envVal)) {
            throw new Error(`${label}: job '${jobId}' step ${i} env contains untrusted expression: ${envVal}`);
          }
        }
      }

      if (step.run) {
        if (UNTRUSTED_EXPRESSION_REGEX.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} contains untrusted expression interpolation`);
        }
        if (/(?:^|\s|;)export\s+/i.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} must not use export statements`);
        }
        if (/\b(?:BASH_ENV|PATH|NPM_CONFIG_[A-Z_]+|NODE_OPTIONS|NODE_PATH|NODE_TLS_REJECT_UNAUTHORIZED|GIT_CONFIG_[A-Z0-9_]+)\s*=/i.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} assigns to dangerous environment variable`);
        }
        if (/(?:^|[^&])&\s*(?:$|\n)/.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} must not background commands (&)`);
        }
        if (/(?:\||\&)\s*(?:cat|tee|true|exit\s+0|echo|printf|head|tail)\b/.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} masks failures with piping or command list`);
        }
        if (/\b(?:echo|printf|eval)\s+["']?\$\(/.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} masks failure inside echo/eval command substitution`);
        }
        if (/\bif\s+[^;\n]+;\s*then\s*:\s*;\s*fi\b/.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} masks failures with empty if-then block`);
        }
        if (/\b(?:git|npm|node|semgrep|gitleaks|find|grep|awk|diff)\s*\(\s*\)\s*\{/.test(step.run)) {
          throw new Error(`${label}: job '${jobId}' step ${i} attempts shell function shadowing`);
        }

        // Semgrep scan step checks
        if (step.run.includes('semgrep scan')) {
          if (!step.run.includes('--error')) throw new Error(`${label}: Semgrep must include --error`);
          if (!step.run.includes('--strict')) throw new Error(`${label}: Semgrep must include --strict`);
          if (!step.run.includes('--disable-nosem')) throw new Error(`${label}: Semgrep must include --disable-nosem`);
          if (step.run.includes('--exclude')) throw new Error(`${label}: Semgrep must not use --exclude`);
        }

        // Scanner configuration guard step checks
        if (step.name === 'Reject unreviewed scanner configuration') {
          if (!step.run.includes('historical_suppression')) {
            throw new Error(`${label}: scanner configuration guard must verify Git history for prohibited directives`);
          }
          if (!step.run.includes('nested_osv_config')) {
            throw new Error(`${label}: scanner configuration guard must detect nested OSV configs`);
          }
          if (!step.run.includes('attr_file')) {
            throw new Error(`${label}: scanner configuration guard must inspect .gitattributes`);
          }
          if (!step.run.includes('raw_binaries')) {
            throw new Error(`${label}: scanner configuration guard must detect binary files`);
          }
        }
      }
    }
  }

  return true;
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2));
  const targetFile = file || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../templates/ci/consumer-security-scans.yml');

  if (!fs.existsSync(targetFile)) {
    console.error(`Error: target workflow file not found: ${targetFile}`);
    process.exit(1);
  }

  const YAML = await loadYamlParser();
  const rawText = fs.readFileSync(targetFile, 'utf8');
  let parsed;
  try {
    parsed = YAML.parse(rawText);
  } catch (err) {
    console.error(`Error parsing YAML from ${targetFile}: ${err.message}`);
    process.exit(1);
  }

  try {
    validateConsumerWorkflowStructure(parsed, path.basename(targetFile));
    console.log(`USS consumer workflow validation passed: ${targetFile}`);
    process.exit(0);
  } catch (err) {
    console.error(`USS consumer workflow validation failed:\n  ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    console.error(`Fatal validator error: ${err.message}`);
    process.exit(1);
  });
}
