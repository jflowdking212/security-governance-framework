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
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_EXEC_PATH',
  'GIT_OBJECT_DIRECTORY',
  'GIT_SSH_COMMAND',
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
const APPROVED_TRIGGERS = new Set(['push', 'pull_request', 'schedule', 'workflow_dispatch']);
const FORBIDDEN_TRIGGER_FILTER_KEYS = new Set(['branches-ignore', 'tags', 'tags-ignore', 'paths', 'paths-ignore', 'types']);
const APPROVED_JOB_IDS = new Set(['secrets', 'gitleaks', 'semgrep', 'codeql', 'osv']);
const APPROVED_SHELLS = new Set([
  'bash',
  'bash --noprofile --norc -eo pipefail {0}',
  'bash --noprofile --norc -e -o pipefail {0}'
]);
const APPROVED_BUILD_MODES = new Set(['none', 'autobuild', 'manual']);
const EXPRESSION_SPAN_REGEX = /\$\{\{([\s\S]*?)\}\}/g;
const UNTRUSTED_CONTEXT_REGEX = /\b(?:github(?:\s*\.\s*(?:event|event_path|head_ref|actor|ref_name|base_ref|ref|triggering_actor)\b|\s*\[|\s*(?:[,)\]}]|$))|inputs\b)/i;

const ALLOWED_SCANNER_JOB_KEYS = new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'container', 'steps']);
const ALLOWED_OSV_JOB_KEYS = new Set(['name', 'uses', 'with', 'permissions']);
const ALLOWED_STEP_KEYS = new Set(['name', 'uses', 'with', 'run', 'shell', 'env']);

function hasUntrustedExpression(text) {
  EXPRESSION_SPAN_REGEX.lastIndex = 0;
  let match;
  while ((match = EXPRESSION_SPAN_REGEX.exec(text)) !== null) {
    if (UNTRUSTED_CONTEXT_REGEX.test(match[1])) {
      return true;
    }
  }
  return false;
}

function assertNoUntrustedExpressions(value, context, label) {
  if (typeof value === 'string') {
    if (hasUntrustedExpression(value)) {
      throw new Error(`${label}: ${context} contains forbidden untrusted GitHub context: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoUntrustedExpressions(value[i], `${context}[${i}]`, label);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      assertNoUntrustedExpressions(key, `${context} key '${key}'`, label);
      assertNoUntrustedExpressions(item, `${context}.${key}`, label);
    }
  }
}

function validateBranchTrigger(config, event, label) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${label}: trigger '${event}' must configure branch filters`);
  }
  assertNoUntrustedExpressions(config, `trigger '${event}'`, label);
  for (const key of Object.keys(config)) {
    if (FORBIDDEN_TRIGGER_FILTER_KEYS.has(key) || key !== 'branches') {
      throw new Error(`${label}: trigger '${event}' declares unapproved filter key '${key}'`);
    }
  }
  if (!Array.isArray(config.branches) || config.branches.length === 0) {
    throw new Error(`${label}: trigger '${event}' must declare a non-empty branches allowlist`);
  }
  for (const pattern of config.branches) {
    if (typeof pattern !== 'string' || !pattern.trim() || pattern.trim().startsWith('!')) {
      throw new Error(`${label}: trigger '${event}' branches pattern '${pattern}' must be a non-negated branch pattern`);
    }
  }
}

function validateMandatoryJobControl(job, jobId, label) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    throw new Error(`${label}: job '${jobId}' must be an object`);
  }
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
  assertNoUntrustedExpressions(job.name, `job '${jobId}' name`, label);
}

function validateMandatoryStepControl(step, index, jobId, label) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new Error(`${label}: job '${jobId}' step ${index} must be an object`);
  }
  if (step.if !== undefined) {
    throw new Error(`${label}: mandatory step ${index} in job '${jobId}' declares unapproved condition '${step.if}'; mandatory security steps must not be conditional`);
  }
  if (step['continue-on-error'] !== undefined) {
    throw new Error(`${label}: mandatory step ${index} in job '${jobId}' must not define continue-on-error`);
  }
  if (step.uses !== undefined && step.run !== undefined) {
    throw new Error(`${label}: job '${jobId}' step ${index} must not combine both 'uses' and 'run'`);
  }
  if (step.uses !== undefined && step.shell !== undefined) {
    throw new Error(`${label}: job '${jobId}' step ${index} using 'uses' must not specify shell`);
  }
  if (step.shell !== undefined) {
    if (typeof step.shell !== 'string' || !APPROVED_SHELLS.has(step.shell.trim())) {
      throw new Error(`${label}: job '${jobId}' step ${index} specifies unapproved shell '${step.shell}'`);
    }
  }
  for (const k of Object.keys(step)) {
    if (!ALLOWED_STEP_KEYS.has(k)) {
      throw new Error(`${label}: job '${jobId}' step ${index} contains unapproved key '${k}'`);
    }
  }
  assertNoUntrustedExpressions(step.name, `job '${jobId}' step ${index} name`, label);
  assertNoUntrustedExpressions(step.with, `job '${jobId}' step ${index} with`, label);
  assertNoUntrustedExpressions(step.env, `job '${jobId}' step ${index} env`, label);
  assertNoUntrustedExpressions(step.run, `job '${jobId}' step ${index} run`, label);
}

