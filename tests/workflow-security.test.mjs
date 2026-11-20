import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(ROOT, '.github/workflows');
const read = name => fs.readFileSync(path.join(workflowDir, name), 'utf8');

const FORBIDDEN_ERROR_SUPPRESSIONS = [
  /\|\|\s*true\b/,
  /\|\|\s*exit\s+0\b/,
  /\|\|\s*(?:echo|printf|cat)\b/,
  /\|\|\s*\/(?:usr\/)?bin\/true\b/,
  /\|\|\s*:/,
  /;\s*true\b/,
  /;\s*exit\s+0\b/,
  /;\s*(?:echo|printf)\b/,
  /;\s*:/,
  /\bset\s+\+e\b/,
  /\bset\s+\+o\s+(?:errexit|e)\b/,
  /\btrap\s+[^;\n]*\s+ERR\b/i,
  /--suppress-errors\b/,
  /--no-error\b/,
  /--no-strict\b/
];

const ALLOWED_TRIGGERS = new Set(['push', 'pull_request', 'schedule', 'workflow_dispatch']);

// Matches direct untrusted GitHub context or input interpolation in run: scripts.
// Covers dot notation, bracket notation, and nested paths.
const UNTRUSTED_EXPRESSION_REGEX = /\$\{\{\s*(?:github(?:\s*\.\s*|\s*\[\s*['"])(?:event|head_ref|actor|ref_name|base_ref|ref|triggering_actor)\b|inputs(?:\s*\.\s*|\s*\[\s*['"]))/i;

function buildScannerConfigGuard(targetSpec, emptyMessage) {
  return [
    'set -euo pipefail',
    'git -c safe.directory="$PWD" -c core.fsmonitor=false rev-parse --show-toplevel >/dev/null',
    'for file in .gitleaks.toml .gitleaksignore gitleaks.toml gitleaks.yaml gitleaks.yml .semgrep.yml .semgrep.yaml semgrep.yml semgrep.yaml codeql-config.yml codeql-config.yaml .github/codeql/codeql-config.yml .github/codeql/codeql-config.yaml; do',
    '  if [ -e "$file" ]; then',
    "    printf 'Unreviewed scanner override is not permitted: %s\\n' \"$file\" >&2",
    '    exit 1',
    '  fi',
    'done',
    "nested_semgrepignore=\"$(find . -path './.git' -prune -o -path './node_modules' -prune -o -name '.semgrepignore' -not -path './.semgrepignore' -print)\"",
    'if [ -n "$nested_semgrepignore" ]; then',
    "  printf 'Nested .semgrepignore is not permitted: %s\\n' \"$nested_semgrepignore\" >&2",
    '  exit 1',
    'fi',
    'if [ -L .semgrepignore ]; then',
    "  printf '%s\\n' 'A symlinked .semgrepignore is not permitted' >&2",
    '  exit 1',
    'fi',
    'if [ -f .semgrepignore ]; then',
    "  actual=\"$(awk 'NF && $1 !~ /^#/ { print $1 }' .semgrepignore | sort)\"",
    "  expected=\"$(printf '.git/\\nnode_modules/\\n' | sort)\"",
    '  if [ "$actual" != "$expected" ]; then',
    "    printf '%s\\n' '.semgrepignore may exclude only .git/ and node_modules/' >&2",
    '    exit 1',
    '  fi',
    'fi',
    'target_count=0',
    "while IFS= read -r -d '' file; do",
    '  target_count=$((target_count+1))',
    '  if git -c safe.directory="$PWD" -c core.fsmonitor=false check-ignore --no-index -q -- "$file"; then',
    "    printf 'Tracked Semgrep target is excluded by .gitignore: %s\\n' \"$file\" >&2",
    '    exit 1',
    '  else',
    '    status=$?',
    '    if [ "$status" -ne 1 ]; then',
    '      exit "$status"',
    '    fi',
    '  fi',
    'done < <(git -c safe.directory="$PWD" -c core.fsmonitor=false ls-files -z' + targetSpec + ')',
    'if [ "$target_count" -eq 0 ]; then',
    "  printf '%s\\n' '" + emptyMessage + "' >&2",
    '  exit 1',
    'fi'
  ].join('\n');
}

const SCANNER_CONFIG_GUARD_RUN = buildScannerConfigGuard(
  ' -- tools/ tests/ .github/workflows/ templates/',
  'No tracked files found in required Semgrep scan targets'
);
const CONSUMER_CONFIG_GUARD_RUN = buildScannerConfigGuard(
  '',
  'No tracked files found for Semgrep scan'
);

function assertScannerConfigGuard(step, label, consumerTemplate = false) {
  assert.equal(step.name, 'Reject unreviewed scanner configuration', label + ' must include the scanner configuration guard');
  assert.equal(step.shell, 'bash', label + ' scanner configuration guard must use bash');
  const expected = consumerTemplate ? CONSUMER_CONFIG_GUARD_RUN : SCANNER_CONFIG_GUARD_RUN;
  assert.equal(step.run?.trim(), expected.trim(), label + ' must execute the exact fail-closed scanner configuration guard');
}

// Narrow allowlist of approved job-level write permissions:
// Only CodeQL and OSV jobs may request security-events: write
const APPROVED_JOB_WRITE_PERMISSIONS = {
  codeql: new Set(['security-events']),
  osv: new Set(['security-events'])
};

/**
 * Validates that an if: condition is not constant-false or disabling.
 */
function assertNotConstantFalse(condition, context) {
  if (condition === undefined || condition === null) return;
  if (condition === false || condition === 0) {
    assert.fail(`${context} has constant-false condition: ${condition}`);
  }
  if (typeof condition === 'string') {
    const trimmed = condition.trim();
    const unquoted = trimmed.replace(/^['"]|['"]$/g, '').trim();
    if (unquoted === 'false' || unquoted === '0') {
      assert.fail(`${context} has constant-false condition: ${condition}`);
    }
    const exprMatch = trimmed.match(/^\$\{\{\s*['"]?(false|0)['"]?\s*\}\}$/i);
    if (exprMatch) {
      assert.fail(`${context} has constant-false expression: ${condition}`);
    }
  }
}

/**
 * Inspects job-level permissions for least privilege and unapproved write permissions.
 */
function assertJobPermissions(jobId, job, label) {
  if (!job.permissions) return;
  if (typeof job.permissions === 'string') {
    assert.notEqual(job.permissions, 'write-all', `${label} job ${jobId} must not use write-all permissions`);
    assert.equal(job.permissions, 'read-all', `${label} job ${jobId} string permissions must be read-all`);
  } else if (typeof job.permissions === 'object') {
    for (const [scope, perm] of Object.entries(job.permissions)) {
      if (perm === 'write' || perm === 'write-all') {
        const allowedScopes = APPROVED_JOB_WRITE_PERMISSIONS[jobId];
        assert.ok(
          allowedScopes && allowedScopes.has(scope) && perm === 'write',
          `${label} job ${jobId} granted unapproved write permission to ${scope}`
        );
      }
    }
  }
}

/**
 * Validates action pinning to full 40-character commit SHAs.
 */
function assertPinnedActions(parsed, label) {
  const jobs = parsed.jobs || {};
  for (const [jobId, job] of Object.entries(jobs)) {
    if (job.uses) {
      const parts = job.uses.split('@');
      assert.equal(parts.length, 2, `${label} job ${jobId} invalid uses: ${job.uses}`);
      assert.match(parts[1], /^[0-9a-f]{40}$/i, `${label} job ${jobId} unpinned reusable workflow: ${job.uses}`);
    }
    const steps = job.steps || [];
    for (const [i, step] of steps.entries()) {
      if (step.uses) {
        const parts = step.uses.split('@');
        assert.equal(parts.length, 2, `${label} job ${jobId} step ${i} invalid uses: ${step.uses}`);
        assert.match(parts[1], /^[0-9a-f]{40}$/i, `${label} job ${jobId} step ${i} unpinned action: ${step.uses}`);
      }
    }
  }
}

/**
 * Rejects untrusted GitHub context interpolation in workflow/job/step env and action inputs.
 * Secret expressions such as secrets.GITHUB_TOKEN remain permitted.
 */
function assertNoUntrustedExpressionsInValue(value, context) {
  if (typeof value === 'string') {
    assert.ok(!UNTRUSTED_EXPRESSION_REGEX.test(value), context + ' contains forbidden untrusted GitHub context: ' + value);
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) assertNoUntrustedExpressionsInValue(item, context + '[' + index + ']');
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertNoUntrustedExpressionsInValue(item, context + '.' + key);
  }
}

function assertSafeEnv(env, context) {
  if (env === undefined || env === null) return;
  assert.ok(typeof env === 'object' && !Array.isArray(env), context + ' env must be an object');
  for (const [name, value] of Object.entries(env)) {
    assert.equal(typeof value, 'string', context + ' env ' + name + ' must be a string');
    assertNoUntrustedExpressionsInValue(value, context + ' env ' + name);
  }
}

function assertSafeWith(inputs, context) {
  if (inputs !== undefined && inputs !== null) assertNoUntrustedExpressionsInValue(inputs, context + ' with');
}

function getTriggerMap(parsed) {
  const raw = parsed.on ?? parsed['true'];
  if (typeof raw === 'string') return { [raw]: {} };
  if (Array.isArray(raw)) return Object.fromEntries(raw.map(trigger => [trigger, {}]));
  return raw || {};
}

function assertBranchCoverage(parsed, label, requiredPullRequestBranches) {
  const triggers = getTriggerMap(parsed);
  for (const event of ['push', 'pull_request']) {
    const config = triggers[event];
    assert.ok(config && typeof config === 'object' && !Array.isArray(config), label + ' must configure ' + event + ' branch filters');
    assert.ok(Array.isArray(config.branches), label + ' ' + event + ' must declare an explicit branches allowlist');
    const required = event === 'push' ? ['**'] : requiredPullRequestBranches;
    for (const branchPattern of required) {
      assert.ok(config.branches.includes(branchPattern), label + ' ' + event + ' branch filter is missing required pattern ' + branchPattern);
    }
  }
}

function assertExactObject(actual, expected, context) {
  assert.deepEqual(actual, expected, context + ' must match the exact approved configuration');
}

function assertNoMandatoryJobConditions(jobId, job, label) {
  assert.equal(job.if, undefined, label + ' mandatory job ' + jobId + ' must not have a conditional if');
  assert.equal(job.needs, undefined, label + ' mandatory job ' + jobId + ' must not depend on optional jobs');
  assert.equal(job.strategy, undefined, label + ' mandatory job ' + jobId + ' must not use a matrix that can omit required coverage');
  assert.ok(!job['continue-on-error'], label + ' mandatory job ' + jobId + ' must not continue on error');
  for (const [index, step] of (job.steps || []).entries()) {
    assert.equal(step.if, undefined, label + ' mandatory job ' + jobId + ' step ' + index + ' must not be conditional');
  }
}

function assertNoGitleaksOverrideFiles(root = ROOT) {
  for (const file of ['.gitleaks.toml', '.gitleaksignore', 'gitleaks.toml', 'gitleaks.yaml', 'gitleaks.yml']) {
    assert.ok(!fs.existsSync(path.join(root, file)), 'Unreviewed Gitleaks configuration/ignore file is not permitted: ' + file);
  }
}

function assertSemgrepIgnoreAllowlist(root = ROOT) {
  const ignorePath = path.join(root, '.semgrepignore');
  assert.ok(fs.existsSync(ignorePath), 'First-party repository must include its reviewed .semgrepignore');
  const patterns = fs.readFileSync(ignorePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .sort();
  assert.deepEqual(patterns, ['.git/', 'node_modules/'], '.semgrepignore may exclude only VCS metadata and dependency artifacts');
}

function assertNoCodeQLConfigOverrides(root = ROOT) {
  for (const file of ['codeql-config.yml', 'codeql-config.yaml', '.github/codeql/codeql-config.yml', '.github/codeql/codeql-config.yaml']) {
    assert.ok(!fs.existsSync(path.join(root, file)), 'Unreviewed CodeQL configuration override is not permitted: ' + file);
  }
}

function assertNoSemgrepConfigOverrides(root = ROOT) {
  for (const file of ['.semgrep.yml', '.semgrep.yaml', 'semgrep.yml', 'semgrep.yaml']) {
    assert.ok(!fs.existsSync(path.join(root, file)), 'Unreviewed Semgrep configuration override is not permitted: ' + file);
  }
}

/**
 * Validates structural security invariants across GitHub Actions workflows.
 */
function validateWorkflowSecurity(parsed, label) {
  assert.ok(parsed.permissions !== undefined && parsed.permissions !== null, label + ' must declare workflow-level permissions');
  if (typeof parsed.permissions === 'string') {
    assert.notEqual(parsed.permissions, 'write-all', label + ' must not use write-all permissions');
    assert.equal(parsed.permissions, 'read-all', label + ' string permissions must be read-all');
  } else if (typeof parsed.permissions === 'object' && !Array.isArray(parsed.permissions)) {
    for (const [scope, perm] of Object.entries(parsed.permissions)) {
      assert.notEqual(perm, 'write', label + ' workflow-level permissions must not grant write access to ' + scope);
      assert.notEqual(perm, 'write-all', label + ' workflow-level permissions must not grant write access to ' + scope);
    }
  } else {
    assert.fail(label + ' workflow-level permissions must be a string or object');
  }

  const rawTriggers = parsed.on ?? parsed['true'];
  assert.ok(rawTriggers !== undefined && rawTriggers !== null, label + ' must define trigger conditions');
  let triggerKeys = [];
  if (typeof rawTriggers === 'string') triggerKeys = [rawTriggers];
  else if (Array.isArray(rawTriggers)) triggerKeys = rawTriggers;
  else if (typeof rawTriggers === 'object') triggerKeys = Object.keys(rawTriggers);
  assert.ok(triggerKeys.length > 0, label + ' must define at least one trigger');
  for (const trigger of triggerKeys) {
    assert.ok(ALLOWED_TRIGGERS.has(trigger), label + " uses unapproved trigger '" + trigger + "'");
  }

  assertSafeEnv(parsed.env, label + ' workflow');
  assertPinnedActions(parsed, label);

  const jobs = parsed.jobs || {};
  assert.ok(Object.keys(jobs).length > 0, label + ' must define at least one job');
  for (const [jobId, job] of Object.entries(jobs)) {
    assertJobPermissions(jobId, job, label);
    assertNotConstantFalse(job.if, label + ' job ' + jobId);
    assert.ok(!job['continue-on-error'], label + ' job ' + jobId + ' must not have continue-on-error: true');
    assertSafeEnv(job.env, label + ' job ' + jobId);
    assertSafeWith(job.with, label + ' job ' + jobId);

    if (job.uses) {
      assert.equal(job['runs-on'], undefined, label + ' reusable job ' + jobId + ' must not override runs-on');
      assert.equal(job.steps, undefined, label + ' reusable job ' + jobId + ' must not add inline steps');
    } else {
      assert.equal(typeof job['runs-on'], 'string', label + ' job ' + jobId + ' runs-on must be a single approved string');
      assert.equal(job['runs-on'], 'ubuntu-latest', label + ' job ' + jobId + " runs-on must be 'ubuntu-latest', got: " + String(job['runs-on']));
      assert.ok(Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] > 0, label + ' job ' + jobId + ' must specify a positive timeout-minutes integer');
    }

    const steps = job.steps || [];
    for (const [i, step] of steps.entries()) {
      assertNotConstantFalse(step.if, label + ' job ' + jobId + ' step ' + i + ' (' + (step.name || 'unnamed') + ')');
      assert.ok(!step['continue-on-error'], label + ' job ' + jobId + ' step ' + i + ' must not have continue-on-error: true');
      assertSafeEnv(step.env, label + ' job ' + jobId + ' step ' + i);
      assertSafeWith(step.with, label + ' job ' + jobId + ' step ' + i);

      if (step.uses && step.uses.startsWith('actions/checkout')) {
        assert.ok(step.with, label + ' checkout step ' + i + ' must provide with configuration');
        assert.strictEqual(step.with['persist-credentials'], false, label + ' checkout step ' + i + ' must set persist-credentials: false');
        assert.strictEqual(step.with.token, undefined, label + ' checkout step ' + i + ' must not override token with unexpected credentials');
      }

      if (step.run) {
        assert.ok(!UNTRUSTED_EXPRESSION_REGEX.test(step.run), label + ' job ' + jobId + ' step ' + i + ' contains forbidden direct expression interpolation: ' + step.run);
        for (const pattern of FORBIDDEN_ERROR_SUPPRESSIONS) {
          assert.ok(!pattern.test(step.run), label + ' job ' + jobId + ' step ' + i + ' suppresses errors with ' + pattern + ': ' + step.run);
        }
        if (/\bnpm\s+(?:install|i)\b/.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + " uses 'npm install' instead of 'npm ci': " + step.run);
        }
        if (/\bnpm\s+ci\b/.test(step.run)) {
          assert.ok(step.run.includes('--ignore-scripts'), label + ' job ' + jobId + ' step ' + i + ' running npm ci must enforce --ignore-scripts: ' + step.run);
        }
      }
    }
  }
}

/**
 * Validates USS validation workflow specific structural invariants.
 */
function validateUssValidationWorkflow(parsed) {
  validateWorkflowSecurity(parsed, 'uss-validation.yml');
  assertExactObject(parsed.permissions, { contents: 'read' }, 'uss-validation.yml workflow permissions');
  assertBranchCoverage(parsed, 'uss-validation.yml', ['main', 'integration/uss-pr3-pr8-hardening']);

  const job = parsed.jobs?.validate;
  assert.ok(job, 'uss-validation.yml must contain validate job');
  assertNoMandatoryJobConditions('validate', job, 'uss-validation.yml');
  const steps = job.steps || [];
  const stepMatchers = [
    s => s.uses && s.uses.startsWith('actions/checkout'),
    s => s.uses && s.uses.startsWith('actions/setup-node'),
    s => s.run && s.run.includes('npm ci'),
    s => s.run && s.run.includes('node tools/build-modules.mjs'),
    s => s.run && s.run.includes('git diff --exit-code -- modules/'),
    s => s.run && s.run.includes('node tools/build-indexes.mjs'),
    s => s.run && s.run.includes('node tools/build-bundles.mjs'),
    s => s.run && s.run.includes('node tools/validate.mjs'),
    s => s.run && s.run.includes('validate-evidence.mjs'),
    s => s.run && s.run.includes('node --test tests/*.test.mjs')
  ];
  assert.equal(steps.length, 10, 'uss-validation.yml validate job must contain exactly 10 steps, got ' + steps.length);
  for (let idx = 0; idx < stepMatchers.length; idx++) {
    assert.ok(stepMatchers[idx](steps[idx]), 'uss-validation.yml step ' + idx + ' does not match required step sequence: ' + (steps[idx].name || steps[idx].run || steps[idx].uses));
    assert.equal(steps[idx].if, undefined, 'uss-validation.yml mandatory step ' + idx + ' must not be conditional');
  }

  const moduleDriftStep = steps[4];
  assert.ok(!moduleDriftStep.run.includes('|| true'), 'Module drift gate must not suppress errors');
  const indexDriftStep = steps[5];
  assert.ok(indexDriftStep.run.includes('git diff --exit-code -- MODULE-INDEX.md bundles/'), 'Index drift gate must check MODULE-INDEX.md bundles/');
  assert.ok(!indexDriftStep.run.includes('|| true'), 'Index drift gate must not suppress errors');

  assert.equal(String(steps[1].with?.['node-version']), '20', 'uss-validation.yml must enforce Node.js version 20');
  assert.ok(!steps[9].run.includes('|| true'), 'Test step must not suppress errors');
  assert.ok(!steps[8].run.includes('|| true'), 'Evidence validation step must not suppress errors');
  assert.ok(!steps[8].run.includes('--help'), 'Evidence validation must not be replaced with --help');
  assert.ok(steps[8].run.includes('--file templates/security-evidence.example.json'), 'Evidence validation must validate security-evidence.example.json');
}

/**
 * Validates USS security scans workflow specific structural invariants.
 */
function validateSecurityScansWorkflow(parsed, label = 'security-scans.yml', consumerTemplate = false) {
  validateWorkflowSecurity(parsed, label);
  assertExactObject(parsed.permissions, { contents: 'read' }, label + ' workflow permissions');
  assertBranchCoverage(parsed, label, consumerTemplate ? ['**'] : ['main', 'integration/uss-pr3-pr8-hardening']);

  const jobs = parsed.jobs || {};
  const gitleaksId = consumerTemplate ? 'secrets' : 'gitleaks';
  const gitleaksJob = jobs[gitleaksId];
  assert.ok(gitleaksJob, label + ' must contain ' + gitleaksId + ' job');
  for (const jobId of [gitleaksId, 'semgrep', 'codeql', 'osv']) {
    assert.ok(jobs[jobId], label + ' must contain ' + jobId + ' job');
    assertNoMandatoryJobConditions(jobId, jobs[jobId], label);
  }

  assert.equal(gitleaksJob.name, 'Secret scan (commit range on push/PR, full history on schedule)', 'Gitleaks job name must describe actual scan scope');
  if (!consumerTemplate) assertNoGitleaksOverrideFiles(ROOT);
  assertExactObject(gitleaksJob.permissions, { contents: 'read', 'pull-requests': 'read' }, label + ' Gitleaks permissions');
  const gitleaksSteps = gitleaksJob.steps || [];
  assert.equal(gitleaksSteps.length, 3, label + ' Gitleaks job must contain exactly checkout, config guard and scan steps');
  const gitleaksCheckout = gitleaksSteps[0];
  assert.equal(gitleaksCheckout.uses, 'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803', label + ' Gitleaks checkout must use the approved pinned action');
  assertExactObject(gitleaksCheckout.with, { 'fetch-depth': 0, 'persist-credentials': false }, label + ' Gitleaks checkout inputs');
  assertScannerConfigGuard(gitleaksSteps[1], label + ' Gitleaks', consumerTemplate);
  const gitleaksAction = gitleaksSteps[2];
  assert.equal(gitleaksAction.uses, 'gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e', label + ' Gitleaks must use the approved pinned action');
  assert.strictEqual(String(gitleaksAction.env?.GITLEAKS_ENABLE_COMMENTS), 'false', label + ' Gitleaks must disable PR comments');
  assert.strictEqual(String(gitleaksAction.env?.GITLEAKS_ENABLE_UPLOAD_ARTIFACT), 'false', label + ' Gitleaks must disable artifact uploads');
  assert.strictEqual(gitleaksAction.env?.GITHUB_TOKEN, '\${{ secrets.GITHUB_TOKEN }}', label + ' Gitleaks must use only the workflow-scoped GitHub token');
  assertExactObject(gitleaksAction.env, {
    GITHUB_TOKEN: '\${{ secrets.GITHUB_TOKEN }}',
    GITLEAKS_ENABLE_COMMENTS: 'false',
    GITLEAKS_ENABLE_UPLOAD_ARTIFACT: 'false'
  }, label + ' Gitleaks environment');
  assert.equal(gitleaksAction.with, undefined, label + ' Gitleaks action must not receive unapproved inputs');

  const semgrepJob = jobs.semgrep;
  assert.equal(semgrepJob.permissions, undefined, label + ' Semgrep must inherit read-only workflow permissions');
  assert.ok(/^semgrep\/semgrep:[^@]+@sha256:[a-f0-9]{64}$/.test(semgrepJob.container?.image || ''), label + ' Semgrep container image must be pinned by immutable sha256 digest');
  assertExactObject(semgrepJob.container, {
    image: 'semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493'
  }, label + ' Semgrep container');
  const semgrepSteps = semgrepJob.steps || [];
  assert.equal(semgrepSteps.length, 3, label + ' Semgrep job must contain exactly checkout, config guard and scan steps');
  assertScannerConfigGuard(semgrepSteps[1], label + ' Semgrep', consumerTemplate);
  const semgrepStep = semgrepSteps[2];
  assert.ok(semgrepStep.run && semgrepStep.run.includes('semgrep scan'), label + ' Semgrep job must execute a scan');
  assert.ok(semgrepStep.run.includes('--error'), 'Semgrep scan must fail on findings with --error');
  if (!consumerTemplate) {
    assert.ok(semgrepStep.run.includes('tools/') && semgrepStep.run.includes('tests/') && semgrepStep.run.includes('.github/workflows/') && semgrepStep.run.includes('templates/'), 'Semgrep scan must target tools/ tests/ .github/workflows/ templates/');
    assert.ok(!semgrepStep.run.includes('--exclude'), 'Semgrep scan must not use --exclude argument to weaken scan');
  } else {
    assert.ok(!semgrepStep.run.includes('--exclude'), 'Semgrep scan must not use --exclude argument to weaken scan');
  }
  const expectedSemgrepCommand = consumerTemplate
    ? 'semgrep scan --config p/default --error --strict --metrics=off .'
    : 'semgrep scan --config p/default --error --strict --metrics=off --verbose tools/ tests/ .github/workflows/ templates/';
  assert.equal(semgrepStep.run.trim(), expectedSemgrepCommand, label + ' Semgrep must use the exact approved ruleset, flags and target scope');
  assertExactObject(semgrepStep.env, { SEMGREP_SEND_METRICS: 'off' }, label + ' Semgrep environment');
  if (!consumerTemplate) {
    assertSemgrepIgnoreAllowlist(ROOT);
    assertNoSemgrepConfigOverrides(ROOT);
  }

  const codeqlJob = jobs.codeql;
  assertExactObject(codeqlJob.permissions, {
    actions: 'read',
    contents: 'read',
    'security-events': 'write'
  }, label + ' CodeQL permissions');
  const codeqlSteps = codeqlJob.steps || [];
  assert.equal(codeqlSteps.length, 3, label + ' CodeQL must contain checkout, init and analyze steps');
  const codeqlInit = codeqlSteps[1];
  assert.equal(codeqlInit.uses, 'github/codeql-action/init@33d7b85da1a04171e211befe2c739303b9a4c066', label + ' CodeQL init action must remain pinned');
  assertExactObject(codeqlInit.with, { languages: 'javascript-typescript, actions', 'build-mode': 'none' }, label + ' CodeQL init inputs');
  const codeqlAnalyze = codeqlSteps[2];
  assert.equal(codeqlAnalyze.uses, 'github/codeql-action/analyze@33d7b85da1a04171e211befe2c739303b9a4c066', label + ' CodeQL analyze action must remain pinned');
  assert.equal(codeqlAnalyze.with, undefined, label + ' CodeQL analyze must not receive unapproved inputs');
  if (!consumerTemplate) assertNoCodeQLConfigOverrides(ROOT);

  const osvJob = jobs.osv;
  assert.equal(osvJob.uses, 'google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@d3c1414ded37de590f207572e37a7d180f1d0ef7', label + ' OSV must use the reviewed immutable upstream SHA');
  assert.strictEqual(osvJob.with?.['fail-on-vuln'], true, label + ' OSV scanner must set fail-on-vuln: true');
  assertExactObject(osvJob.with, { 'fail-on-vuln': true, 'upload-sarif': true }, label + ' OSV reusable-workflow inputs');
  assertExactObject(osvJob.permissions, {
    actions: 'read',
    contents: 'read',
    'security-events': 'write'
  }, label + ' OSV permissions');
  for (const key of ['runs-on', 'steps', 'env', 'secrets', 'container']) {
    assert.equal(osvJob[key], undefined, label + ' OSV reusable job must not override ' + key);
  }
}

// Positive tests against actual repository workflows
test('uss-validation.yml passes structural security validation', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  validateUssValidationWorkflow(parsed);
});

test('security-scans.yml passes structural security validation', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  validateSecurityScansWorkflow(parsed);
});

test('consumer-security-scans.yml template passes structural security validation', () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');
  const parsed = YAML.parse(text);
  validateSecurityScansWorkflow(parsed, 'consumer-security-scans.yml', true);
  assert.ok(text.includes('semgrep scan --config p/default --error --strict --metrics=off .'));
  const guide = fs.readFileSync(path.join(ROOT, 'templates/ci/README.md'), 'utf8');
  assert.ok(guide.includes('Change the CodeQL languages'));
});

// Negative Regression Tests (A2-02 & U-03 Mutation Resilience)

test('negative: rejects removal of generated-module drift gate', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps = parsed.jobs.validate.steps.filter(s => !s.run || !s.run.includes('git diff --exit-code -- modules/'));
  assert.throws(() => validateUssValidationWorkflow(parsed), /must contain exactly 10 steps/);
});

test('negative: rejects || true hiding Semgrep failures', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  const semgrepStep = parsed.jobs.semgrep.steps.find(s => s.run && s.run.includes('semgrep scan'));
  semgrepStep.run += ' || true';
  assert.throws(() => validateSecurityScansWorkflow(parsed), /suppresses errors with/);
});

test('negative: rejects || true hiding test failures', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  const testStep = parsed.jobs.validate.steps.find(s => s.run && s.run.includes('node --test'));
  testStep.run += ' || true';
  assert.throws(() => validateUssValidationWorkflow(parsed), /suppresses errors with/);
});

test('negative: rejects || true hiding evidence-validation failures', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  const evidenceStep = parsed.jobs.validate.steps.find(s => s.run && s.run.includes('validate-evidence.mjs'));
  evidenceStep.run += ' || true';
  assert.throws(() => validateUssValidationWorkflow(parsed), /suppresses errors with/);
});

test('negative: rejects continue-on-error: true on security jobs and steps', () => {
  const parsedJob = YAML.parse(read('security-scans.yml'));
  parsedJob.jobs.semgrep['continue-on-error'] = true;
  assert.throws(() => validateSecurityScansWorkflow(parsedJob), /must not have continue-on-error: true/);

  const parsedStep = YAML.parse(read('security-scans.yml'));
  parsedStep.jobs.semgrep.steps[0]['continue-on-error'] = true;
  assert.throws(() => validateSecurityScansWorkflow(parsedStep), /must not have continue-on-error: true/);
});

test('negative: rejects persist-credentials: true or missing on checkout', () => {
  const parsedTrue = YAML.parse(read('uss-validation.yml'));
  const checkoutStep = parsedTrue.jobs.validate.steps.find(s => s.uses && s.uses.startsWith('actions/checkout'));
  checkoutStep.with['persist-credentials'] = true;
  assert.throws(() => validateUssValidationWorkflow(parsedTrue), /must set persist-credentials: false/);

  const parsedMissing = YAML.parse(read('uss-validation.yml'));
  const checkoutMissing = parsedMissing.jobs.validate.steps.find(s => s.uses && s.uses.startsWith('actions/checkout'));
  delete checkoutMissing.with['persist-credentials'];
  assert.throws(() => validateUssValidationWorkflow(parsedMissing), /must set persist-credentials: false/);
});

test('negative: rejects pull_request_target trigger', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.on = { pull_request_target: { branches: ['main'] } };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /uses unapproved trigger 'pull_request_target'/);
});

test('negative: rejects unnecessary write permissions at workflow level', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.permissions = { contents: 'write' };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must not grant write access to contents/);

  const parsedWriteAll = YAML.parse(read('uss-validation.yml'));
  parsedWriteAll.permissions = 'write-all';
  assert.throws(() => validateUssValidationWorkflow(parsedWriteAll), /must not use write-all permissions/);
});

