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
  /;\s*true\b/
];

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
  // 1. Workflow-level permissions must be least privilege (read-only, no write permissions)
  if (parsed.permissions) {
    if (typeof parsed.permissions === 'string') {
      assert.notEqual(parsed.permissions, 'write-all', `${label} must not use write-all permissions`);
      assert.equal(parsed.permissions, 'read-all', `${label} string permissions must be read-all`);
    } else if (typeof parsed.permissions === 'object') {
      for (const [scope, perm] of Object.entries(parsed.permissions)) {
        assert.notEqual(perm, 'write', `${label} workflow-level permissions must not grant write access to ${scope}`);
      }
    }
  }

  // 2. Reject pull_request_target and workflow_run
  const triggers = parsed.on || parsed['true'] || {};
  if (typeof triggers === 'object' && triggers !== null) {
    assert.equal(triggers.pull_request_target, undefined, `${label} must not use pull_request_target`);
    assert.equal(triggers.workflow_run, undefined, `${label} must not use workflow_run`);
    if (Array.isArray(triggers)) {
      assert.ok(!triggers.includes('pull_request_target'), `${label} must not include pull_request_target`);
      assert.ok(!triggers.includes('workflow_run'), `${label} must not include workflow_run`);
    }
  }

  // 3. Actions must be pinned to 40-character SHAs
  assertPinnedActions(parsed, label);

  // 4. Job and step level inspections
  const jobs = parsed.jobs || {};
  assert.ok(Object.keys(jobs).length > 0, `${label} must define at least one job`);

  for (const [jobId, job] of Object.entries(jobs)) {
    // continue-on-error forbidden on security jobs
    assert.ok(!job['continue-on-error'], `${label} job ${jobId} must not have continue-on-error: true`);

    // Execution timeout-minutes required for all runner jobs
    if (job['runs-on']) {
      assert.ok(typeof job['timeout-minutes'] === 'number' && job['timeout-minutes'] > 0, `${label} job ${jobId} must specify a positive timeout-minutes`);
    }

    const steps = job.steps || [];
    for (const [i, step] of steps.entries()) {
      assert.ok(!step['continue-on-error'], `${label} job ${jobId} step ${i} (${step.name || 'unnamed'}) must not have continue-on-error: true`);

      // Checkout persist-credentials must be false
      if (step.uses && step.uses.startsWith('actions/checkout')) {
        assert.ok(step.with, `${label} checkout step ${i} must provide 'with' configuration`);
        assert.strictEqual(step.with['persist-credentials'], false, `${label} checkout step ${i} must set persist-credentials: false`);
      }

      // Check run commands
      if (step.run) {
        // Reject direct github.event expression interpolation in run: scripts
        assert.ok(!/\$\{\{\s*github\.event/i.test(step.run), `${label} step ${i} contains forbidden direct github.event expression interpolation: ${step.run}`);

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
  
  // Drift gate step verification
  const moduleDriftStep = steps.find(s => s.run && s.run.includes('git diff --exit-code -- modules/'));
  assert.ok(moduleDriftStep, 'uss-validation.yml must enforce git diff --exit-code -- modules/');
  assert.ok(!moduleDriftStep.run.includes('|| true'), 'Module drift gate must not suppress errors');

  const indexDriftStep = steps.find(s => s.run && s.run.includes('git diff --exit-code -- MODULE-INDEX.md bundles/'));
  assert.ok(indexDriftStep, 'uss-validation.yml must enforce git diff --exit-code -- MODULE-INDEX.md bundles/');
  assert.ok(!indexDriftStep.run.includes('|| true'), 'Index drift gate must not suppress errors');

  // Node 20 verification
  const setupNodeStep = steps.find(s => s.uses && s.uses.startsWith('actions/setup-node'));
  assert.ok(setupNodeStep, 'uss-validation.yml must use actions/setup-node');
  const nodeVersion = String(setupNodeStep.with?.['node-version']);
  assert.equal(nodeVersion, '20', 'uss-validation.yml must enforce Node.js version 20');

  // Test and evidence steps
  const testStep = steps.find(s => s.run && s.run.includes('node --test tests/*.test.mjs'));
  assert.ok(testStep, 'uss-validation.yml must run test suite');
  assert.ok(!testStep.run.includes('|| true'), 'Test step must not suppress errors');

  const evidenceStep = steps.find(s => s.run && s.run.includes('validate-evidence.mjs'));
  assert.ok(evidenceStep, 'uss-validation.yml must run validate-evidence.mjs');
  assert.ok(!evidenceStep.run.includes('|| true'), 'Evidence validation step must not suppress errors');
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
  assert.ok(semgrepStep.run.includes('tools/ tests/'), 'Semgrep scan must target tools/ tests/');
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

// Negative Regression Tests (Rejecting the 10 weakenings identified by Claude)

test('negative: rejects removal of generated-module drift gate', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps = parsed.jobs.validate.steps.filter(s => !s.run || !s.run.includes('git diff --exit-code -- modules/'));
  assert.throws(() => validateUssValidationWorkflow(parsed), /must enforce git diff --exit-code -- modules\//);
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
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must not use pull_request_target/);
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
  assert.throws(() => validateUssValidationWorkflow(parsed), /contains forbidden direct github\.event expression interpolation/);
});

test('negative: rejects workflow_run trigger', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.on = { workflow_run: { workflows: ['CI'] } };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must not (use|include) workflow_run/);
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