export function buildExpectedConsumerGuard() {
  return [
    'set -euo pipefail',
    'while IFS= read -r var_line; do',
    '  case "$var_line" in',
    '    [Gg][Ii][Tt]_*) unset "${var_line%%=*}" ;;',
    '  esac',
    'done < <(env)',
    'git -c safe.directory="$PWD" -c core.fsmonitor=false rev-parse --show-toplevel >/dev/null',
    'for file in .gitleaks.toml .gitleaksignore gitleaks.toml gitleaks.yaml gitleaks.yml .semgrep.yml .semgrep.yaml semgrep.yml semgrep.yaml codeql-config.yml codeql-config.yaml .github/codeql/codeql-config.yml .github/codeql/codeql-config.yaml osv-scanner.toml .osv-scanner.toml .allowed-binaries; do',
    '  if [ -e "$file" ] || [ -L "$file" ]; then',
    '    printf \'Unreviewed scanner override is not permitted: %s\\n\' "$file" >&2',
    '    exit 1',
    '  fi',
    'done',
    'nested_osv_config="$(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o \\( -name \'osv-scanner.toml\' -o -name \'.osv-scanner.toml\' \\) -print)"',
    'if [ -n "$nested_osv_config" ]; then',
    '  printf \'Unreviewed OSV configuration is not permitted: %s\\n\' "$nested_osv_config" >&2',
    '  exit 1',
    'fi',
    'nested_scanner_override="$(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o \\( -name \'.gitleaks.toml\' -o -name \'.gitleaksignore\' -o -name \'gitleaks.toml\' -o -name \'gitleaks.yaml\' -o -name \'gitleaks.yml\' -o -name \'.semgrep.yml\' -o -name \'.semgrep.yaml\' -o -name \'semgrep.yml\' -o -name \'semgrep.yaml\' -o -name \'codeql-config.yml\' -o -name \'codeql-config.yaml\' -o -name \'.allowed-binaries\' \\) -print)"',
    'if [ -n "$nested_scanner_override" ]; then',
    '  printf \'Unreviewed scanner override is not permitted: %s\\n\' "$nested_scanner_override" >&2',
    '  exit 1',
    'fi',
    'if git -c safe.directory="$PWD" -c core.fsmonitor=false grep -n -I -i -E \'[g]itleaks[[:space:]]*:[[:space:]]*allow\' -- . >&2; then',
    '  printf \'%s\\n\' \'Prohibited Gitleaks inline suppression directive is not permitted\' >&2',
    '  exit 1',
    'else',
    '  status=$?',
    '  if [ "$status" -ne 1 ]; then',
    '    exit "$status"',
    '  fi',
    'fi',
    'if ! historical_suppression="$(git -c safe.directory="$PWD" -c core.fsmonitor=false log -n 1 -i -E -G\'[g]itleaks[[:space:]]*:[[:space:]]*allow\' --format=\'%H %s\')"; then',
    '  printf \'%s\\n\' \'Failed to inspect Git history for prohibited Gitleaks directives\' >&2',
    '  exit 1',
    'fi',
    'if [ -n "$historical_suppression" ]; then',
    '  printf \'Prohibited Gitleaks inline suppression directive found in Git history: %s\\n\' "$historical_suppression" >&2',
    '  exit 1',
    'fi',
    'while IFS= read -r attr_file; do',
    '  [ -z "$attr_file" ] && continue',
    '  if [ -L "$attr_file" ]; then',
    '    printf \'Symlinked .gitattributes is not permitted: %s\\n\' "$attr_file" >&2',
    '    exit 1',
    '  fi',
    '  if grep -v \'^[[:space:]]*#\' "$attr_file" | grep -n -E \'(^|[[:space:]])(?:[-!]?(?:diff|binary|filter|merge)|[-!]text)([[:space:]=]|$)\' >&2; then',
    '    printf \'Prohibited .gitattributes configuration is not permitted: %s\\n\' "$attr_file" >&2',
    '    exit 1',
    '  fi',
    'done < <(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o -name \'.gitattributes\' -print)',
    'if [ -L .git/info/attributes ]; then',
    '  printf \'%s\\n\' \'Symlinked .git/info/attributes is not permitted\' >&2',
    '  exit 1',
    'fi',
    'if [ -e .git/info/attributes ]; then',
    '  if grep -v \'^[[:space:]]*#\' .git/info/attributes | grep -n -E \'(^|[[:space:]])(?:[-!]?(?:diff|binary|filter|merge)|[-!]text)([[:space:]=]|$)\' >&2; then',
    '    printf \'%s\\n\' \'Prohibited .git/info/attributes configuration is not permitted\' >&2',
    '    exit 1',
    '  fi',
    'fi',
    'python3 - <<\'EOF\'',
    'import os',
    'import stat',
    'import subprocess',
    'import sys',
    'import tempfile',
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
    'if not SECURE_DIR_FD:',
    '    print(',
    '        f"FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: {sys.platform}",',
    '        file=sys.stderr,',
    '    )',
    '    sys.exit(2)',
    '',
    'def resolve_trusted_git(clean_env, candidate_dirs=None):',
    '    untrusted_prefixes = [',
    '        os.path.realpath(ROOT),',
    '        os.path.realpath(tempfile.gettempdir()),',
    '    ]',
    '    for v in (',
    '        "RUNNER_TEMP",',
    '        "TEMP",',
    '        "TMP",',
    '        "TMPDIR",',
    '        "USERPROFILE",',
    '        "HOME",',
    '        "HOMEPATH",',
    '        "LOCALAPPDATA",',
    '        "APPDATA",',
    '    ):',
    '        val = os.environ.get(v)',
    '        if val:',
    '            try:',
    '                untrusted_prefixes.append(os.path.realpath(val))',
    '            except Exception:',
    '                pass',
    '    try:',
    '        user_home = os.path.realpath(os.path.expanduser("~"))',
    '        if user_home:',
    '            untrusted_prefixes.append(user_home)',
    '    except Exception:',
    '        pass',
    '    if sys.platform != "win32":',
    '        untrusted_prefixes.extend(["/tmp", "/var/tmp", "/dev/shm"])',
    '',
    '    def is_untrusted_path(p):',
    '        try:',
    '            rp = os.path.realpath(p)',
    '        except Exception:',
    '            return True',
    '        for prefix in untrusted_prefixes:',
    '            try:',
    '                if rp == prefix or os.path.commonpath([rp, prefix]) == prefix:',
    '                    return True',
    '            except ValueError:',
    '                pass',
    '        if sys.platform == "win32":',
    '            p_lower = rp.lower()',
    '            if "\\\\users\\\\" in p_lower or p_lower.startswith(("\\\\\\\\", "//")):',
    '                return True',
    '        else:',
    '            if rp.startswith(("/home/", "/Users/")):',
    '                return True',
    '        return False',
    '',
    '    def get_windows_authoritative_roots():',
    '        roots = []',
    '        try:',
    '            import winreg',
    '            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\Microsoft\\Windows\\CurrentVersion") as k:',
    '                for val in ("ProgramFilesDir", "ProgramFilesDir (x86)", "ProgramFilesDir (Arm)", "ProgramW6432Dir"):',
    '                    try:',
    '                        rv, _ = winreg.QueryValueEx(k, val)',
    '                        if rv and os.path.isdir(rv):',
    '                            roots.append(os.path.realpath(rv))',
    '                    except OSError:',
    '                        pass',
    '        except Exception:',
    '            pass',
    '        try:',
    '            import winreg',
    '            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion") as k:',
    '                rv, _ = winreg.QueryValueEx(k, "SystemRoot")',
    '                if rv and os.path.isdir(rv):',
    '                    roots.append(os.path.realpath(rv))',
    '        except Exception:',
    '            pass',
    '        return list(dict.fromkeys(roots))',
    '',
    '    def verify_posix_ancestors(target_path):',
    '        rp = os.path.realpath(target_path)',
    '        curr = rp',
    '        while True:',
    '            try:',
    '                st = os.stat(curr)',
    '            except OSError:',
    '                return False',
    '            if st.st_uid != 0:',
    '                return False',
    '            if (st.st_mode & 0o022) != 0:',
    '                return False',
    '            parent = os.path.dirname(curr)',
    '            if parent == curr:',
    '                break',
    '            curr = parent',
    '        return True',
    '',
    '    def verify_windows_dacl(target_path, trusted_roots):',
    '        rp = os.path.realpath(target_path)',
    '        in_trusted_root = False',
    '        for troot in trusted_roots:',
    '            try:',
    '                if rp == troot or os.path.commonpath([rp, troot]) == troot:',
    '                    in_trusted_root = True',
    '                    break',
    '            except ValueError:',
    '                pass',
    '        if not in_trusted_root:',
    '            return False',
    '',
    '        try:',
    '            import ctypes',
    '            from ctypes import wintypes',
    '            advapi32 = ctypes.windll.advapi32',
    '            kernel32 = ctypes.windll.kernel32',
    '',
    '            SE_FILE_OBJECT = 1',
    '            OWNER_SECURITY_INFORMATION = 1',
    '            DACL_SECURITY_INFORMATION = 4',
    '            AclSizeInformation = 2',
    '            INHERIT_ONLY_ACE = 0x08',
    '',
    '            class ACE_HEADER(ctypes.Structure):',
    '                _fields_ = [(\'AceType\', wintypes.BYTE), (\'AceFlags\', wintypes.BYTE), (\'AceSize\', wintypes.WORD)]',
    '            class ACL_SIZE_INFORMATION(ctypes.Structure):',
    '                _fields_ = [(\'AceCount\', wintypes.DWORD), (\'AclBytesInUse\', wintypes.DWORD), (\'AclBytesFree\', wintypes.DWORD)]',
    '',
    '            TRUSTED_SIDS = {',
    '                \'S-1-5-32-544\',',
    '                \'S-1-5-18\',',
    '                \'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464\',',
    '            }',
    '            WRITE_MASK = 0x0002 | 0x0004 | 0x00000010 | 0x00000040 | 0x00000100 | 0x00010000 | 0x00040000 | 0x00080000 | 0x40000000 | 0x10000000',
    '',
    '            curr = rp',
    '            while True:',
    '                p_sec_desc = wintypes.LPVOID()',
    '                p_owner = wintypes.LPVOID()',
    '                p_dacl = wintypes.LPVOID()',
    '                res = advapi32.GetNamedSecurityInfoW(',
    '                    curr,',
    '                    SE_FILE_OBJECT,',
    '                    OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,',
    '                    ctypes.byref(p_owner),',
    '                    None,',
    '                    ctypes.byref(p_dacl),',
    '                    None,',
    '                    ctypes.byref(p_sec_desc)',
    '                )',
    '                if res != 0 or not p_sec_desc:',
    '                    return False',
    '                try:',
    '                    if not p_owner or not p_dacl:',
    '                        return False',
    '',
    '                    if not advapi32.IsValidSid(p_owner):',
    '                        return False',
    '                    owner_len = advapi32.GetLengthSid(p_owner)',
    '                    if owner_len < 8:',
    '                        return False',
    '',
    '                    p_str_sid = wintypes.LPWSTR()',
    '                    if not advapi32.ConvertSidToStringSidW(p_owner, ctypes.byref(p_str_sid)):',
    '                        return False',
    '                    try:',
    '                        owner_sid = p_str_sid.value',
    '                    finally:',
    '                        kernel32.LocalFree(p_str_sid)',
    '',
    '                    if owner_sid not in TRUSTED_SIDS:',
    '                        return False',
    '',
    '                    acl_info = ACL_SIZE_INFORMATION()',
    '                    if not advapi32.GetAclInformation(p_dacl, ctypes.byref(acl_info), ctypes.sizeof(acl_info), AclSizeInformation):',
    '                        return False',
    '',
    '                    for i in range(acl_info.AceCount):',
    '                        p_ace = wintypes.LPVOID()',
    '                        if not advapi32.GetAce(p_dacl, i, ctypes.byref(p_ace)) or not p_ace:',
    '                            return False',
    '                        ace_header = ACE_HEADER.from_address(p_ace.value)',
    '                        ace_type = ace_header.AceType',
    '                        ace_size = ace_header.AceSize',
    '',
    '                        # Explicit deny ACEs deny access; they do not grant write rights',
    '                        if ace_type in (1, 6, 10, 12):',
    '                            continue',
    '',
    '                        # Allow ACEs: standard (0), callback (9), object (5), callback object (11), compound (4)',
    '                        if ace_type in (0, 9):',
    '                            if ace_size < 16:',
    '                                return False',
    '                            mask = ctypes.c_uint32.from_address(p_ace.value + 4).value',
    '                            sid_offset = 8',
    '                            p_sid = ctypes.c_void_p(p_ace.value + 8)',
    '                        elif ace_type in (5, 11):',
    '                            if ace_size < 20:',
    '                                return False',
    '                            mask = ctypes.c_uint32.from_address(p_ace.value + 4).value',
    '                            flags = ctypes.c_uint32.from_address(p_ace.value + 8).value',
    '                            if (flags & ~0x03) != 0:',
    '                                return False',
    '                            offset = 12',
    '                            if (flags & 0x1):',
    '                                offset += 16',
    '                            if (flags & 0x2):',
    '                                offset += 16',
    '                            if ace_size < offset + 8:',
    '                                return False',
    '                            sid_offset = offset',
    '                            p_sid = ctypes.c_void_p(p_ace.value + offset)',
    '                        elif ace_type == 4:',
    '                            if ace_size < 20:',
    '                                return False',
    '                            mask = ctypes.c_uint32.from_address(p_ace.value + 4).value',
    '                            compound_type = ctypes.c_uint16.from_address(p_ace.value + 8).value',
    '                            reserved = ctypes.c_uint16.from_address(p_ace.value + 10).value',
    '                            if compound_type != 1 or reserved != 0:',
    '                                return False',
    '                            sid_offset = 12',
    '                            p_sid = ctypes.c_void_p(p_ace.value + 12)',
    '                        else:',
    '                            # Unknown / unhandled ACE type: fail closed',
    '                            return False',
    '',
    '                        if not advapi32.IsValidSid(p_sid):',
    '                            return False',
    '                        sid_len = advapi32.GetLengthSid(p_sid)',
    '                        if sid_len < 8 or ace_size < sid_offset + sid_len:',
    '                            return False',
    '                        revision = ctypes.c_uint8.from_address(p_sid.value).value',
    '                        sub_auth_count = ctypes.c_uint8.from_address(p_sid.value + 1).value',
    '                        if revision != 1 or sid_len != 8 + 4 * sub_auth_count:',
    '                            return False',
    '',
    '                        p_ace_str_sid = wintypes.LPWSTR()',
    '                        if not advapi32.ConvertSidToStringSidW(p_sid, ctypes.byref(p_ace_str_sid)):',
    '                            return False',
    '                        try:',
    '                            ace_sid = p_ace_str_sid.value',
    '                        finally:',
    '                            kernel32.LocalFree(p_ace_str_sid)',
    '',
    '                        if (mask & WRITE_MASK) != 0:',
    '                            if ace_sid in TRUSTED_SIDS:',
    '                                continue',
    '                            if ace_sid == \'S-1-3-0\' and (ace_header.AceFlags & INHERIT_ONLY_ACE):',
    '                                continue',
    '                            return False',
    '                finally:',
    '                    kernel32.LocalFree(p_sec_desc)',
    '',
    '                parent = os.path.dirname(curr)',
    '                if parent == curr:',
    '                    break',
    '                if any(curr == troot for troot in trusted_roots):',
    '                    break',
    '                curr = parent',
    '',
    '            return True',
    '        except Exception:',
    '            return False',
    '',
    '    trusted_roots = []',
    '    if sys.platform == "win32":',
    '        trusted_roots = get_windows_authoritative_roots()',
    '        if not trusted_roots:',
    '            return None',
    '        exe_names = ["git.exe", "git.cmd"]',
    '    else:',
    '        exe_names = ["git"]',
    '',
    '    if candidate_dirs is not None:',
    '        search_dirs = list(candidate_dirs)',
    '    else:',
    '        path_dirs = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]',
    '        system_dirs = []',
    '        if sys.platform == "win32":',
    '            for r in trusted_roots:',
    '                system_dirs.extend([',
    '                    os.path.join(r, "Git", "cmd"),',
    '                    os.path.join(r, "Git", "bin"),',
    '                ])',
    '        else:',
    '            system_dirs = ["/usr/bin", "/bin", "/usr/local/bin"]',
    '        search_dirs = path_dirs + system_dirs',
    '',
    '    seen_dirs = set()',
    '    for d in search_dirs:',
    '        if not os.path.isabs(d):',
    '            continue',
    '        try:',
    '            real_d = os.path.realpath(d)',
    '        except Exception:',
    '            continue',
    '        if real_d in seen_dirs:',
    '            continue',
    '        seen_dirs.add(real_d)',
    '        if not os.path.isdir(real_d):',
    '            continue',
    '',
    '        if is_untrusted_path(d) or is_untrusted_path(real_d):',
    '            continue',
    '',
    '        if sys.platform == "win32":',
    '            if not verify_windows_dacl(real_d, trusted_roots):',
    '                continue',
    '        else:',
    '            if not verify_posix_ancestors(real_d):',
    '                continue',
    '',
    '        for name in exe_names:',
    '            candidate = os.path.join(real_d, name)',
    '            if not (os.path.isfile(candidate) and os.access(candidate, os.X_OK)):',
    '                continue',
    '            try:',
    '                real_exe = os.path.realpath(candidate)',
    '            except Exception:',
    '                continue',
    '            if not (os.path.isfile(real_exe) and os.access(real_exe, os.X_OK)):',
    '                continue',
    '',
    '            if is_untrusted_path(candidate) or is_untrusted_path(real_exe):',
    '                continue',
    '',
    '            if sys.platform == "win32":',
    '                if not verify_windows_dacl(real_exe, trusted_roots):',
    '                    continue',
    '            else:',
    '                if not verify_posix_ancestors(real_exe):',
    '                    continue',
    '',
    '            try:',
    '                r = subprocess.run(',
    '                    [real_exe, "--version"],',
    '                    stdout=subprocess.PIPE,',
    '                    stderr=subprocess.PIPE,',
    '                    timeout=5,',
    '                    check=True,',
    '                    **{"env": clean_env},',
    '                )',
    '                if r.stdout.startswith(b"git version"):',
    '                    return real_exe',
    '            except Exception:',
    '                continue',
    '',
    '    return None',
    '',
    'clean_git_env = {k: v for k, v in os.environ.items() if not k.upper().startswith(("GIT_", "LD_", "DYLD_")) and k.upper() not in {"BASH_ENV", "ENV", "SHELLOPTS", "PYTHONPATH", "PYTHONHOME"}}',
    '',
    'trusted_git = resolve_trusted_git(clean_git_env)',
    'if not trusted_git:',
    '    print("FAIL CLOSED: trusted git executable could not be resolved", file=sys.stderr)',
    '    sys.exit(2)',
    '',
    'try:',
    '    result = subprocess.run(',
    '        [trusted_git, "-c", f"safe.directory={ROOT}", "-c", "core.fsmonitor=false", "ls-files", "-s", "-z"],',
    '        cwd=ROOT,',
    '        stdout=subprocess.PIPE,',
    '        stderr=subprocess.PIPE,',
    '        check=True,',
    '        **{"env": clean_git_env},',
    '    )',
    'except (OSError, subprocess.CalledProcessError) as exc:',
    '    detail = getattr(exc, "stderr", b"")',
    '    print(f"FAIL CLOSED: cannot enumerate tracked files: {detail.decode(\'utf-8\', \'replace\')}", file=sys.stderr)',
    '    sys.exit(2)',
    '',
    'root_flags = os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_CLOEXEC", 0)',
    'try:',
    '    root_fd = os.open(os.fsencode(ROOT), root_flags)',
    'except OSError as exc:',
    '    print(f"FAIL CLOSED: cannot open repository root: {exc}", file=sys.stderr)',
    '    sys.exit(2)',
    '',
    'try:',
    '    root_stat = os.fstat(root_fd)',
    '    if not stat.S_ISDIR(root_stat.st_mode):',
    '        print("FAIL CLOSED: repository root is not a directory", file=sys.stderr)',
    '        sys.exit(2)',
    '',
    '    for record in result.stdout.split(b"\\0"):',
    '        if not record:',
    '            continue',
    '',
    '        meta, sep, rel = record.partition(b"\\t")',
    '        meta_parts = meta.split(b" ")',
    '        if sep != b"\\t" or len(meta_parts) != 3 or not rel:',
    '            print(f"FAIL CLOSED: malformed git ls-files -s record: {record!r}", file=sys.stderr)',
    '            sys.exit(2)',
    '',
    '        index_mode, _obj, stage = meta_parts',
    '        if stage != b"0":',
    '            print(',
    '                f"FAIL CLOSED: unmerged git index stage {stage.decode(\'ascii\', \'replace\')} for tracked path: {os.fsdecode(rel)}",',
    '                file=sys.stderr,',
    '            )',
    '            sys.exit(2)',
    '',
    '        if index_mode not in (b"100644", b"100755", b"120000"):',
    '            print(',
    '                f"FAIL: unsupported git index mode {index_mode.decode(\'ascii\', \'replace\')} for tracked path: {os.fsdecode(rel)}",',
    '                file=sys.stderr,',
    '            )',
    '            sys.exit(1)',
    '',
    '        parts = rel.split(b"/")',
    '        for comp in parts:',
    '            if comp in (b".", b"..") or not comp:',
    '                print(f"FAIL CLOSED: invalid path component in tracked path: {os.fsdecode(rel)}", file=sys.stderr)',
    '                sys.exit(2)',
    '',
    '        cur_fd = root_fd',
    '        close_fds = []',
    '        try:',
    '            for comp in parts[:-1]:',
    '                dir_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)',
    '                try:',
    '                    next_fd = os.open(comp, dir_flags, dir_fd=cur_fd)',
    '                except OSError as exc:',
    '                    print(f"FAIL: parent directory component is a symbolic link or cannot be securely traversed: {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '                    sys.exit(1)',
    '                close_fds.append(next_fd)',
    '                next_stat = os.fstat(next_fd)',
    '                if not stat.S_ISDIR(next_stat.st_mode):',
    '                    print(f"FAIL: parent component is not a directory: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(1)',
    '                cur_fd = next_fd',
    '',
    '            leaf = parts[-1]',
    '            try:',
    '                leaf_stat = os.stat(leaf, dir_fd=cur_fd, follow_symlinks=False)',
    '            except OSError as exc:',
    '                print(f"FAIL CLOSED: cannot inspect tracked path {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '                sys.exit(2)',
    '',
    '            if index_mode == b"120000":',
    '                if stat.S_ISLNK(leaf_stat.st_mode):',
    '                    continue',
    '                print(',
    '                    f"FAIL: tracked symbolic link (mode 120000) is not a symbolic link in worktree: {os.fsdecode(rel)}",',
    '                    file=sys.stderr,',
    '                )',
    '                sys.exit(1)',
    '',
    '            if stat.S_ISLNK(leaf_stat.st_mode):',
    '                print(',
    '                    f"FAIL: tracked regular file (mode {index_mode.decode(\'ascii\')}) is replaced by a symbolic link in worktree: {os.fsdecode(rel)}",',
    '                    file=sys.stderr,',
    '                )',
    '                sys.exit(1)',
    '',
    '            if not stat.S_ISREG(leaf_stat.st_mode):',
    '                print(f"FAIL: tracked path is not a regular file: {os.fsdecode(rel)}", file=sys.stderr)',
    '                sys.exit(1)',
    '',
    '            file_flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)',
    '            try:',
    '                file_fd = os.open(leaf, file_flags, dir_fd=cur_fd)',
    '            except OSError as exc:',
    '                print(f"FAIL: cannot open tracked regular file {os.fsdecode(rel)}: {exc}", file=sys.stderr)',
    '                sys.exit(1)',
    '',
    '            try:',
    '                opened_stat = os.fstat(file_fd)',
    '                if not stat.S_ISREG(opened_stat.st_mode):',
    '                    print(f"FAIL: opened tracked path is not a regular file: {os.fsdecode(rel)}", file=sys.stderr)',
    '                    sys.exit(1)',
    '',
    '                while True:',
    '                    chunk = os.read(file_fd, CHUNK_SIZE)',
    '                    if not chunk:',
    '                        break',
    '                    if b"\\0" in chunk:',
    '                        print("FAIL: tracked binary file contains NUL byte: " + os.fsdecode(rel), file=sys.stderr)',
    '                        sys.exit(1)',
    '            finally:',
    '                os.close(file_fd)',
    '        finally:',
    '            for fd in close_fds:',
    '                try:',
    '                    os.close(fd)',
    '                except OSError:',
    '                    pass',
    'finally:',
    '    os.close(root_fd)',
    '',
    'print("PASS: complete content scan found no NUL bytes in tracked regular files")',
    'EOF',
    'nested_semgrepignore="$(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o -name \'.semgrepignore\' -not -path \'./.semgrepignore\' -print)"',
    'if [ -n "$nested_semgrepignore" ]; then',
    '  printf \'Nested .semgrepignore is not permitted: %s\\n\' "$nested_semgrepignore" >&2',
    '  exit 1',
    'fi',
    'if [ -L .semgrepignore ]; then',
    '  printf \'%s\\n\' \'A symlinked .semgrepignore is not permitted\' >&2',
    '  exit 1',
    'fi',
    'if [ -e .semgrepignore ] && [ ! -f .semgrepignore ]; then',
    '  printf \'%s\\n\' \'.semgrepignore must be a regular file\' >&2',
    '  exit 1',
    'fi',
    'if [ -f .semgrepignore ]; then',
    '  actual="$(awk \'NF && $0 !~ /^[[:space:]]*#/ { sub(/^[[:space:]]+/, ""); sub(/[[:space:]]+$/, ""); print }\' .semgrepignore | sort)"',
    '  expected="$(printf \'.git/\\nnode_modules/\\n\' | sort)"',
    '  if [ "$actual" != "$expected" ]; then',
    '    printf \'%s\\n\' \'.semgrepignore may exclude only .git/ and node_modules/\' >&2',
    '    exit 1',
    '  fi',
    'fi',
    'symlinked_gitignore="$(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o -name \'.gitignore\' -type l -print)"',
    'if [ -n "$symlinked_gitignore" ]; then',
    '  printf \'Symlinked .gitignore is not permitted: %s\\n\' "$symlinked_gitignore" >&2',
    '  exit 1',
    'fi',
    'target_count=0',
    'while IFS= read -r -d \'\' file; do',
    '  target_count=$((target_count+1))',
    '  if git -c safe.directory="$PWD" -c core.fsmonitor=false check-ignore --no-index -q -- "$file"; then',
    '    printf \'Tracked Semgrep target is excluded by .gitignore: %s\\n\' "$file" >&2',
    '    exit 1',
    '  else',
    '    status=$?',
    '    if [ "$status" -ne 1 ]; then',
    '      exit "$status"',
    '    fi',
    '  fi',
    'done < <(git -c safe.directory="$PWD" -c core.fsmonitor=false ls-files -z)',
    'if [ "$target_count" -eq 0 ]; then',
    '  printf \'%s\\n\' \'No tracked files found for Semgrep scan\' >&2',
    '  exit 1',
    'fi',
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }
  return value;
}