test('negative: rejects fail-on-vuln: false disguised or explicit', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.osv.with['fail-on-vuln'] = false;
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must set fail-on-vuln: true/);

  const parsedString = YAML.parse(read('security-scans.yml'));
  parsedString.jobs.osv.with['fail-on-vuln'] = 'false';
  assert.throws(() => validateSecurityScansWorkflow(parsedString), /must set fail-on-vuln: true/);
});

test('negative: rejects replacement of pinned action SHAs with mutable tags', () => {
  const parsedTag = YAML.parse(read('uss-validation.yml'));
  parsedTag.jobs.validate.steps[0].uses = 'actions/checkout@v4';
  assert.throws(() => validateUssValidationWorkflow(parsedTag), /unpinned action: actions\/checkout@v4/);

  const parsedSemgrep = YAML.parse(read('security-scans.yml'));
  parsedSemgrep.jobs.semgrep.container.image = 'semgrep/semgrep:1.186.0';
  assert.throws(() => validateSecurityScansWorkflow(parsedSemgrep), /must be pinned by immutable sha256 digest/);
});

test('negative: rejects missing required scanner jobs', () => {
  for (const jobName of ['gitleaks', 'semgrep', 'codeql', 'osv']) {
    const parsed = YAML.parse(read('security-scans.yml'));
    delete parsed.jobs[jobName];
    assert.throws(() => validateSecurityScansWorkflow(parsed), new RegExp(`must contain ${jobName} job`));
  }
});

