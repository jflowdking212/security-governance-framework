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
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
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
      assert.match(result.stdout + result.stderr, new RegExp('Missing required scanner workflow ' + workflow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
}
