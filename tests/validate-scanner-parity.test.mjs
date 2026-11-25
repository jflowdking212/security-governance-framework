import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cleanEnv = () => {
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  return env;
};
const run = (cwd, ...args) => spawnSync(process.execPath, args, {
  cwd,
  encoding: 'utf8',
  env: cleanEnv(),
});
const SCANNER = 'tools/uss-tracked-binary-scanner.py';
const WORKFLOWS = [
  '.github/workflows/security-scans.yml',
  'templates/ci/consumer-security-scans.yml',
];

function copyTree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-validator-'));
  const listed = spawnSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(listed.status, 0, 'git ls-files failed');
  for (const file of listed.stdout.split('\0').filter(Boolean)) {
    const destination = path.join(dir, file);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(ROOT, file), destination);
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const generator of ['build-modules', 'build-indexes', 'build-bundles']) {
    const result = run(dir, `tools/${generator}.mjs`);
    assert.equal(result.status, 0, `${generator} failed in scratch copy: ${result.stderr}`);
  }
  return dir;
}

const validate = dir => run(dir, 'tools/validate.mjs');

const headerMutations = [
  ['early exit before import os', source => source.replace(
    '\nimport os\n',
    '\nimport sys; sys.exit(0)\nimport os\n',
  )],
  ['executable payload before import os', source => source.replace(
    '\nimport os\n',
    '\nexec("pass")\nimport os\n',
  )],
  ['noncanonical shebang', source => source.replace(
    '#!/usr/bin/env python3',
    '#!/usr/bin/env python',
  )],
  ['code between shebang and module docstring', source => source.replace(
    '#!/usr/bin/env python3\n',
    '#!/usr/bin/env python3\nimport sys\n',
  )],
];

for (const [name, mutate] of headerMutations) {
  test('validate.mjs rejects scanner header mutation: ' + name, () => {
    const dir = copyTree();
    try {
      const file = path.join(dir, SCANNER);
      const before = fs.readFileSync(file, 'utf8');
      const after = mutate(before);
      assert.notEqual(after, before, 'mutation did not apply');
      fs.writeFileSync(file, after);
      const result = validate(dir);
      assert.notEqual(result.status, 0, 'validator accepted the mutated scanner header');
      assert.match(result.stdout + result.stderr, /unexpected content before import os|missing import os/i);
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
}

for (const workflow of WORKFLOWS) {
  test('validate.mjs fails closed when required workflow is missing: ' + workflow, () => {
    const dir = copyTree();
    try {
      fs.rmSync(path.join(dir, workflow));
      const result = validate(dir);
      assert.notEqual(result.status, 0, 'validator silently accepted a missing workflow');
      assert.ok((result.stdout + result.stderr).includes('Missing required scanner workflow ' + workflow));
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  for (const occurrence of [1, 2]) {
    test(`validate.mjs rejects embedded scanner divergence in ${workflow} (occurrence ${occurrence})`, () => {
      const dir = copyTree();
      try {
        const file = path.join(dir, workflow);
        const before = fs.readFileSync(file, 'utf8');
        const parts = before.split('if index_mode == b"120000":');
        assert.equal(parts.length, 3, `${workflow} must contain 2 embedded SCAN-S6 checks`);
        const after = occurrence === 1
          ? parts[0] + 'if False:' + parts[1] + 'if index_mode == b"120000":' + parts[2]
          : parts[0] + 'if index_mode == b"120000":' + parts[1] + 'if False:' + parts[2];
        fs.writeFileSync(file, after);
        const result = validate(dir);
        assert.notEqual(result.status, 0, `validator accepted mutated ${workflow} occurrence ${occurrence}`);
        assert.ok((result.stdout + result.stderr).includes(`differs from embedded copy in ${workflow} (occurrence ${occurrence})`));
      } finally {
        fs.rmSync(dir, {recursive: true, force: true});
      }
    });
  }
}

test('validate.mjs rejects divergence in validate-consumer-workflow expected guard', () => {
  const dir = copyTree();
  try {
    const file = path.join(dir, 'tools/validate-consumer-workflow.mjs');
    const before = fs.readFileSync(file, 'utf8');
    const after = before.replace('"ls-files", "-s", "-z"', '"ls-files", "-z"');
    assert.notEqual(after, before);
    fs.writeFileSync(file, after);
    const result = validate(dir);
    assert.notEqual(result.status, 0, 'validator accepted mutated buildExpectedConsumerGuard');
    assert.ok((result.stdout + result.stderr).includes('differs from buildExpectedConsumerGuard()'));
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
});