test('negative: rejects non-Node-20 validation', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  const setupNode = parsed.jobs.validate.steps.find(s => s.uses && s.uses.startsWith('actions/setup-node'));
  setupNode.with['node-version'] = 22;
  assert.throws(() => validateUssValidationWorkflow(parsed), /must enforce Node\.js version 20/);
});

test('negative: rejects direct github.event expression interpolation in run scripts', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps[2].run = 'echo "${{ github.event.issue.title }}"';
  assert.throws(() => validateUssValidationWorkflow(parsed), /contains forbidden direct expression interpolation/);
});

test('negative: rejects workflow_run trigger', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.on = { workflow_run: { workflows: ['CI'] } };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /uses unapproved trigger 'workflow_run'/);
});

test('negative: rejects npm install in favor of npm ci', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  const installStep = parsed.jobs.validate.steps.find(s => s.run && s.run.includes('npm ci'));
  installStep.run = 'npm install --ignore-scripts --no-audit';
  assert.throws(() => validateUssValidationWorkflow(parsed), /uses 'npm install' instead of 'npm ci'/);
});

test('negative: rejects npm ci without --ignore-scripts', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  const installStep = parsed.jobs.validate.steps.find(s => s.run && s.run.includes('npm ci'));
  installStep.run = 'npm ci --no-audit --no-fund';
  assert.throws(() => validateUssValidationWorkflow(parsed), /must enforce --ignore-scripts/);
});

