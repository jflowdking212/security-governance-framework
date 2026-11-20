import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(ROOT, '.github/workflows');
const read = name => fs.readFileSync(path.join(workflowDir, name), 'utf8');

const FORBIDDEN_ERROR_SUPPRESSIONS = [
  /\|\|\s*true\b/,
  /\|\|\s*exit\s+0\b/,
  /\|\|\s*echo\b/,
  /;\s*true\b/,
  /;\s*exit\s+0\b/,
  /\bset\s+\+e\b/
];

const ALLOWED_TRIGGERS = new Set(['push', 'pull_request', 'schedule', 'workflow_dispatch']);

// Matches direct untrusted GitHub context or input interpolation in run: scripts.
// Covers dot notation, bracket notation, and nested paths.
const UNTRUSTED_EXPRESSION_REGEX = /\$\{\{\s*(?:github(?:\s*\.\s*|\s*\[\s*['"])(?:event|head_ref|actor|ref_name|base_ref)\b|inputs(?:\s*\.\s*|\s*\[\s*['"]))/i;

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
 * Validates structural security invariants across GitHub Actions workflows.
 */
function validateWorkflowSecurity(parsed, label) {
  // 1. Workflow-level permissions must be declared and least-privilege (read-only, no write permissions)
  assert.ok(parsed.permissions !== undefined && parsed.permissions !== null, `${label} must declare workflow-level permissions`);
  if (typeof parsed.permissions === 'string') {
    assert.notEqual(parsed.permissions, 'write-all', `${label} must not use write-all permissions`);
    assert.equal(parsed.permissions, 'read-all', `${label} string permissions must be read-all`);
  } else if (typeof parsed.permissions === 'object') {
    for (const [scope, perm] of Object.entries(parsed.permissions)) {
      assert.notEqual(perm, 'write', `${label} workflow-level permissions must not grant write access to ${scope}`);
      assert.notEqual(perm, 'write-all', `${label} workflow-level permissions must not grant write access to ${scope}`);
    }
  } else {
    assert.fail(`${label} workflow-level permissions must be a string or object`);
  }

  // 2. Triggers must strictly adhere to approved allowlist (no pull_request_target, workflow_run, issue_comment, etc.)
  const rawTriggers = parsed.on || parsed['true'];
  assert.ok(rawTriggers !== undefined && rawTriggers !== null, `${label} must define trigger conditions`);
  let triggerKeys = [];
  if (typeof rawTriggers === 'string') {
    triggerKeys = [rawTriggers];
  } else if (Array.isArray(rawTriggers)) {
    triggerKeys = rawTriggers;
  } else if (typeof rawTriggers === 'object') {
    triggerKeys = Object.keys(rawTriggers);
  }
  assert.ok(triggerKeys.length > 0, `${label} must define at least one trigger`);
  for (const trigger of triggerKeys) {
    assert.ok(
      ALLOWED_TRIGGERS.has(trigger),
      `${label} uses unapproved trigger '${trigger}'. Allowed triggers: ${[...ALLOWED_TRIGGERS].join(', ')}`
    );
  }

  // 3. Actions must be pinned to 40-character SHAs
  assertPinnedActions(parsed, label);

  // 4. Job and step level inspections
  const jobs = parsed.jobs || {};
  assert.ok(Object.keys(jobs).length > 0, `${label} must define at least one job`);

  for (const [jobId, job] of Object.entries(jobs)) {
    // Inspect job-level permissions
    assertJobPermissions(jobId, job, label);

    // Reject constant-false conditions on jobs
    assertNotConstantFalse(job.if, `${label} job ${jobId}`);

    // continue-on-error forbidden on security jobs
    assert.ok(!job['continue-on-error'], `${label} job ${jobId} must not have continue-on-error: true`);

    // Runner safety: ubuntu-latest required, reject self-hosted
    if (job['runs-on']) {
      const runsOn = job['runs-on'];
      if (typeof runsOn === 'string') {
        assert.equal(runsOn, 'ubuntu-latest', `${label} job ${jobId} runs-on must be 'ubuntu-latest', got: ${runsOn}`);
      } else if (Array.isArray(runsOn)) {
        assert.ok(
          runsOn.includes('ubuntu-latest') && !runsOn.some(r => typeof r === 'string' && r.toLowerCase().includes('self-hosted')),
          `${label} job ${jobId} must not use unapproved or self-hosted runner: ${runsOn}`
        );
      }
      assert.ok(typeof job['timeout-minutes'] === 'number' && job['timeout-minutes'] > 0, `${label} job ${jobId} must specify a positive timeout-minutes`);
    }

    const steps = job.steps || [];
    for (const [i, step] of steps.entries()) {
      // Reject constant-false conditions on steps
      assertNotConstantFalse(step.if, `${label} job ${jobId} step ${i} (${step.name || 'unnamed'})`);

      // continue-on-error forbidden on steps
      assert.ok(!step['continue-on-error'], `${label} job ${jobId} step ${i} (${step.name || 'unnamed'}) must not have continue-on-error: true`);

      // Checkout persist-credentials must be false; reject checkout token overrides
      if (step.uses && step.uses.startsWith('actions/checkout')) {
        assert.ok(step.with, `${label} checkout step ${i} must provide 'with' configuration`);
        assert.strictEqual(step.with['persist-credentials'], false, `${label} checkout step ${i} must set persist-credentials: false`);
        assert.strictEqual(step.with.token, undefined, `${label} checkout step ${i} must not override token with unexpected credentials`);
      }

      // Check run commands
      if (step.run) {
        // Reject direct untrusted expression interpolation (github.event, github.head_ref, github['...'], inputs, etc.)
        assert.ok(
          !UNTRUSTED_EXPRESSION_REGEX.test(step.run),
          `${label} step ${i} contains forbidden direct expression interpolation: ${step.run}`
        );

        // Error suppression
        for (const pattern of FORBIDDEN_ERROR_SUPPRESSIONS) {
          assert.ok(!pattern.test(step.run), `${label} step ${i} suppresses errors with ${pattern}: ${step.run}`);
        }

        // npm install forbidden; must use npm ci
        if (/\bnpm\s+(?:install|i)\b/.test(step.run)) {
          assert.fail(`${label} step ${i} uses 'npm install' instead of 'npm ci': ${step.run}`);
        }

        // npm ci must enforce --ignore-scripts
        if (/\bnpm\s+ci\b/.test(step.run)) {
          assert.ok(step.run.includes('--ignore-scripts'), `${label} step ${i} running npm ci must enforce --ignore-scripts: ${step.run}`);
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
  const job = parsed.jobs?.validate;
  assert.ok(job, 'uss-validation.yml must contain validate job');

  const steps = job.steps || [];

  // Mandatory step order enforcement:
  // Expected sequence of exactly 10 steps:
  // 0: checkout (actions/checkout)
  // 1: setup-node (actions/setup-node)
  // 2: npm ci
  // 3: build-modules (tools/build-modules.mjs)
  // 4: diff modules (git diff --exit-code -- modules/)
  // 5: build-indexes (tools/build-indexes.mjs & git diff MODULE-INDEX.md bundles/)
  // 6: build-bundles (tools/build-bundles.mjs)
  // 7: validate (tools/validate.mjs)
  // 8: validate-evidence (tools/validate-evidence.mjs --file templates/security-evidence.example.json)
  // 9: tests (node --test tests/*.test.mjs)

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

  assert.equal(steps.length, 10, `uss-validation.yml validate job must contain exactly 10 steps, got ${steps.length}`);

  for (let idx = 0; idx < stepMatchers.length; idx++) {
    assert.ok(
      stepMatchers[idx](steps[idx]),
      `uss-validation.yml step ${idx} does not match required step sequence: ${steps[idx].name || steps[idx].run || steps[idx].uses}`
    );
  }

  // Drift gate step verification
  const moduleDriftStep = steps[4];
  assert.ok(!moduleDriftStep.run.includes('|| true'), 'Module drift gate must not suppress errors');

  const indexDriftStep = steps[5];
  assert.ok(indexDriftStep.run.includes('git diff --exit-code -- MODULE-INDEX.md bundles/'), 'Index drift gate must check MODULE-INDEX.md bundles/');
  assert.ok(!indexDriftStep.run.includes('|| true'), 'Index drift gate must not suppress errors');

  // Node 20 verification
  const setupNodeStep = steps[1];
  const nodeVersion = String(setupNodeStep.with?.['node-version']);
  assert.equal(nodeVersion, '20', 'uss-validation.yml must enforce Node.js version 20');

  // Test and evidence steps
  const testStep = steps[9];
  assert.ok(!testStep.run.includes('|| true'), 'Test step must not suppress errors');

  const evidenceStep = steps[8];
  assert.ok(!evidenceStep.run.includes('|| true'), 'Evidence validation step must not suppress errors');
  assert.ok(!evidenceStep.run.includes('--help'), 'Evidence validation must not be replaced with --help');
  assert.ok(evidenceStep.run.includes('--file templates/security-evidence.example.json'), 'Evidence validation must validate security-evidence.example.json');
}

/**
 * Validates USS security scans workflow specific structural invariants.
 */
function validateSecurityScansWorkflow(parsed) {
  validateWorkflowSecurity(parsed, 'security-scans.yml');
  const jobs = parsed.jobs || {};

  // Required scanner jobs must exist
  assert.ok(jobs.gitleaks, 'security-scans.yml must contain gitleaks job');
  assert.ok(jobs.semgrep, 'security-scans.yml must contain semgrep job');
  assert.ok(jobs.codeql, 'security-scans.yml must contain codeql job');
  assert.ok(jobs.osv, 'security-scans.yml must contain osv job');

  // Gitleaks checks
  assert.equal(jobs.gitleaks.name, 'Secret scan (commit range on push/PR, full history on schedule)', 'Gitleaks job name must reflect accurate scope');
  const gitleaksSteps = jobs.gitleaks.steps || [];
  const gitleaksCheckout = gitleaksSteps.find(s => s.uses && s.uses.startsWith('actions/checkout'));
  assert.ok(gitleaksCheckout, 'Gitleaks job must check out repository');
  assert.strictEqual(gitleaksCheckout.with?.['fetch-depth'], 0, 'Gitleaks checkout must specify fetch-depth: 0 for full git history');
  const gitleaksAction = gitleaksSteps.find(s => s.uses && s.uses.startsWith('gitleaks/gitleaks-action'));
  assert.ok(gitleaksAction, 'Gitleaks job must run gitleaks-action');
  assert.strictEqual(String(gitleaksAction.env?.GITLEAKS_ENABLE_COMMENTS), 'false', 'Gitleaks must disable PR comments');

  // Semgrep checks
  const semgrepJob = jobs.semgrep;
  assert.ok(semgrepJob.container?.image, 'Semgrep job must run in a container');
  assert.match(semgrepJob.container.image, /^semgrep\/semgrep:1\.186\.0@sha256:[0-9a-f]{64}$/, 'Semgrep container image must be pinned by immutable sha256 digest');
  const semgrepStep = semgrepJob.steps?.find(s => s.run && s.run.includes('semgrep scan'));
  assert.ok(semgrepStep, 'Semgrep job must execute semgrep scan step');
  assert.ok(semgrepStep.run.includes('--error'), 'Semgrep scan must fail on findings with --error');
  assert.ok(semgrepStep.run.includes('tools/ tests/ .github/workflows/ templates/'), 'Semgrep scan must target tools/ tests/ .github/workflows/ templates/');
  assert.ok(!semgrepStep.run.includes('--exclude'), 'Semgrep scan must not use --exclude argument to weaken scan');
  assert.ok(!semgrepStep.run.includes('|| true'), 'Semgrep step must not suppress errors with || true');

  // CodeQL checks
  const codeqlSteps = jobs.codeql.steps || [];
  const codeqlInit = codeqlSteps.find(s => s.uses && s.uses.startsWith('github/codeql-action/init'));
  assert.ok(codeqlInit, 'CodeQL job must initialise codeql-action/init');
  assert.equal(codeqlInit.with?.languages, 'javascript-typescript', 'CodeQL must analyze javascript-typescript');
  assert.equal(codeqlInit.with?.['build-mode'], 'none', 'CodeQL must specify build-mode: none');
  const codeqlAnalyze = codeqlSteps.find(s => s.uses && s.uses.startsWith('github/codeql-action/analyze'));
  assert.ok(codeqlAnalyze, 'CodeQL job must run codeql-action/analyze');

  // OSV checks
  const osvJob = jobs.osv;
  assert.ok(osvJob.uses && osvJob.uses.startsWith('google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@'), 'OSV job must call pinned reusable workflow');
  assert.strictEqual(osvJob.with?.['fail-on-vuln'], true, 'OSV scanner must set fail-on-vuln: true');
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
  validateWorkflowSecurity(parsed, 'consumer-security-scans.yml');
  assert.ok(text.includes('semgrep scan --config p/default --error --metrics=off .'));
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
  assert.throws(() => validateSecurityScansWorkflow(parsedArr), /must not use unapproved or self-hosted runner/);
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