function assertExactObject(actual, expected, context) {
  const actualStr = JSON.stringify(canonicalize(actual));
  const expectedStr = JSON.stringify(canonicalize(expected));
  if (actualStr !== expectedStr) {
    throw new Error(`${context}: configuration mismatch. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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
  assertNoUntrustedExpressions(parsed.name, 'workflow name', label);

  // 2. Workflow-level permissions
  if (!parsed.permissions) {
    throw new Error(`${label}: must declare workflow-level permissions`);
  }
  if (typeof parsed.permissions === 'string') {
    throw new Error(`${label}: workflow-level permissions must be { contents: 'read' }, got string '${parsed.permissions}'`);
  } else if (typeof parsed.permissions === 'object' && !Array.isArray(parsed.permissions)) {
    for (const [scope, perm] of Object.entries(parsed.permissions)) {
      if (perm === 'write' || perm === 'write-all') {
        throw new Error(`${label}: workflow-level permissions must not grant write access to ${scope}`);
      }
    }
    assertExactObject(parsed.permissions, { contents: 'read' }, `${label} workflow permissions`);
  } else {
    throw new Error(`${label}: invalid permissions type`);
  }

  // 3. Workflow triggers
  const rawTriggers = parsed.on ?? parsed['true'];
  if (!rawTriggers) {
    throw new Error(`${label}: must define trigger conditions`);
  }
  if (typeof rawTriggers !== 'object' || Array.isArray(rawTriggers)) {
    throw new Error(`${label}: triggers must be a mapping specifying approved push, pull_request, and schedule events`);
  }
  const triggers = rawTriggers;
  for (const triggerName of Object.keys(triggers)) {
    if (!APPROVED_TRIGGERS.has(triggerName)) {
      throw new Error(`${label}: uses unapproved trigger '${triggerName}'`);
    }
  }
  if (!triggers.push) throw new Error(`${label}: must define push trigger`);
  if (!triggers.pull_request) throw new Error(`${label}: must define pull_request trigger`);
  validateBranchTrigger(triggers.push, 'push', label);
  validateBranchTrigger(triggers.pull_request, 'pull_request', label);
  if (!triggers.schedule) throw new Error(`${label}: must define schedule trigger for periodic full-history scan`);
  if (!Array.isArray(triggers.schedule) || triggers.schedule.length === 0) {
    throw new Error(`${label}: schedule must be a non-empty array`);
  }
  for (const entry of triggers.schedule) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(k => k !== 'cron') || typeof entry.cron !== 'string' || entry.cron.trim().split(/\s+/).length !== 5) {
      throw new Error(`${label}: schedule entries must define only a 5-field cron string`);
    }
  }
  assertNoUntrustedExpressions(triggers.schedule, 'schedule trigger', label);
  if (!triggers.schedule.some(s => s?.cron === '17 5 * * 1')) {
    throw new Error(`${label}: schedule must include weekly full-history scan cron "17 5 * * 1"`);
  }
  assertNoUntrustedExpressions(triggers.workflow_dispatch, 'workflow_dispatch trigger', label);

  // 4. Defaults & Concurrency
  if (parsed.defaults !== undefined) {
    if (!parsed.defaults || typeof parsed.defaults !== 'object' || Array.isArray(parsed.defaults)) {
      throw new Error(`${label}: defaults must be an object`);
    }
    assertNoUntrustedExpressions(parsed.defaults, 'defaults', label);
    for (const key of Object.keys(parsed.defaults)) {
      if (key !== 'run') {
        throw new Error(`${label}: defaults contains unapproved key '${key}'`);
      }
    }
    if (parsed.defaults.run !== undefined) {
      if (!parsed.defaults.run || typeof parsed.defaults.run !== 'object' || Array.isArray(parsed.defaults.run)) {
        throw new Error(`${label}: defaults.run must be an object`);
      }
      if (parsed.defaults.run['working-directory']) {
        throw new Error(`${label}: defaults.run must not override working-directory`);
      }
      for (const runKey of Object.keys(parsed.defaults.run)) {
        if (runKey !== 'shell') {
          throw new Error(`${label}: defaults.run contains unapproved key '${runKey}'`);
        }
      }
      if (parsed.defaults.run.shell !== undefined) {
        if (typeof parsed.defaults.run.shell !== 'string' || !APPROVED_SHELLS.has(parsed.defaults.run.shell.trim())) {
          throw new Error(`${label}: unapproved shell in defaults: '${parsed.defaults.run.shell}'`);
        }
      }
    }
  }
  if (parsed.concurrency !== undefined) {
    if (!parsed.concurrency || typeof parsed.concurrency !== 'object' || Array.isArray(parsed.concurrency)) {
      throw new Error(`${label}: concurrency must be an object`);
    }
    assertNoUntrustedExpressions(parsed.concurrency, 'concurrency', label);
    if (parsed.concurrency['cancel-in-progress'] !== undefined && parsed.concurrency['cancel-in-progress'] !== false) {
      throw new Error(`${label}: must not enable concurrency cancel-in-progress`);
    }
  }

  // 5. Environment allowlist at workflow level: none allowed (F4)
  if (parsed.env !== undefined) {
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
  if (secJob.env !== undefined) throw new Error(`${label}: ${secretJobId} job-level env is not permitted`);
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
  if (secStep0.env !== undefined) throw new Error(`${label}: ${secretJobId} checkout step must not define env`);

  // Step 1: Config guard
  const secStep1 = secSteps[1];
  if (secStep1.name !== 'Reject unreviewed scanner configuration') {
    throw new Error(`${label}: ${secretJobId} step 1 must be named 'Reject unreviewed scanner configuration'`);
  }
  if (secStep1.shell !== 'bash') throw new Error(`${label}: ${secretJobId} config guard must use bash`);
  if (secStep1.run?.trim() !== buildExpectedConsumerGuard().trim()) {
    throw new Error(`${label}: ${secretJobId} config guard must execute the exact canonical fail-closed guard script`);
  }
  if (secStep1.with !== undefined) throw new Error(`${label}: ${secretJobId} config guard step must not define with inputs`);
  if (secStep1.env !== undefined) throw new Error(`${label}: ${secretJobId} config guard step must not define env`);

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
  if (secStep2.with !== undefined) throw new Error(`${label}: ${secretJobId} scan step must not define inputs`);

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
  if (semJob.env !== undefined) throw new Error(`${label}: semgrep job-level env is not permitted`);
  if (semJob.services) throw new Error(`${label}: semgrep job must not declare services`);
  if (!APPROVED_CONTAINER_IMAGES.has(semJob.container?.image)) {
    throw new Error(`${label}: semgrep container image must be exactly 'semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493'`);
  }
  assertExactObject(semJob.container, {
    image: 'semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493'
  }, `${label} semgrep container`);

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
  if (semStep0.env !== undefined) throw new Error(`${label}: semgrep checkout step must not define env`);

  // Step 1: Config guard
  const semStep1 = semSteps[1];
  if (semStep1.name !== 'Reject unreviewed scanner configuration') {
    throw new Error(`${label}: semgrep step 1 must be named 'Reject unreviewed scanner configuration'`);
  }
  if (semStep1.shell !== 'bash') throw new Error(`${label}: semgrep config guard must use bash`);
  if (semStep1.run?.trim() !== buildExpectedConsumerGuard().trim()) {
    throw new Error(`${label}: semgrep config guard must execute the exact canonical fail-closed guard script`);
  }
  if (semStep1.with !== undefined) throw new Error(`${label}: semgrep config guard step must not define with inputs`);
  if (semStep1.env !== undefined) throw new Error(`${label}: semgrep config guard step must not define env`);

  // Step 2: Semgrep scan execution contract (F3)
  const semStep2 = semSteps[2];
  const expectedSemgrepCommand = 'semgrep scan --config p/default --error --strict --disable-nosem --metrics=off .';
  if (semStep2.run?.trim() !== expectedSemgrepCommand) {
    throw new Error(`${label}: semgrep scan command violates strict execution contract; expected '${expectedSemgrepCommand}', got '${semStep2.run?.trim()}'`);
  }
  assertExactObject(semStep2.env, { SEMGREP_SEND_METRICS: 'off' }, `${label} semgrep scan env`);
  if (semStep2.with !== undefined) throw new Error(`${label}: semgrep scan step must not define inputs`);

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
  if (codeJob.env !== undefined) throw new Error(`${label}: codeql job-level env is not permitted`);
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
  if (codeStep0.env !== undefined) throw new Error(`${label}: codeql checkout step must not define env`);

  // Step 1: CodeQL Init
  const codeStep1 = codeSteps[1];
  if (codeStep1.uses !== `github/codeql-action/init@${APPROVED_ACTIONS.get('github/codeql-action/init')}`) {
    throw new Error(`${label}: codeql init step must use pinned action 'github/codeql-action/init@${APPROVED_ACTIONS.get('github/codeql-action/init')}', got '${codeStep1.uses}'`);
  }
  if (!codeStep1.with || typeof codeStep1.with !== 'object' || Array.isArray(codeStep1.with)) {
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
  if (codeStep1.with['build-mode'] !== undefined) {
    if (typeof codeStep1.with['build-mode'] !== 'string' || !codeStep1.with['build-mode'].trim()) {
      throw new Error(`${label}: codeql init step build-mode must be a non-empty string`);
    }
    if (!APPROVED_BUILD_MODES.has(codeStep1.with['build-mode'].trim())) {
      throw new Error(`${label}: codeql init step build-mode must be one of none, autobuild, manual, got '${codeStep1.with['build-mode']}'`);
    }
  }
  if (codeStep1.env !== undefined) throw new Error(`${label}: codeql init step must not define env`);

  // Step 2: CodeQL Analyze
  const codeStep2 = codeSteps[2];
  if (codeStep2.uses !== `github/codeql-action/analyze@${APPROVED_ACTIONS.get('github/codeql-action/analyze')}`) {
    throw new Error(`${label}: codeql analyze step must use pinned action 'github/codeql-action/analyze@${APPROVED_ACTIONS.get('github/codeql-action/analyze')}', got '${codeStep2.uses}'`);
  }
  if (codeStep2.with !== undefined) throw new Error(`${label}: codeql analyze step must not define inputs`);
  if (codeStep2.env !== undefined) throw new Error(`${label}: codeql analyze step must not define env`);

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