test('negative: rejects runner job missing timeout-minutes', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  delete parsed.jobs.gitleaks['timeout-minutes'];
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must specify a positive timeout-minutes/);
});

// Additional adversarial mutation tests (A2-02)

test('negative: rejects missing workflow-level permissions declaration', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  delete parsed.permissions;
  assert.throws(() => validateUssValidationWorkflow(parsed), /must declare workflow-level permissions/);
});

test('negative: rejects unapproved job-level write permissions on non-security jobs', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.semgrep.permissions = { contents: 'write' };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /semgrep granted unapproved write permission to contents/);

  const parsedGitleaks = YAML.parse(read('security-scans.yml'));
  parsedGitleaks.jobs.gitleaks.permissions = { contents: 'write', 'pull-requests': 'read' };
  assert.throws(() => validateSecurityScansWorkflow(parsedGitleaks), /gitleaks granted unapproved write permission to contents/);
});

test('negative: rejects unapproved write permissions on security jobs', () => {
  const parsedCodeql = YAML.parse(read('security-scans.yml'));
  parsedCodeql.jobs.codeql.permissions = {
    actions: 'read',
    contents: 'write',
    'security-events': 'write'
  };
  assert.throws(() => validateSecurityScansWorkflow(parsedCodeql), /codeql granted unapproved write permission to contents/);

  const parsedOsv = YAML.parse(read('security-scans.yml'));
  parsedOsv.jobs.osv.permissions = {
    actions: 'read',
    contents: 'write',
    'security-events': 'write'
  };
  assert.throws(() => validateSecurityScansWorkflow(parsedOsv), /osv granted unapproved write permission to contents/);
});

