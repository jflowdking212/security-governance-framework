#!/usr/bin/env node

/**
 * Universal Security Standard (USS) - Reusable Consumer Workflow Validator
 *
 * Validates consumer CI workflow files (e.g. .github/workflows/consumer-security-scans.yml)
 * against mandatory structural security invariants, ensuring protections are not
 * weakened, bypassed, or removed by subsequent edits in consuming repositories.
 *
 * Enforces:
 *   - Strict action and reusable workflow allowlists with exact reviewed commit SHAs (F2)
 *   - Exact approved job identities, job-level permissions, and step sequences (F2)
 *   - Approved immutable container image and sha256 digest (F2)
 *   - Exact execution contracts rejecting arbitrary pipelines and failure masking (F3)
 *   - Strict environment allowlists rejecting execution-sensitive overrides (F4)
 *   - Complete rejection of .allowed-binaries and tracked binary content (F1)
 *
 * Usage:
 *   node tools/validate-consumer-workflow.mjs [--file <path-to-workflow>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPROVED_ACTIONS = new Map([
  ['actions/checkout', 'd23441a48e516b6c34aea4fa41551a30e30af803'],
  ['gitleaks/gitleaks-action', 'e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e'],
  ['github/codeql-action/init', '33d7b85da1a04171e211befe2c739303b9a4c066'],
  ['github/codeql-action/analyze', '33d7b85da1a04171e211befe2c739303b9a4c066']
]);

export const APPROVED_REUSABLE_WORKFLOWS = new Map([
  ['google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml', 'd3c1414ded37de590f207572e37a7d180f1d0ef7']
]);

export const APPROVED_CONTAINER_IMAGES = new Set([
  'semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493'
]);

export const SENSITIVE_EXECUTION_VARS = new Set([
  'BASH_ENV',
  'PATH',
  'NPM_CONFIG_IGNORE_SCRIPTS',
  'NODE_TLS_REJECT_UNAUTHORIZED',
  'GIT_CONFIG_COUNT',
  'NODE_OPTIONS',
  'NODE_PATH',
  'NODE_EXTRA_CA_CERTS',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'PYTHONPATH',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'PERL5LIB',
  'RUBYOPT',
  'IFS',
  'SHELLOPTS',
  'BASHOPTS',
  'ENV'
]);

const ALLOWED_WORKFLOW_KEYS = new Set(['name', 'on', 'true', 'permissions', 'jobs', 'defaults', 'concurrency']);
const APPROVED_JOB_IDS = new Set(['secrets', 'gitleaks', 'semgrep', 'codeql', 'osv']);
const APPROVED_SHELLS = new Set([
  'bash',
  'bash --noprofile --norc -eo pipefail {0}',
  'bash --noprofile --norc -e -o pipefail {0}'
]);
const UNTRUSTED_EXPRESSION_REGEX = /\$\{\{\s*(?:github(?:\s*\.\s*|\s*\[\s*['"])(?:event|head_ref|actor|ref_name|base_ref|ref|triggering_actor)\b|inputs(?:\s*\.\s*|\s*\[\s*['"]))/i;

const ALLOWED_SCANNER_JOB_KEYS = new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'container', 'steps']);
const ALLOWED_OSV_JOB_KEYS = new Set(['name', 'uses', 'with', 'permissions']);
const ALLOWED_STEP_KEYS = new Set(['name', 'uses', 'with', 'run', 'shell', 'env']);

function validateMandatoryJobControl(job, jobId, label) {
  if (job.if !== undefined) {
    throw new Error(`${label}: mandatory job '${jobId}' declares unapproved condition '${job.if}'; mandatory security jobs must not be conditional`);
  }
  if (job['continue-on-error'] !== undefined) {
    throw new Error(`${label}: mandatory job '${jobId}' must not define continue-on-error`);
  }
  if (job.needs !== undefined) {
    throw new Error(`${label}: mandatory job '${jobId}' must not define dependencies (needs: ...)`);
  }
  if (job.strategy !== undefined) {
    throw new Error(`${label}: mandatory job '${jobId}' must not define strategy matrix`);
  }
}

function validateMandatoryStepControl(step, index, jobId, label) {
  if (step.if !== undefined) {
    throw new Error(`${label}: mandatory step ${index} in job '${jobId}' declares unapproved condition '${step.if}'; mandatory security steps must not be conditional`);
  }
  if (step['continue-on-error'] !== undefined) {
    throw new Error(`${label}: mandatory step ${index} in job '${jobId}' must not define continue-on-error`);
  }
  for (const k of Object.keys(step)) {
    if (!ALLOWED_STEP_KEYS.has(k)) {
      throw new Error(`${label}: job '${jobId}' step ${index} contains unapproved key '${k}'`);
    }
  }
}

export function buildExpectedConsumerGuard() {
  return [
    'set -euo pipefail',
    'git -c safe.directory="$PWD" -c core.fsmonitor=false rev-parse --show-toplevel >/dev/null',
    'for file in .gitleaks.toml .gitleaksignore gitleaks.toml gitleaks.yaml gitleaks.yml .semgrep.yml .semgrep.yaml semgrep.yml semgrep.yaml codeql-config.yml codeql-config.yaml .github/codeql/codeql-config.yml .github/codeql/codeql-config.yaml osv-scanner.toml .osv-scanner.toml .allowed-binaries; do',
    '  if [ -e "$file" ]; then',
    "    printf 'Unreviewed scanner override is not permitted: %s\\n' \"$file\" >&2",
    '    exit 1',
    '  fi',
    'done',
    "nested_osv_config=\"$(find . -path './.git' -prune -o -path './node_modules' -prune -o \\( -name 'osv-scanner.toml' -o -name '.osv-scanner.toml' \\) -print)\"",
    'if [ -n "$nested_osv_config" ]; then',
    "  printf 'Unreviewed OSV configuration is not permitted: %s\\n' \"$nested_osv_config\" >&2",
    '  exit 1',
    'fi',
    'if git -c safe.directory="$PWD" -c core.fsmonitor=false grep -n -I -i -E \'[g]itleaks[[:space:]]*:[[:space:]]*allow\' -- . >&2; then',
    "  printf '%s\\n' 'Prohibited Gitleaks inline suppression directive is not permitted' >&2",
    '  exit 1',
    'else',
    '  status=$?',
    '  if [ "$status" -ne 1 ]; then',
    '    exit "$status"',
    '  fi',
    'fi',
    'if ! historical_suppression="$(git -c safe.directory="$PWD" -c core.fsmonitor=false log -n 1 -i -E -G\'[g]itleaks[[:space:]]*:[[:space:]]*allow\' --format=\'%H %s\')"; then',
    "  printf '%s\\n' 'Failed to inspect Git history for prohibited Gitleaks directives' >&2",
    '  exit 1',
    'fi',
    'if [ -n "$historical_suppression" ]; then',
    "  printf 'Prohibited Gitleaks inline suppression directive found in Git history: %s\\n' \"$historical_suppression\" >&2",
    '  exit 1',
    'fi',
    'while IFS= read -r attr_file; do',
    '  [ -z "$attr_file" ] && continue',
    '  if [ -L "$attr_file" ]; then',
    "    printf 'Symlinked .gitattributes is not permitted: %s\\n' \"$attr_file\" >&2",
    '    exit 1',
    '  fi',
    "  if grep -v '^[[:space:]]*#' \"$attr_file\" | grep -n -E '(^|[[:space:]])[-!]?(diff|binary|filter|merge)([[:space:]=]|$)' >&2; then",
    "    printf 'Prohibited .gitattributes configuration is not permitted: %s\\n' \"$attr_file\" >&2",
    '    exit 1',
    '  fi',
    "done < <(find . -path './.git' -prune -o -path './node_modules' -prune -o -name '.gitattributes' -print)",
    'if [ -e .git/info/attributes ]; then',
    "  if grep -v '^[[:space:]]*#' .git/info/attributes | grep -n -E '(^|[[:space:]])[-!]?(diff|binary|filter|merge)([[:space:]=]|$)' >&2; then",
    "    printf '%s\\n' 'Prohibited .git/info/attributes configuration is not permitted' >&2",
    '    exit 1',
    '  fi',
    'fi',
    "python3 - <<'EOF'",
    'import os',
    'import stat',
    'import subprocess',
    'import sys',
    '',
    'CHUNK_SIZE = 1024 * 1024',
    'ROOT = os.getcwd()',
    '',
    'SECURE_DIR_FD = (',
    '    os.open in getattr(os, "supports_dir_fd", set()) and',
    '    os.stat in getattr(os, "supports_dir_fd", set()) and',
    '    hasattr(os, "O_DIRECTORY") and',
    '    hasattr(os, "O_NOFOLLOW")',
    ')',
    '',
    'require_dir_fd = os.environ.get("USS_SCANNER_REQUIRE_DIR_FD") == "1" or "--require-dir-fd" in sys.argv',
    'if require_dir_fd and not SECURE_DIR_FD:',
    '    print(',
    '        f"FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: {sys.platform}",',
    '        file=sys.stderr,',
    '    )',
    '    sys.exit(2)',
    '',
    'try:',
    '    result = subprocess.run(',
    '        ["git", "-c", f"safe.directory={ROOT}", "-c", "core.fsmonitor=false", "ls-files", "-z"],',
    '        cwd=ROOT,',
    '        stdout=subprocess.PIPE,',
    '        stderr=subprocess.PIPE,',
    '        check=True,',
    '    )',
    'except (OSError, subprocess.CalledProcessError) as exc:',
    '    detail = getattr(exc, "stderr", b"")',
    '    print(f"FAIL CLOSED: cannot enumerate tracked files: {detail.decode(\'utf-8\', \'replace\')}", file=sys.stderr)',
    '    sys.exit(2)',
    '',
    'if SECURE_DIR_FD:',
    '    root_flags = os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_CLOEXEC", 0)',
    '    try:',
    '        root_fd = os.open(os.fsencode(ROOT), root_flags)',
    '    except OSError as exc:',
    '        print(f"FAIL CLOSED: cannot open repository root: {exc}", file=sys.stderr)',
    '        sys.exit(2)',
    '',
    '    try:',
    '        root_stat = os.fstat(root_fd)',
    '        if not stat.S_ISDIR(root_stat.st_mode):',
    '            print("FAIL CLOSED: repository root is not a directory", file=sys.stderr)',
    '            sys.exit(2)',
    '',
    '        for rel in result.stdout.split(b"\\0"):',
    '            if not rel:',
    '                continue',
    '',
    '            parts = rel.split(b"/")',
    '            for comp in parts:',
    '                if comp in (b".", b"..") or not comp:',
    '                    print(f"FAIL CLOSED: invalid path component in tracked path: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(2)',
    '',
    '            cur_fd = root_fd',
    '            close_fds = []',
    '            try:',
    '                for comp in parts[:-1]:',
    '                    dir_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)',
    '                    try:',
    '                        next_fd = os.open(comp, dir_flags, dir_fd=cur_fd)',
    '                    except OSError as exc:',
    '                        print(f"FAIL: parent directory component is a symbolic link or cannot be securely traversed: {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '                        sys.exit(1)',
    '                    close_fds.append(next_fd)',
    '                    next_stat = os.fstat(next_fd)',
    '                    if not stat.S_ISDIR(next_stat.st_mode):',
    '                        print(f"FAIL: parent component is not a directory: {os.fsdecode(rel)}", file=sys.stderr)',
    '                        sys.exit(1)',
    '                    cur_fd = next_fd',
    '',
    '                leaf = parts[-1]',
    '                try:',
    '                    leaf_stat = os.stat(leaf, dir_fd=cur_fd, follow_symlinks=False)',
    '                except OSError as exc:',
    '                    print(f"FAIL CLOSED: cannot stat tracked path {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '                    sys.exit(2)',
    '',
    '                if stat.S_ISLNK(leaf_stat.st_mode):',
    '                    continue',
    '',
    '                if not stat.S_ISREG(leaf_stat.st_mode):',
    '                    print(f"FAIL: tracked path is not a regular file or symlink: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(1)',
    '',
    '                file_flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)',
    '                try:',
    '                    file_fd = os.open(leaf, file_flags, dir_fd=cur_fd)',
    '                except OSError as exc:',
    '                    print(f"FAIL: cannot open tracked regular file {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '                    sys.exit(1)',
    '',
    '                try:',
    '                    opened_stat = os.fstat(file_fd)',
    '                    if not stat.S_ISREG(opened_stat.st_mode):',
    '                        print(f"FAIL: opened tracked path is not a regular file: {os.fsdecode(rel)}", file=sys.stderr)',
    '                        sys.exit(1)',
    '',
    '                    while True:',
    '                        chunk = os.read(file_fd, CHUNK_SIZE)',
    '                        if not chunk:',
    '                            break',
    '                        if b"\\0" in chunk:',
    '                            print("FAIL: tracked binary file contains NUL byte: " + os.fsdecode(rel), file=sys.stderr)',
    '                            sys.exit(1)',
    '                finally:',
    '                    os.close(file_fd)',
    '            finally:',
    '                for fd in close_fds:',
    '                    try:',
    '                        os.close(fd)',
    '                    except OSError:',
    '                        pass',
    '    finally:',
    '        os.close(root_fd)',
    'else:',
    '    root_bytes = os.fsencode(ROOT)',
    '    for rel in result.stdout.split(b"\\0"):',
    '        if not rel:',
    '            continue',
    '',
    '        parts = rel.split(b"/")',
    '        for comp in parts:',
    '            if comp in (b".", b"..") or not comp:',
    '                print(f"FAIL CLOSED: invalid path component in tracked path: {os.fsdecode(rel)}", file=sys.stderr)',
    '                sys.exit(2)',
    '',
    '        accum_path = root_bytes',
    '        for comp in parts[:-1]:',
    '            accum_path = os.path.join(accum_path, comp)',
    '            try:',
    '                comp_stat = os.lstat(accum_path)',
    '                is_reparse = bool(getattr(comp_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))',
    '                if stat.S_ISLNK(comp_stat.st_mode) or is_reparse or os.path.islink(accum_path):',
    '                    print(f"FAIL: parent directory component is a symbolic link: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(1)',
    '                if not stat.S_ISDIR(comp_stat.st_mode):',
    '                    print(f"FAIL: parent component is not a directory: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(1)',
    '            except OSError as exc:',
    '                print(f"FAIL CLOSED: cannot inspect parent directory component: {exc}", file=sys.stderr)',
    '                sys.exit(2)',
    '',
    '        target_path = os.path.join(root_bytes, rel)',
    '        try:',
    '            leaf_stat = os.lstat(target_path)',
    '            is_leaf_reparse = bool(getattr(leaf_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))',
    '            if stat.S_ISLNK(leaf_stat.st_mode) or is_leaf_reparse or os.path.islink(target_path):',
    '                continue',
    '            if not stat.S_ISREG(leaf_stat.st_mode):',
    '                print(f"FAIL: tracked path is not a regular file or symlink: {os.fsdecode(rel)}", file=sys.stderr)',
    '                sys.exit(1)',
    '',
    '            flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)',
    '            fd = os.open(target_path, flags)',
    '            try:',
    '                opened_stat = os.fstat(fd)',
    '                if not stat.S_ISREG(opened_stat.st_mode):',
    '                    print(f"FAIL: opened tracked path is not a regular file: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(1)',
    '                while True:',
    '                    chunk = os.read(fd, CHUNK_SIZE)',
    '                    if not chunk:',
    '                        break',
    '                    if b"\\0" in chunk:',
    '                        print("FAIL: tracked binary file contains NUL byte: " + os.fsdecode(rel), file=sys.stderr)',
    '                        sys.exit(1)',
    '            finally:',
    '                os.close(fd)',
    '        except OSError as exc:',
    '            print(f"FAIL CLOSED: cannot inspect tracked path {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '            sys.exit(2)',
    '',
    'print("PASS: complete content scan found no NUL bytes in tracked regular files")',
    'EOF',
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
    'done < <(git -c safe.directory="$PWD" -c core.fsmonitor=false ls-files -z)',
    'if [ "$target_count" -eq 0 ]; then',
    "  printf '%s\\n' 'No tracked files found for Semgrep scan' >&2",
    '  exit 1',
    'fi'
  ].join('\n');
}

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

function assertExactObject(actual, expected, context) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${context}: configuration mismatch. Expected ${expectedStr}, got ${actualStr}`);
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

  // 5. Environment allowlist at workflow level: none allowed (F4)
  if (parsed.env && Object.keys(parsed.env).length > 0) {
    throw new Error(`${label}: workflow-level env is not permitted`);
  }

  // 6. Mandatory exact jobs (F2)
  const jobs = parsed.jobs || {};
  const jobKeys = Object.keys(jobs);
  if (jobKeys.length !== 4) {
    throw new Error(`${label}: must declare exactly 4 security scanner jobs (secrets, semgrep, codeql, osv), got ${jobKeys.length}`);
  }
  for (const jId of jobKeys) {
    if (!APPROVED_JOB_IDS.has(jId)) {
      throw new Error(`${label}: unapproved job '${jId}' is not permitted`);
    }
  }
  const secretJobId = jobs.secrets ? 'secrets' : (jobs.gitleaks ? 'gitleaks' : null);
  if (!secretJobId) throw new Error(`${label}: missing required secret scan job ('secrets' or 'gitleaks')`);
  for (const req of [secretJobId, 'semgrep', 'codeql', 'osv']) {
    if (!jobs[req]) throw new Error(`${label}: missing required job '${req}'`);
  }

  // 7. Validate Secrets / Gitleaks job (F2, F3, F4, F6)
  const secJob = jobs[secretJobId];
  validateMandatoryJobControl(secJob, secretJobId, label);
  for (const k of Object.keys(secJob)) {
    if (!ALLOWED_SCANNER_JOB_KEYS.has(k)) {
      throw new Error(`${label}: job '${secretJobId}' contains unapproved key '${k}'`);
    }
  }
  if (secJob['runs-on'] !== 'ubuntu-latest') throw new Error(`${label}: ${secretJobId} job runs-on must be 'ubuntu-latest'`);
  if (!Number.isInteger(secJob['timeout-minutes']) || secJob['timeout-minutes'] <= 0) throw new Error(`${label}: ${secretJobId} job must set positive timeout-minutes`);
  assertExactObject(secJob.permissions, { contents: 'read', 'pull-requests': 'read' }, `${label} ${secretJobId} permissions`);
  if (secJob.env && Object.keys(secJob.env).length > 0) throw new Error(`${label}: ${secretJobId} job-level env is not permitted`);
  if (secJob.services) throw new Error(`${label}: ${secretJobId} job must not declare services`);
  if (secJob.container) throw new Error(`${label}: ${secretJobId} job must not declare a container`);

  const secSteps = secJob.steps || [];
  if (secSteps.length !== 3) {
    throw new Error(`${label}: ${secretJobId} job must contain exactly 3 steps (checkout, config guard, scan), got ${secSteps.length}`);
  }
  for (let i = 0; i < secSteps.length; i++) {
    validateMandatoryStepControl(secSteps[i], i, secretJobId, label);
  }

  // Step 0: Checkout
  const secStep0 = secSteps[0];
  if (secStep0.uses !== `actions/checkout@${APPROVED_ACTIONS.get('actions/checkout')}`) {
    throw new Error(`${label}: ${secretJobId} checkout step must use pinned action 'actions/checkout@${APPROVED_ACTIONS.get('actions/checkout')}', got '${secStep0.uses}'`);
  }
  assertExactObject(secStep0.with, { 'fetch-depth': 0, 'persist-credentials': false }, `${label} ${secretJobId} checkout inputs`);
  if (secStep0.env) throw new Error(`${label}: ${secretJobId} checkout step must not define env`);

  // Step 1: Config guard
  const secStep1 = secSteps[1];
  if (secStep1.name !== 'Reject unreviewed scanner configuration') {
    throw new Error(`${label}: ${secretJobId} step 1 must be named 'Reject unreviewed scanner configuration'`);
  }
  if (secStep1.shell !== 'bash') throw new Error(`${label}: ${secretJobId} config guard must use bash`);
  if (secStep1.run?.trim() !== buildExpectedConsumerGuard().trim()) {
    throw new Error(`${label}: ${secretJobId} config guard must execute the exact canonical fail-closed guard script`);
  }
  if (secStep1.env) throw new Error(`${label}: ${secretJobId} config guard step must not define env`);

  // Step 2: Gitleaks scan
  const secStep2 = secSteps[2];
  if (secStep2.uses !== `gitleaks/gitleaks-action@${APPROVED_ACTIONS.get('gitleaks/gitleaks-action')}`) {
    throw new Error(`${label}: ${secretJobId} scan step must use pinned action 'gitleaks/gitleaks-action@${APPROVED_ACTIONS.get('gitleaks/gitleaks-action')}', got '${secStep2.uses}'`);
  }
  assertExactObject(secStep2.env, {
    GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    GITLEAKS_ENABLE_COMMENTS: 'false',
    GITLEAKS_ENABLE_UPLOAD_ARTIFACT: 'false'
  }, `${label} ${secretJobId} scan env`);
  if (secStep2.with) throw new Error(`${label}: ${secretJobId} scan step must not define inputs`);

  // 8. Validate Semgrep job (F2, F3, F4, F6)
  const semJob = jobs.semgrep;
  validateMandatoryJobControl(semJob, 'semgrep', label);
  for (const k of Object.keys(semJob)) {
    if (!ALLOWED_SCANNER_JOB_KEYS.has(k)) {
      throw new Error(`${label}: job 'semgrep' contains unapproved key '${k}'`);
    }
  }
  if (semJob['runs-on'] !== 'ubuntu-latest') throw new Error(`${label}: semgrep job runs-on must be 'ubuntu-latest'`);
  if (!Number.isInteger(semJob['timeout-minutes']) || semJob['timeout-minutes'] <= 0) throw new Error(`${label}: semgrep job must set positive timeout-minutes`);
  if (semJob.permissions !== undefined) throw new Error(`${label}: semgrep job must inherit read-only workflow permissions`);
  if (semJob.env && Object.keys(semJob.env).length > 0) throw new Error(`${label}: semgrep job-level env is not permitted`);
  if (semJob.services) throw new Error(`${label}: semgrep job must not declare services`);
  if (!APPROVED_CONTAINER_IMAGES.has(semJob.container?.image)) {
    throw new Error(`${label}: semgrep container image must be exactly 'semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493'`);
  }

  const semSteps = semJob.steps || [];
  if (semSteps.length !== 3) {
    throw new Error(`${label}: semgrep job must contain exactly 3 steps (checkout, config guard, scan), got ${semSteps.length}`);
  }
  for (let i = 0; i < semSteps.length; i++) {
    validateMandatoryStepControl(semSteps[i], i, 'semgrep', label);
  }

  // Step 0: Checkout
  const semStep0 = semSteps[0];
  if (semStep0.uses !== `actions/checkout@${APPROVED_ACTIONS.get('actions/checkout')}`) {
    throw new Error(`${label}: semgrep checkout step must use pinned action 'actions/checkout@${APPROVED_ACTIONS.get('actions/checkout')}', got '${semStep0.uses}'`);
  }
  assertExactObject(semStep0.with, { 'persist-credentials': false }, `${label} semgrep checkout inputs`);
  if (semStep0.env) throw new Error(`${label}: semgrep checkout step must not define env`);

  // Step 1: Config guard
  const semStep1 = semSteps[1];
  if (semStep1.name !== 'Reject unreviewed scanner configuration') {
    throw new Error(`${label}: semgrep step 1 must be named 'Reject unreviewed scanner configuration'`);
  }
  if (semStep1.shell !== 'bash') throw new Error(`${label}: semgrep config guard must use bash`);
  if (semStep1.run?.trim() !== buildExpectedConsumerGuard().trim()) {
    throw new Error(`${label}: semgrep config guard must execute the exact canonical fail-closed guard script`);
  }
  if (semStep1.env) throw new Error(`${label}: semgrep config guard step must not define env`);

  // Step 2: Semgrep scan execution contract (F3)
  const semStep2 = semSteps[2];
  const expectedSemgrepCommand = 'semgrep scan --config p/default --error --strict --disable-nosem --metrics=off .';
  if (semStep2.run?.trim() !== expectedSemgrepCommand) {
    throw new Error(`${label}: semgrep scan command violates strict execution contract; expected '${expectedSemgrepCommand}', got '${semStep2.run?.trim()}'`);
  }
  assertExactObject(semStep2.env, { SEMGREP_SEND_METRICS: 'off' }, `${label} semgrep scan env`);
  if (semStep2.with) throw new Error(`${label}: semgrep scan step must not define inputs`);

  // 9. Validate CodeQL job (F2, F4, F6)
  const codeJob = jobs.codeql;
  validateMandatoryJobControl(codeJob, 'codeql', label);
  for (const k of Object.keys(codeJob)) {
    if (!ALLOWED_SCANNER_JOB_KEYS.has(k)) {
      throw new Error(`${label}: job 'codeql' contains unapproved key '${k}'`);
    }
  }
  if (codeJob['runs-on'] !== 'ubuntu-latest') throw new Error(`${label}: codeql job runs-on must be 'ubuntu-latest'`);
  if (!Number.isInteger(codeJob['timeout-minutes']) || codeJob['timeout-minutes'] <= 0) throw new Error(`${label}: codeql job must set positive timeout-minutes`);
  assertExactObject(codeJob.permissions, {
    actions: 'read',
    contents: 'read',
    'security-events': 'write'
  }, `${label} codeql permissions`);
  if (codeJob.env && Object.keys(codeJob.env).length > 0) throw new Error(`${label}: codeql job-level env is not permitted`);
  if (codeJob.services) throw new Error(`${label}: codeql job must not declare services`);
  if (codeJob.container) throw new Error(`${label}: codeql job must not declare a container`);

  const codeSteps = codeJob.steps || [];
  if (codeSteps.length !== 3) {
    throw new Error(`${label}: codeql job must contain exactly 3 steps (checkout, init, analyze), got ${codeSteps.length}`);
  }
  for (let i = 0; i < codeSteps.length; i++) {
    validateMandatoryStepControl(codeSteps[i], i, 'codeql', label);
  }

  // Step 0: Checkout
  const codeStep0 = codeSteps[0];
  if (codeStep0.uses !== `actions/checkout@${APPROVED_ACTIONS.get('actions/checkout')}`) {
    throw new Error(`${label}: codeql checkout step must use pinned action 'actions/checkout@${APPROVED_ACTIONS.get('actions/checkout')}', got '${codeStep0.uses}'`);
  }
  assertExactObject(codeStep0.with, { 'persist-credentials': false }, `${label} codeql checkout inputs`);
  if (codeStep0.env) throw new Error(`${label}: codeql checkout step must not define env`);

  // Step 1: CodeQL Init
  const codeStep1 = codeSteps[1];
  if (codeStep1.uses !== `github/codeql-action/init@${APPROVED_ACTIONS.get('github/codeql-action/init')}`) {
    throw new Error(`${label}: codeql init step must use pinned action 'github/codeql-action/init@${APPROVED_ACTIONS.get('github/codeql-action/init')}', got '${codeStep1.uses}'`);
  }
  if (!codeStep1.with || typeof codeStep1.with !== 'object') {
    throw new Error(`${label}: codeql init step must configure inputs`);
  }
  for (const k of Object.keys(codeStep1.with)) {
    if (k !== 'languages' && k !== 'build-mode') {
      throw new Error(`${label}: codeql init step contains unapproved input '${k}'`);
    }
  }
  if (typeof codeStep1.with.languages !== 'string' || !codeStep1.with.languages.trim()) {
    throw new Error(`${label}: codeql init step must specify languages string`);
  }
  if (codeStep1.env) throw new Error(`${label}: codeql init step must not define env`);

  // Step 2: CodeQL Analyze
  const codeStep2 = codeSteps[2];
  if (codeStep2.uses !== `github/codeql-action/analyze@${APPROVED_ACTIONS.get('github/codeql-action/analyze')}`) {
    throw new Error(`${label}: codeql analyze step must use pinned action 'github/codeql-action/analyze@${APPROVED_ACTIONS.get('github/codeql-action/analyze')}', got '${codeStep2.uses}'`);
  }
  if (codeStep2.with) throw new Error(`${label}: codeql analyze step must not define inputs`);
  if (codeStep2.env) throw new Error(`${label}: codeql analyze step must not define env`);

  // 10. Validate OSV job (F2, F4, F6)
  const osvJob = jobs.osv;
  validateMandatoryJobControl(osvJob, 'osv', label);
  assertExactObject(osvJob.permissions, {
    actions: 'read',
    contents: 'read',
    'security-events': 'write'
  }, `${label} osv permissions`);
  const expectedOsvRef = `google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@${APPROVED_REUSABLE_WORKFLOWS.get('google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml')}`;
  if (osvJob.uses !== expectedOsvRef) {
    throw new Error(`${label}: osv job must use pinned reusable workflow '${expectedOsvRef}', got '${osvJob.uses}'`);
  }
  assertExactObject(osvJob.with, {
    'fail-on-vuln': true,
    'upload-sarif': true
  }, `${label} osv reusable workflow inputs`);
  for (const k of Object.keys(osvJob)) {
    if (!ALLOWED_OSV_JOB_KEYS.has(k)) {
      throw new Error(`${label}: osv reusable job must not override '${k}'`);
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