test('negative: rejects job-level write-all permissions', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.semgrep.permissions = 'write-all';
  assert.throws(() => validateSecurityScansWorkflow(parsed), /semgrep must not use write-all permissions/);
});

test('negative: rejects unapproved triggers (issue_comment, pull_request_review_comment)', () => {
  const parsedComment = YAML.parse(read('security-scans.yml'));
  parsedComment.on = { issue_comment: { types: ['created'] } };
  assert.throws(() => validateSecurityScansWorkflow(parsedComment), /uses unapproved trigger 'issue_comment'/);

  const parsedReview = YAML.parse(read('security-scans.yml'));
  parsedReview.on = ['pull_request_review_comment'];
  assert.throws(() => validateSecurityScansWorkflow(parsedReview), /uses unapproved trigger 'pull_request_review_comment'/);
});

test('negative: rejects bracket notation untrusted expression interpolation in run scripts', () => {
  const parsedBracketEvent = YAML.parse(read('uss-validation.yml'));
  parsedBracketEvent.jobs.validate.steps[2].run = `echo "\${{ github['event']['issue']['title'] }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedBracketEvent), /contains forbidden direct expression interpolation/);

  const parsedHeadRef = YAML.parse(read('uss-validation.yml'));
  parsedHeadRef.jobs.validate.steps[2].run = `echo "\${{ github.head_ref }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedHeadRef), /contains forbidden direct expression interpolation/);

  const parsedBracketHeadRef = YAML.parse(read('uss-validation.yml'));
  parsedBracketHeadRef.jobs.validate.steps[2].run = `echo "\${{ github['head_ref'] }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedBracketHeadRef), /contains forbidden direct expression interpolation/);

  const parsedActor = YAML.parse(read('uss-validation.yml'));
  parsedActor.jobs.validate.steps[2].run = `echo "\${{ github.actor }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedActor), /contains forbidden direct expression interpolation/);

  const parsedRefName = YAML.parse(read('uss-validation.yml'));
  parsedRefName.jobs.validate.steps[2].run = `echo "\${{ github['ref_name'] }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedRefName), /contains forbidden direct expression interpolation/);
});

test('negative: rejects inputs expression interpolation in run scripts', () => {
  const parsedInput = YAML.parse(read('uss-validation.yml'));
  parsedInput.jobs.validate.steps[2].run = `echo "\${{ inputs.target }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedInput), /contains forbidden direct expression interpolation/);

  const parsedBracketInput = YAML.parse(read('uss-validation.yml'));
  parsedBracketInput.jobs.validate.steps[2].run = `echo "\${{ inputs['branch'] }}"`;
  assert.throws(() => validateUssValidationWorkflow(parsedBracketInput), /contains forbidden direct expression interpolation/);
});

test('negative: rejects constant-false if conditions on jobs and steps', () => {
  // Job level if: false
  const parsedJobFalse = YAML.parse(read('security-scans.yml'));
  parsedJobFalse.jobs.semgrep.if = false;
  assert.throws(() => validateSecurityScansWorkflow(parsedJobFalse), /has constant-false condition: false/);

  // Job level if: 'false'
  const parsedJobStrFalse = YAML.parse(read('security-scans.yml'));
  parsedJobStrFalse.jobs.codeql.if = 'false';
  assert.throws(() => validateSecurityScansWorkflow(parsedJobStrFalse), /has constant-false condition: false/);

  // Job level if: ${{ false }}
  const parsedJobExprFalse = YAML.parse(read('security-scans.yml'));
  parsedJobExprFalse.jobs.osv.if = '${{ false }}';
  assert.throws(() => validateSecurityScansWorkflow(parsedJobExprFalse), /has constant-false expression/);

  // Step level if: false
  const parsedStepFalse = YAML.parse(read('uss-validation.yml'));
  parsedStepFalse.jobs.validate.steps[7].if = false;
  assert.throws(() => validateUssValidationWorkflow(parsedStepFalse), /has constant-false condition: false/);

  // Step level if: '0'
  const parsedStepZero = YAML.parse(read('uss-validation.yml'));
  parsedStepZero.jobs.validate.steps[7].if = '0';
  assert.throws(() => validateUssValidationWorkflow(parsedStepZero), /has constant-false condition: 0/);
});

test('negative: rejects error suppression via || echo ignored, set +e, and ; exit 0', () => {
  const parsedEcho = YAML.parse(read('security-scans.yml'));
  const semgrepStep = parsedEcho.jobs.semgrep.steps.find(s => s.run && s.run.includes('semgrep scan'));
  semgrepStep.run += ' || echo ignored';
  assert.throws(() => validateSecurityScansWorkflow(parsedEcho), /suppresses errors with/);

  const parsedSetE = YAML.parse(read('uss-validation.yml'));
  const testStep = parsedSetE.jobs.validate.steps.find(s => s.run && s.run.includes('node --test'));
  testStep.run = 'set +e\n' + testStep.run;
  assert.throws(() => validateUssValidationWorkflow(parsedSetE), /suppresses errors with/);

  const parsedSemiExit = YAML.parse(read('uss-validation.yml'));
  const evidenceStep = parsedSemiExit.jobs.validate.steps.find(s => s.run && s.run.includes('validate-evidence.mjs'));
  evidenceStep.run += '; exit 0';
  assert.throws(() => validateUssValidationWorkflow(parsedSemiExit), /suppresses errors with/);
});

test('negative: rejects unapproved self-hosted runner', () => {
  const parsedStr = YAML.parse(read('security-scans.yml'));
  parsedStr.jobs.semgrep['runs-on'] = 'self-hosted';
  assert.throws(() => validateSecurityScansWorkflow(parsedStr), /runs-on must be 'ubuntu-latest', got: self-hosted/);

  const parsedArr = YAML.parse(read('security-scans.yml'));
  parsedArr.jobs.codeql['runs-on'] = ['self-hosted', 'linux'];
  assert.throws(() => validateSecurityScansWorkflow(parsedArr), /runs-on must be a single approved string/);
});

test('negative: rejects checkout token override with unexpected credentials', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps[0].with.token = '${{ secrets.PERSONAL_ACCESS_TOKEN }}';
  assert.throws(() => validateUssValidationWorkflow(parsed), /must not override token with unexpected credentials/);
});

test('negative: rejects replacing real evidence validation with --help', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  const evidenceStep = parsed.jobs.validate.steps[8];
  evidenceStep.run = 'node tools/validate-evidence.mjs --help';
  assert.throws(() => validateUssValidationWorkflow(parsed), /Evidence validation must not be replaced with --help/);
});

test('negative: rejects reordering of mandatory validation steps', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  // Swap step 7 (validate source coverage) and step 8 (validate evidence)
  const temp = parsed.jobs.validate.steps[7];
  parsed.jobs.validate.steps[7] = parsed.jobs.validate.steps[8];
  parsed.jobs.validate.steps[8] = temp;
  assert.throws(() => validateUssValidationWorkflow(parsed), /does not match required step sequence/);
});

test('negative: rejects Semgrep scan omitting .github/workflows/ or templates/', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  const semgrepStep = parsed.jobs.semgrep.steps.find(s => s.run && s.run.includes('semgrep scan'));
  semgrepStep.run = 'semgrep scan --config p/default --error --metrics=off --verbose tools/ tests/';
  assert.throws(() => validateSecurityScansWorkflow(parsed), /Semgrep scan must target tools\/ tests\/ \.github\/workflows\/ templates\//);
});

test('negative: rejects Semgrep scan with --exclude argument weakening scan', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  const semgrepStep = parsed.jobs.semgrep.steps.find(s => s.run && s.run.includes('semgrep scan'));
  semgrepStep.run += ' --exclude=templates/';
  assert.throws(() => validateSecurityScansWorkflow(parsed), /Semgrep scan must not use --exclude argument to weaken scan/);
});


test('negative: rejects untrusted GitHub expressions moved into workflow, job, step env and action inputs', () => {
  const workflowEnv = YAML.parse(read('uss-validation.yml'));
  workflowEnv.env = { TITLE: '\${{ github.event.issue.title }}' };
  assert.throws(() => validateUssValidationWorkflow(workflowEnv), /workflow env TITLE contains forbidden untrusted GitHub context/);

  const jobEnv = YAML.parse(read('uss-validation.yml'));
  jobEnv.jobs.validate.env = { BRANCH: '\${{ github.head_ref }}' };
  assert.throws(() => validateUssValidationWorkflow(jobEnv), /job validate env BRANCH contains forbidden untrusted GitHub context/);

  const stepEnv = YAML.parse(read('uss-validation.yml'));
  stepEnv.jobs.validate.steps[2].env = { ACTOR: '\${{ github.actor }}' };
  assert.throws(() => validateUssValidationWorkflow(stepEnv), /step 2 env ACTOR contains forbidden untrusted GitHub context/);

  const actionInput = YAML.parse(read('uss-validation.yml'));
  actionInput.jobs.validate.steps[1].with['node-version'] = '\${{ inputs.target }}';
  assert.throws(() => validateUssValidationWorkflow(actionInput), /with.*contains forbidden untrusted GitHub context/);
});

test('negative: rejects array, object and expression-based runner selectors', () => {
  for (const selector of [
    ['ubuntu-latest', 'extra-label'],
    { group: 'ubuntu-latest' },
    '\${{ inputs.runner }}'
  ]) {
    const parsed = YAML.parse(read('security-scans.yml'));
    parsed.jobs.semgrep['runs-on'] = selector;
    assert.throws(() => validateSecurityScansWorkflow(parsed), /runs-on must (?:be a single approved string|be 'ubuntu-latest')/);
  }
});

test('negative: rejects OSV reusable-workflow input overrides and unknown keys', () => {
  for (const key of ['scan-args', 'runs-on', 'ref', 'unapproved-input']) {
    const parsed = YAML.parse(read('security-scans.yml'));
    parsed.jobs.osv.with[key] = key === 'unapproved-input' ? 'weakened' : '--all-packages';
    assert.throws(() => validateSecurityScansWorkflow(parsed), /OSV reusable-workflow inputs must match the exact approved configuration/);
  }
});

test('negative: rejects Semgrep alternate config, duplicate config, excludes and weakening environment values', () => {
  const alternate = YAML.parse(read('security-scans.yml'));
  alternate.jobs.semgrep.steps[2].run += ' --config custom.yml';
  assert.throws(() => validateSecurityScansWorkflow(alternate), /exact approved ruleset/);

  const duplicate = YAML.parse(read('security-scans.yml'));
  duplicate.jobs.semgrep.steps[2].run += ' --config p/owasp-top-ten';
  assert.throws(() => validateSecurityScansWorkflow(duplicate), /exact approved ruleset/);

  const weakenedEnv = YAML.parse(read('security-scans.yml'));
  weakenedEnv.jobs.semgrep.steps[2].env.SEMGREP_RULES = 'custom.yml';
  assert.throws(() => validateSecurityScansWorkflow(weakenedEnv), /Semgrep environment must match the exact approved configuration/);
});

test('negative: rejects Gitleaks config overrides and artifact upload', () => {
  const configOverride = YAML.parse(read('security-scans.yml'));
  configOverride.jobs.gitleaks.steps[2].env.GITLEAKS_CONFIG = '.gitleaks.toml';
  assert.throws(() => validateSecurityScansWorkflow(configOverride), /Gitleaks environment must match the exact approved configuration/);

  const artifactUpload = YAML.parse(read('security-scans.yml'));
  artifactUpload.jobs.gitleaks.steps[2].env.GITLEAKS_ENABLE_UPLOAD_ARTIFACT = 'true';
  assert.throws(() => validateSecurityScansWorkflow(artifactUpload), /Gitleaks must disable artifact uploads/);
});

test('negative: rejects Gitleaks ignore files that silently suppress findings', () => {
  const temp = fs.mkdtempSync(path.join(ROOT, '.tmp-gitleaks-ignore-'));
  try {
    fs.writeFileSync(path.join(temp, '.gitleaksignore'), 'deadbeef\n');
    assert.throws(() => assertNoGitleaksOverrideFiles(temp), /Unreviewed Gitleaks configuration\/ignore file/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('negative: rejects Semgrep ignore rules that exclude source coverage', () => {
  const temp = fs.mkdtempSync(path.join(ROOT, '.tmp-semgrep-ignore-'));
  try {
    fs.writeFileSync(path.join(temp, '.semgrepignore'), '.git/\nnode_modules/\ntools/\n');
    assert.throws(() => assertSemgrepIgnoreAllowlist(temp), /may exclude only VCS metadata and dependency artifacts/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('negative: rejects CodeQL path exclusions and custom query weakening', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.codeql.steps[1].with['paths-ignore'] = ['tools/**'];
  assert.throws(() => validateSecurityScansWorkflow(parsed), /CodeQL init inputs must match the exact approved configuration/);
});

test('negative: rejects pull-request and push branch filters that skip required branches', () => {
  const pullRequest = YAML.parse(read('security-scans.yml'));
  const triggers = pullRequest.on || pullRequest['true'];
  triggers.pull_request.branches = ['main'];
  assert.throws(() => validateSecurityScansWorkflow(pullRequest), /pull_request branch filter is missing required pattern integration\/uss-pr3-pr8-hardening/);

  const push = YAML.parse(read('security-scans.yml'));
  const pushTriggers = push.on || push['true'];
  pushTriggers.push.branches = ['main'];
  assert.throws(() => validateSecurityScansWorkflow(push), /push branch filter is missing required pattern \*\*/);
});

test('negative: rejects additional error-masking shell variants', () => {
  for (const suffix of [' || :', ' || /bin/true', '; echo ignored', 'set +o errexit', ' --suppress-errors', ' --no-error', ' --no-strict']) {
    const parsed = YAML.parse(read('security-scans.yml'));
    parsed.jobs.semgrep.steps[2].run += suffix;
    assert.throws(() => validateSecurityScansWorkflow(parsed), /suppresses errors with/);
  }
});

test('negative: consumer template receives scanner-specific validation, not only generic YAML checks', () => {
  const upload = YAML.parse(fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8'));
  upload.jobs.secrets.steps[2].env.GITLEAKS_ENABLE_UPLOAD_ARTIFACT = 'true';
  assert.throws(() => validateSecurityScansWorkflow(upload, 'consumer-security-scans.yml', true), /Gitleaks must disable artifact uploads/);

  const semgrep = YAML.parse(fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8'));
  semgrep.jobs.semgrep.steps[2].run += ' --exclude=src/';
  assert.throws(() => validateSecurityScansWorkflow(semgrep, 'consumer-security-scans.yml', true), /must not use --exclude/);

  const osv = YAML.parse(fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8'));
  osv.jobs.osv.with['scan-args'] = '--all-packages';
  assert.throws(() => validateSecurityScansWorkflow(osv, 'consumer-security-scans.yml', true), /OSV reusable-workflow inputs must match the exact approved configuration/);
});

test('negative: mandatory scanner jobs and steps cannot be made conditional or optional', () => {
  const conditional = YAML.parse(read('security-scans.yml'));
  conditional.jobs.semgrep.if = "\${{ github.event_name == 'push' }}";
  assert.throws(() => validateSecurityScansWorkflow(conditional), /mandatory job semgrep must not have a conditional if/);

  const dependency = YAML.parse(read('security-scans.yml'));
  dependency.jobs.codeql.needs = ['gitleaks'];
  assert.throws(() => validateSecurityScansWorkflow(dependency), /mandatory job codeql must not depend on optional jobs/);

  const stepConditional = YAML.parse(read('security-scans.yml'));
  stepConditional.jobs.semgrep.steps[2].if = "\${{ github.event_name == 'push' }}";
  assert.throws(() => validateSecurityScansWorkflow(stepConditional), /must not be conditional/);
});


test('negative: consumer template cannot omit or weaken the runtime scanner configuration guard', () => {
  const missing = YAML.parse(fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8'));
  missing.jobs.secrets.steps.splice(1, 1);
  assert.throws(() => validateSecurityScansWorkflow(missing, 'consumer-security-scans.yml', true), /Gitleaks job must contain exactly checkout, config guard and scan steps/);

  const weakened = YAML.parse(fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8'));
  weakened.jobs.semgrep.steps[1].run = 'echo scanner config check skipped';
  assert.throws(() => validateSecurityScansWorkflow(weakened, 'consumer-security-scans.yml', true), /must execute the exact fail-closed scanner configuration guard/);
});


test('runtime scanner guard rejects nested Semgrep ignore files and .gitignore-suppressed tracked scan targets', t => {
  if (process.platform === 'win32') {
    t.skip('Runtime guard integration test requires bash, available in hosted Linux CI');
    return;
  }
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-scanner-guard-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, command + ' ' + args.join(' ') + ' failed: ' + result.stderr);
    return result;
  };
  run('git', ['init', '-q']);
  run('git', ['config', 'user.name', 'USS Scanner Guard Test']);
  run('git', ['config', 'user.email', 'uss-scanner-guard@example.invalid']);
  run('git', ['config', 'commit.gpgsign', 'false']);
  for (const dir of ['tools', 'tests', '.github/workflows', 'templates']) {
    fs.mkdirSync(path.join(cwd, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'tools/guard.js\n');
  fs.writeFileSync(path.join(cwd, 'tools/guard.js'), 'const ok = true;\n');
  fs.writeFileSync(path.join(cwd, 'tests/check.mjs'), 'const ok = true;\n');
  fs.writeFileSync(path.join(cwd, '.github/workflows/test.yml'), 'name: test\n');
  fs.writeFileSync(path.join(cwd, 'templates/template.yml'), 'name: template\n');
  run('git', ['add', '.gitignore', 'tests/check.mjs', '.github/workflows/test.yml', 'templates/template.yml']);
  run('git', ['add', '-f', 'tools/guard.js']);
  run('git', ['commit', '-m', 'scanner guard fixture']);

  const ignored = spawnSync('bash', ['-c', SCANNER_CONFIG_GUARD_RUN], { cwd, encoding: 'utf8' });
  assert.notEqual(ignored.status, 0, 'Guard must reject a tracked scanner target hidden by .gitignore');
  assert.match(ignored.stderr, /excluded by \.gitignore/);

  fs.writeFileSync(path.join(cwd, '.gitignore'), '');
  run('git', ['add', '.gitignore']);
  run('git', ['commit', '-m', 'remove ignored target pattern']);
  fs.writeFileSync(path.join(cwd, 'tools', '.semgrepignore'), 'sensitive-source/\n');
  const nested = spawnSync('bash', ['-c', SCANNER_CONFIG_GUARD_RUN], { cwd, encoding: 'utf8' });
  assert.notEqual(nested.status, 0, 'Guard must reject nested .semgrepignore files');
  assert.match(nested.stderr, /Nested \.semgrepignore is not permitted/);
});
