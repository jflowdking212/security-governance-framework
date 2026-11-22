import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateConsumerWorkflowStructure } from '../tools/validate-consumer-workflow.mjs';

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
    'while IFS= read -r var_line; do',
    '  case "$var_line" in',
    '    [Gg][Ii][Tt]_*) unset "${var_line%%=*}" ;;',
    '  esac',
    'done < <(env)',
    'git -c safe.directory="$PWD" -c core.fsmonitor=false rev-parse --show-toplevel >/dev/null',
    'for file in .gitleaks.toml .gitleaksignore gitleaks.toml gitleaks.yaml gitleaks.yml .semgrep.yml .semgrep.yaml semgrep.yml semgrep.yaml codeql-config.yml codeql-config.yaml .github/codeql/codeql-config.yml .github/codeql/codeql-config.yaml osv-scanner.toml .osv-scanner.toml .allowed-binaries; do',
    '  if [ -e "$file" ]; then',
    '    printf \'Unreviewed scanner override is not permitted: %s\\n\' "$file" >&2',
    '    exit 1',
    '  fi',
    'done',
    'nested_osv_config="$(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o \\( -name \'osv-scanner.toml\' -o -name \'.osv-scanner.toml\' \\) -print)"',
    'if [ -n "$nested_osv_config" ]; then',
    '  printf \'Unreviewed OSV configuration is not permitted: %s\\n\' "$nested_osv_config" >&2',
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
    '  if grep -v \'^[[:space:]]*#\' "$attr_file" | grep -n -E \'(^|[[:space:]])[-!]?(diff|binary|filter|merge)([[:space:]=]|$)\' >&2; then',
    '    printf \'Prohibited .gitattributes configuration is not permitted: %s\\n\' "$attr_file" >&2',
    '    exit 1',
    '  fi',
    'done < <(find . -path \'./.git\' -prune -o -path \'./node_modules\' -prune -o -name \'.gitattributes\' -print)',
    'if [ -e .git/info/attributes ]; then',
    '  if grep -v \'^[[:space:]]*#\' .git/info/attributes | grep -n -E \'(^|[[:space:]])[-!]?(diff|binary|filter|merge)([[:space:]=]|$)\' >&2; then',
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
    '            class ACCESS_ALLOWED_ACE(ctypes.Structure):',
    '                _fields_ = [(\'Header\', ACE_HEADER), (\'Mask\', wintypes.DWORD), (\'SidStart\', wintypes.DWORD)]',
    '            class ACL_SIZE_INFORMATION(ctypes.Structure):',
    '                _fields_ = [(\'AceCount\', wintypes.DWORD), (\'AclBytesInUse\', wintypes.DWORD), (\'AclBytesFree\', wintypes.DWORD)]',
    '',
    '            TRUSTED_SIDS = {',
    '                \'S-1-5-32-544\',',
    '                \'S-1-5-18\',',
    '                \'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464\',',
    '            }',
    '            WRITE_MASK = 0x0002 | 0x0004 | 0x00010000 | 0x00040000 | 0x00080000 | 0x40000000 | 0x10000000',
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
    '                if res != 0:',
    '                    return False',
    '                try:',
    '                    p_str_sid = wintypes.LPWSTR()',
    '                    if not advapi32.ConvertSidToStringSidW(p_owner, ctypes.byref(p_str_sid)):',
    '                        return False',
    '                    owner_sid = p_str_sid.value',
    '                    kernel32.LocalFree(p_str_sid)',
    '                    if owner_sid not in TRUSTED_SIDS:',
    '                        return False',
    '',
    '                    if not p_dacl:',
    '                        return False',
    '',
    '                    acl_info = ACL_SIZE_INFORMATION()',
    '                    if not advapi32.GetAclInformation(p_dacl, ctypes.byref(acl_info), ctypes.sizeof(acl_info), AclSizeInformation):',
    '                        return False',
    '',
    '                    for i in range(acl_info.AceCount):',
    '                        p_ace = wintypes.LPVOID()',
    '                        if not advapi32.GetAce(p_dacl, i, ctypes.byref(p_ace)):',
    '                            return False',
    '                        ace_header = ACE_HEADER.from_address(p_ace.value)',
    '                        if ace_header.AceType == 0:',
    '                            allowed_ace = ACCESS_ALLOWED_ACE.from_address(p_ace.value)',
    '                            p_sid = ctypes.c_void_p(p_ace.value + 8)',
    '                            p_ace_str_sid = wintypes.LPWSTR()',
    '                            if advapi32.ConvertSidToStringSidW(p_sid, ctypes.byref(p_ace_str_sid)):',
    '                                ace_sid = p_ace_str_sid.value',
    '                                kernel32.LocalFree(p_ace_str_sid)',
    '                                if (allowed_ace.Mask & WRITE_MASK) != 0:',
    '                                    if ace_sid in TRUSTED_SIDS:',
    '                                        continue',
    '                                    if ace_sid == \'S-1-3-0\' and (ace_header.AceFlags & INHERIT_ONLY_ACE):',
    '                                        continue',
    '                                    return False',
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
    'clean_git_env = {k: v for k, v in os.environ.items() if not k.upper().startswith("GIT_")}',
    '',
    'trusted_git = resolve_trusted_git(clean_git_env)',
    'if not trusted_git:',
    '    print("FAIL CLOSED: trusted git executable could not be resolved", file=sys.stderr)',
    '    sys.exit(2)',
    '',
    'try:',
    '    result = subprocess.run(',
    '        [trusted_git, "-c", f"safe.directory={ROOT}", "-c", "core.fsmonitor=false", "ls-files", "-z"],',
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
    '            if stat.S_ISLNK(leaf_stat.st_mode):',
    '                continue',
    '',
    '            if not stat.S_ISREG(leaf_stat.st_mode):',
    '                print(f"FAIL: tracked path is not a regular file or symlink: {os.fsdecode(rel)}", file=sys.stderr)',
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
    'if [ -f .semgrepignore ]; then',
    '  actual="$(awk \'NF && $1 !~ /^#/ { print $1 }\' .semgrepignore | sort)"',
    '  expected="$(printf \'.git/\\nnode_modules/\\n\' | sort)"',
    '  if [ "$actual" != "$expected" ]; then',
    '    printf \'%s\\n\' \'.semgrepignore may exclude only .git/ and node_modules/\' >&2',
    '    exit 1',
    '  fi',
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

const FORBIDDEN_ENV_NAMES = new Set([
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

function assertSafeEnv(env, context, allowedKeys = null) {
  if (env === undefined || env === null) return;
  assert.ok(typeof env === 'object' && !Array.isArray(env), context + ' env must be an object');
  for (const [name, value] of Object.entries(env)) {
    const upper = name.toUpperCase();
    if (FORBIDDEN_ENV_NAMES.has(upper) || upper.startsWith('NPM_CONFIG_') || upper.startsWith('GIT_')) {
      assert.fail(context + " must not define forbidden runtime environment variable '" + name + "'");
    }
    assert.equal(typeof value, 'string', context + ' env ' + name + ' must be a string');
    assertNoUntrustedExpressionsInValue(value, context + ' env ' + name);
    if (allowedKeys && !allowedKeys.has(name)) {
      assert.fail(context + " defines unapproved environment variable '" + name + "'");
    }
  }
}

const APPROVED_SHELLS = new Set([
  'bash',
  'bash --noprofile --norc -eo pipefail {0}',
  'bash --noprofile --norc -e -o pipefail {0}'
]);

function assertSafeShell(shell, context) {
  if (shell === undefined || shell === null) return;
  assert.equal(typeof shell, 'string', context + ' specifies invalid shell type: ' + typeof shell);
  const trimmed = shell.trim();
  assert.ok(
    !/(?:^|\s)(?:-[a-zA-Z]*c|--command)(?:\s|$|=|:)/i.test(trimmed),
    context + " specifies unsafe shell command override '" + trimmed + "' that bypasses runner script execution"
  );
  assert.ok(
    !/\b(?:ba)?sh\s+(?:--noprofile\s+|--norc\s+)*\{0\}/i.test(trimmed) && trimmed !== 'bash {0}' && trimmed !== 'sh {0}',
    context + " specifies unsafe shell override '" + trimmed + "' that disables fail-fast error handling (-e)"
  );
  assert.ok(
    APPROVED_SHELLS.has(trimmed),
    context + " specifies unapproved shell '" + trimmed + "'; must be approved safe shell template ('bash')"
  );
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

function assertNoOsvConfigOverrides(root = ROOT) {
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        scan(path.join(dir, entry.name));
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (entry.name === 'osv-scanner.toml' || entry.name === '.osv-scanner.toml') {
          assert.fail('Unreviewed OSV configuration override is not permitted: ' + path.relative(root, path.join(dir, entry.name)));
        }
      }
    }
  }
  scan(root);
}

function hasProhibitedGitAttributes(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/(?:^|\s)[-!]?(?:diff|binary|filter|merge)(?:[\s=]|$)/.test(trimmed)) {
      return true;
    }
  }
  return false;
}

function assertNoProhibitedGitAttributes(root = ROOT) {
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        scan(path.join(dir, entry.name));
      } else if (entry.name === '.gitattributes') {
        const fullPath = path.join(dir, entry.name);
        if (fs.lstatSync(fullPath).isSymbolicLink()) {
          assert.fail('Symlinked .gitattributes is not permitted: ' + path.relative(root, fullPath));
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        if (hasProhibitedGitAttributes(content)) {
          assert.fail('Prohibited .gitattributes configuration is not permitted: ' + path.relative(root, fullPath));
        }
      }
    }
  }
  scan(root);
  const infoAttr = path.join(root, '.git', 'info', 'attributes');
  if (fs.existsSync(infoAttr)) {
    const content = fs.readFileSync(infoAttr, 'utf8');
    if (hasProhibitedGitAttributes(content)) {
      assert.fail('Prohibited .git/info/attributes configuration is not permitted');
    }
  }
}

function assertNoTrackedBinaryFiles(root = ROOT) {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const result = spawnSync(pythonBin, [scannerPath], { cwd: root, encoding: 'utf8' });
  if (process.platform === 'win32') {
    assert.equal(result.status, 2, 'Scanner must fail closed by default on win32');
    assert.match(result.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    return;
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    const m = detail.match(/contains NUL byte:\s*(.+)$/m);
    const file = m ? m[1].trim() : detail;
    assert.fail('Tracked binary file is not permitted: ' + file + ' (' + detail + ')');
  }
}

function assertNoAllowedBinariesFile(root = ROOT) {
  const allowlistPath = path.join(root, '.allowed-binaries');
  if (fs.existsSync(allowlistPath)) {
    assert.fail('.allowed-binaries file is prohibited');
  }
}

function assertNoHistoricalGitleaksDirectives(root = ROOT) {
  const result = spawnSync('git', ['-c', 'safe.directory=' + root, '-c', 'core.fsmonitor=false', 'log', '-n', '1', '-i', '-E', '-G[g]itleaks[[:space:]]*:[[:space:]]*allow', '--format=%H %s'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    assert.fail('Failed to inspect Git history for prohibited Gitleaks directives: ' + result.stderr);
  }
  if (result.stdout.trim()) {
    assert.fail('Prohibited Gitleaks inline suppression directive found in Git history: ' + result.stdout.trim());
  }
}

function assertNoGitleaksSuppressionDirectives(root = ROOT) {
  const result = spawnSync('git', ['-c', 'safe.directory=' + root, '-c', 'core.fsmonitor=false', 'grep', '-n', '-I', '-i', '-E', '[g]itleaks[[:space:]]*:[[:space:]]*allow', '--', '.'], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) {
    assert.fail('Prohibited Gitleaks inline suppression directive found in tracked files:\n' + result.stdout);
  }
  assert.equal(result.status, 1, 'git grep for inline suppression directive failed: ' + result.stderr);
}

const ALLOWED_WORKFLOW_KEYS = new Set(['name', 'on', 'true', 'permissions', 'jobs', 'defaults', 'concurrency', 'env']);
const ALLOWED_JOB_KEYS = new Set(['name', 'runs-on', 'timeout-minutes', 'permissions', 'if', 'needs', 'strategy', 'continue-on-error', 'env', 'with', 'defaults', 'steps', 'container', 'uses']);
const ALLOWED_STEP_KEYS = new Set(['name', 'uses', 'with', 'run', 'env', 'shell', 'if', 'continue-on-error', 'timeout-minutes', 'id']);

/**
 * Validates structural security invariants across GitHub Actions workflows.
 */
function validateWorkflowSecurity(parsed, label) {
  for (const key of Object.keys(parsed)) {
    assert.ok(ALLOWED_WORKFLOW_KEYS.has(key), label + " contains unapproved workflow-level key '" + key + "'");
  }

  if (parsed.concurrency) {
    assert.notEqual(parsed.concurrency['cancel-in-progress'], true, label + ' must not set concurrency cancel-in-progress: true');
  }

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
  if (parsed.defaults?.run?.['working-directory']) {
    assert.fail(label + ' defaults.run must not override working-directory');
  }
  assertSafeShell(parsed.defaults?.run?.shell, label + ' workflow defaults.run.shell');
  assertPinnedActions(parsed, label);

  const jobs = parsed.jobs || {};
  assert.ok(Object.keys(jobs).length > 0, label + ' must define at least one job');
  for (const [jobId, job] of Object.entries(jobs)) {
    assert.equal(job.services, undefined, label + ' job ' + jobId + ' must not declare services');
    if (job.defaults?.run?.['working-directory']) {
      assert.fail(label + ' job ' + jobId + ' defaults.run must not override working-directory');
    }
    for (const key of Object.keys(job)) {
      assert.ok(ALLOWED_JOB_KEYS.has(key), label + ' job ' + jobId + " contains unapproved key '" + key + "'");
    }

    assertJobPermissions(jobId, job, label);
    assertNotConstantFalse(job.if, label + ' job ' + jobId);
    assert.ok(!job['continue-on-error'], label + ' job ' + jobId + ' must not have continue-on-error: true');
    assertSafeEnv(job.env, label + ' job ' + jobId);
    assertSafeWith(job.with, label + ' job ' + jobId);
    assertSafeShell(job.defaults?.run?.shell, label + ' job ' + jobId + ' defaults.run.shell');

    if (job.uses) {
      assert.equal(job['runs-on'], undefined, label + ' reusable job ' + jobId + ' must not override runs-on');
      assert.equal(job.steps, undefined, label + ' reusable job ' + jobId + ' must not add inline steps');
      assert.equal(job.container, undefined, label + ' reusable job ' + jobId + ' must not declare container');
    } else {
      assert.equal(typeof job['runs-on'], 'string', label + ' job ' + jobId + ' runs-on must be a single approved string');
      assert.equal(job['runs-on'], 'ubuntu-latest', label + ' job ' + jobId + " runs-on must be 'ubuntu-latest', got: " + String(job['runs-on']));
      assert.ok(Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] > 0, label + ' job ' + jobId + ' must specify a positive timeout-minutes integer');
      if (jobId !== 'semgrep') {
        assert.equal(job.container, undefined, label + ' non-Semgrep job ' + jobId + ' must not declare a container');
      }
    }

    const steps = job.steps || [];
    for (const [i, step] of steps.entries()) {
      assert.equal(step['working-directory'], undefined, label + ' job ' + jobId + ' step ' + i + ' must not override working-directory');
      for (const k of Object.keys(step)) {
        assert.ok(ALLOWED_STEP_KEYS.has(k), label + ' job ' + jobId + ' step ' + i + " contains unapproved key '" + k + "'");
      }
      assertNotConstantFalse(step.if, label + ' job ' + jobId + ' step ' + i + ' (' + (step.name || 'unnamed') + ')');
      assert.ok(!step['continue-on-error'], label + ' job ' + jobId + ' step ' + i + ' must not have continue-on-error: true');
      assertSafeEnv(step.env, label + ' job ' + jobId + ' step ' + i);
      assertSafeWith(step.with, label + ' job ' + jobId + ' step ' + i);
      assertSafeShell(step.shell, label + ' job ' + jobId + ' step ' + i + ' shell');

      if (step.uses && step.uses.startsWith('actions/checkout')) {
        assert.ok(step.with, label + ' checkout step ' + i + ' must provide with configuration');
        assert.strictEqual(step.with['persist-credentials'], false, label + ' checkout step ' + i + ' must set persist-credentials: false');
        assert.strictEqual(step.with.token, undefined, label + ' checkout step ' + i + ' must not override token with unexpected credentials');
      }

      if (step.run) {
        assert.ok(!UNTRUSTED_EXPRESSION_REGEX.test(step.run), label + ' job ' + jobId + ' step ' + i + ' contains forbidden direct expression interpolation: ' + step.run);
        if (/\bNODE_OPTIONS\s*=/i.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' must not set NODE_OPTIONS: ' + step.run);
        }
        if (/(?:^|\s|;)(?:BASH_ENV|PATH|NPM_CONFIG_[A-Z_]+|NODE_PATH|NODE_TLS_REJECT_UNAUTHORIZED|GIT_[A-Z0-9_]+|LD_PRELOAD|LD_LIBRARY_PATH|PYTHONPATH|NODE_EXTRA_CA_CERTS|DYLD_INSERT_LIBRARIES|DYLD_LIBRARY_PATH|PERL5LIB|RUBYOPT|SHELLOPTS|BASHOPTS|ENV)\s*=|(?<!while\s+)(?:^|\s|;)IFS\s*=(?!\s*read\b)/i.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' assigns to dangerous environment variable: ' + step.run);
        }
        for (const pattern of FORBIDDEN_ERROR_SUPPRESSIONS) {
          assert.ok(!pattern.test(step.run), label + ' job ' + jobId + ' step ' + i + ' suppresses errors with ' + pattern + ': ' + step.run);
        }
        if (/(?:^|\s|;)export\s+/i.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' must not use inline export statements: ' + step.run);
        }
        if (/(?:^|[^&])&\s*(?:$|\n|;)/.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' must not background commands (&): ' + step.run);
        }
        if (/\b(?:echo|printf|eval)\s+[^;\n]*\$\(/.test(step.run) || /\b(?:echo|printf|eval)\s+[^;\n]*`[^`]+`/.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' must not mask command failure inside echo/eval command substitution: ' + step.run);
        }
        if (/\bif\s+[^;\n]+;\s*then\s*(?::|true)\s*;\s*fi\b/.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' must not mask command failure inside conditional block: ' + step.run);
        }
        if (/\b(?:function\s+[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+\s*\(\)\s*\{)/.test(step.run)) {
          assert.fail(label + ' job ' + jobId + ' step ' + i + ' must not define shell functions: ' + step.run);
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
  const EXPECTED_USS_COMMANDS = [
    'npm ci --ignore-scripts --no-audit --no-fund',
    'node tools/build-modules.mjs',
    'git diff --exit-code -- modules/',
    'node tools/build-indexes.mjs\ngit diff --exit-code -- MODULE-INDEX.md bundles/',
    'node tools/build-bundles.mjs',
    'node tools/validate.mjs',
    'node tools/validate-evidence.mjs --file templates/security-evidence.example.json',
    'node --test tests/*.test.mjs'
  ];
  assert.equal(steps.length, 10, 'uss-validation.yml validate job must contain exactly 10 steps, got ' + steps.length);
  for (let idx = 0; idx < stepMatchers.length; idx++) {
    assert.ok(stepMatchers[idx](steps[idx]), 'uss-validation.yml step ' + idx + ' does not match required step sequence: ' + (steps[idx].name || steps[idx].run || steps[idx].uses));
    assert.equal(steps[idx].if, undefined, 'uss-validation.yml mandatory step ' + idx + ' must not be conditional');
    if (idx >= 2) {
      const normalizedRun = (steps[idx].run || '').replace(/\r\n/g, '\n').trim();
      assert.equal(normalizedRun, EXPECTED_USS_COMMANDS[idx - 2], 'uss-validation.yml step ' + idx + ' does not match exact approved execution contract');
      if (/(?:^|\s)\|(?:\s|$)/.test(steps[idx].run)) {
        assert.fail('uss-validation.yml step ' + idx + ' must not pipe commands (|): ' + steps[idx].run);
      }
    }
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

  const triggers = getTriggerMap(parsed);
  assert.ok(triggers.schedule, label + ' must define schedule trigger for periodic full-history scan');
  assert.ok(Array.isArray(triggers.schedule) && triggers.schedule.length > 0, label + ' schedule must be a non-empty array');
  assert.ok(
    triggers.schedule.some(s => s?.cron === '17 5 * * 1'),
    label + ' schedule must include weekly full-history scan cron "17 5 * * 1"'
  );

  const jobs = parsed.jobs || {};
  const gitleaksId = consumerTemplate ? 'secrets' : 'gitleaks';
  const gitleaksJob = jobs[gitleaksId];
  assert.ok(gitleaksJob, label + ' must contain ' + gitleaksId + ' job');
  for (const jobId of [gitleaksId, 'semgrep', 'codeql', 'osv']) {
    assert.ok(jobs[jobId], label + ' must contain ' + jobId + ' job');
    assertNoMandatoryJobConditions(jobId, jobs[jobId], label);
  }

  assert.equal(gitleaksJob.name, 'Secret scan (commit range on push/PR, full history on schedule)', 'Gitleaks job name must describe actual scan scope');
  if (!consumerTemplate) {
    assertNoGitleaksOverrideFiles(ROOT);
    assertNoOsvConfigOverrides(ROOT);
    assertNoGitleaksSuppressionDirectives(ROOT);
    assertNoHistoricalGitleaksDirectives(ROOT);
    assertNoProhibitedGitAttributes(ROOT);
    assertNoTrackedBinaryFiles(ROOT);
    assertNoAllowedBinariesFile(ROOT);
  }
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
  assert.ok(semgrepStep.run.includes('--strict'), 'Semgrep scan must fail on findings with --strict');
  assert.ok(semgrepStep.run.includes('--disable-nosem'), 'Semgrep scan must disable inline suppression with --disable-nosem');
  assert.ok(!semgrepStep.run.includes('--enable-nosem'), 'Semgrep scan must not re-enable inline suppression');
  if (!consumerTemplate) {
    assert.ok(semgrepStep.run.includes('tools/') && semgrepStep.run.includes('tests/') && semgrepStep.run.includes('.github/workflows/') && semgrepStep.run.includes('templates/'), 'Semgrep scan must target tools/ tests/ .github/workflows/ templates/');
    assert.ok(!semgrepStep.run.includes('--exclude'), 'Semgrep scan must not use --exclude argument to weaken scan');
  } else {
    assert.ok(!semgrepStep.run.includes('--exclude'), 'Semgrep scan must not use --exclude argument to weaken scan');
  }
  const expectedSemgrepCommand = consumerTemplate
    ? 'semgrep scan --config p/default --error --strict --disable-nosem --metrics=off .'
    : 'semgrep scan --config p/default --error --strict --disable-nosem --metrics=off --verbose tools/ tests/ .github/workflows/ templates/';
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
  assert.ok(text.includes('semgrep scan --config p/default --error --strict --disable-nosem --metrics=off .'));
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
  assert.throws(() => validateUssValidationWorkflow(parsed), /does not match exact approved execution contract|Evidence validation must not be replaced with --help/);
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
  semgrepStep.run = 'semgrep scan --config p/default --error --strict --disable-nosem --metrics=off --verbose tools/ tests/';
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
  const runGit = args => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, 'git ' + args.join(' ') + ' failed: ' + result.stderr);
    return result;
  };
  runGit(['init', '-q']);
  runGit(['config', 'user.name', 'USS Scanner Guard Test']);
  runGit(['config', 'user.email', 'uss-scanner-guard@example.invalid']);
  runGit(['config', 'commit.gpgsign', 'false']);
  for (const dir of ['tools', 'tests', '.github/workflows', 'templates']) {
    fs.mkdirSync(path.join(cwd, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(cwd, '.gitignore'), 'tools/guard.js\n');
  fs.writeFileSync(path.join(cwd, 'tools/guard.js'), 'const ok = true;\n');
  fs.writeFileSync(path.join(cwd, 'tests/check.mjs'), 'const ok = true;\n');
  fs.writeFileSync(path.join(cwd, '.github/workflows/test.yml'), 'name: test\n');
  fs.writeFileSync(path.join(cwd, 'templates/template.yml'), 'name: template\n');
  runGit(['add', '.gitignore', 'tests/check.mjs', '.github/workflows/test.yml', 'templates/template.yml']);
  runGit(['add', '-f', 'tools/guard.js']);
  runGit(['commit', '-m', 'scanner guard fixture']);

  const ignored = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.notEqual(ignored.status, 0, 'Guard must reject a tracked scanner target hidden by .gitignore');
  assert.match(ignored.stderr, /excluded by \.gitignore/);

  fs.writeFileSync(path.join(cwd, '.gitignore'), '');
  runGit(['add', '.gitignore']);
  runGit(['commit', '-m', 'remove ignored target pattern']);
  fs.writeFileSync(path.join(cwd, 'tools', '.semgrepignore'), 'sensitive-source/\n');
  const nested = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.notEqual(nested.status, 0, 'Guard must reject nested .semgrepignore files');
  assert.match(nested.stderr, /Nested \.semgrepignore is not permitted/);

  fs.rmSync(path.join(cwd, 'tools', '.semgrepignore'));
  const cleanRun = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.equal(cleanRun.status, 0, 'Guard must pass on clean repository: ' + cleanRun.stderr);

  fs.writeFileSync(path.join(cwd, 'osv-scanner.toml'), '[[IgnoredVulns]]\nid = "GO-2023-1234"\n');
  const osvOverride = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.notEqual(osvOverride.status, 0, 'Guard must reject osv-scanner.toml');
  assert.match(osvOverride.stderr, /Unreviewed scanner override is not permitted: osv-scanner\.toml/);

  fs.rmSync(path.join(cwd, 'osv-scanner.toml'));
  fs.writeFileSync(path.join(cwd, 'tools/secret.js'), 'const token = "secret"; // ' + ['gitleaks', 'allow'].join(':') + '\n');
  runGit(['add', 'tools/secret.js']);
  runGit(['commit', '-m', 'add secret with suppression']);
  const gitleaksSuppressed = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.notEqual(gitleaksSuppressed.status, 0, 'Guard must reject inline suppression');
  assert.match(gitleaksSuppressed.stderr, /Prohibited Gitleaks inline suppression directive/);

  fs.writeFileSync(path.join(cwd, 'tools/secret.js'), 'const token = "secret"; // ' + ['GITLEAKS', ' ALLOW'].join(' : ') + '\n');
  runGit(['add', 'tools/secret.js']);
  runGit(['commit', '-m', 'add whitespace suppression']);
  const whitespaceSuppressed = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.notEqual(whitespaceSuppressed.status, 0, 'Guard must reject whitespace/case variant suppression');
  assert.match(whitespaceSuppressed.stderr, /Prohibited Gitleaks inline suppression directive/);

  fs.writeFileSync(path.join(cwd, 'tools/secret.js'), 'const token = "safe";\n');
  runGit(['add', 'tools/secret.js']);
  runGit(['commit', '-m', 'clean code']);
  const historicalRun = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd, encoding: 'utf8', input: SCANNER_CONFIG_GUARD_RUN });
  assert.notEqual(historicalRun.status, 0, 'Guard must reject repository with historical suppression');
  assert.match(historicalRun.stderr, /Prohibited Gitleaks inline suppression directive found in Git history/);
});

test('negative: rejects Semgrep scan omitting --disable-nosem', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.semgrep.steps[2].run = parsed.jobs.semgrep.steps[2].run.replace(' --disable-nosem', '');
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must disable inline suppression with --disable-nosem/);
});

test('negative: rejects Semgrep scan re-enabling inline suppression with --enable-nosem', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.semgrep.steps[2].run += ' --enable-nosem';
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must not re-enable inline suppression/);
});

test('negative: rejects unreviewed osv-scanner.toml configuration overrides', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.gitleaks.steps[1].run = parsed.jobs.gitleaks.steps[1].run.replace(' osv-scanner.toml .osv-scanner.toml', '');
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must execute the exact fail-closed scanner configuration guard/);
});

test('negative: rejects removing weekly scheduled full-history secret scan in security-scans.yml', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  delete parsed.on.schedule;
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must define schedule trigger for periodic full-history scan/);
});

test('negative: rejects removing weekly scheduled full-history secret scan in consumer template', () => {
  const parsed = YAML.parse(fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8'));
  delete parsed.on.schedule;
  assert.throws(() => validateSecurityScansWorkflow(parsed, 'consumer-security-scans.yml', true), /must define schedule trigger for periodic full-history scan/);
});

test('negative: rejects invalid or empty schedule cron definitions', () => {
  const parsedEmpty = YAML.parse(read('security-scans.yml'));
  parsedEmpty.on.schedule = [];
  assert.throws(() => validateSecurityScansWorkflow(parsedEmpty), /schedule must be a non-empty array/);

  const parsedWrongCron = YAML.parse(read('security-scans.yml'));
  parsedWrongCron.on.schedule = [{ cron: '0 0 * * *' }];
  assert.throws(() => validateSecurityScansWorkflow(parsedWrongCron), /schedule must include weekly full-history scan cron "17 5 \* \* 1"/);
});

test('negative: rejects NODE_OPTIONS and dangerous runtime options in workflow, job, and step env', () => {
  const parsedWfEnv = YAML.parse(read('security-scans.yml'));
  parsedWfEnv.env = { NODE_OPTIONS: '--require /tmp/malicious.js' };
  assert.throws(() => validateSecurityScansWorkflow(parsedWfEnv), /must not define forbidden runtime environment variable 'NODE_OPTIONS'/);

  const parsedJobEnv = YAML.parse(read('security-scans.yml'));
  parsedJobEnv.jobs.semgrep.env = { NODE_OPTIONS: '--inspect=0.0.0.0' };
  assert.throws(() => validateSecurityScansWorkflow(parsedJobEnv), /must not define forbidden runtime environment variable 'NODE_OPTIONS'/);

  const parsedStepEnv = YAML.parse(read('uss-validation.yml'));
  parsedStepEnv.jobs.validate.steps[2].env = { NODE_OPTIONS: '--openssl-legacy-provider' };
  assert.throws(() => validateUssValidationWorkflow(parsedStepEnv), /must not define forbidden runtime environment variable 'NODE_OPTIONS'/);
});

test('negative: rejects NODE_OPTIONS inline assignments in run scripts', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps[2].run = 'export NODE_OPTIONS="--require malicious"\n' + parsed.jobs.validate.steps[2].run;
  assert.throws(() => validateUssValidationWorkflow(parsed), /must not set NODE_OPTIONS/);
});

test('negative: rejects shell: bash {0} and error-disabling shell overrides', () => {
  const parsedStep = YAML.parse(read('security-scans.yml'));
  parsedStep.jobs.gitleaks.steps[1].shell = 'bash {0}';
  assert.throws(() => validateSecurityScansWorkflow(parsedStep), /disables fail-fast error handling/);

  const parsedSh = YAML.parse(read('security-scans.yml'));
  parsedSh.jobs.gitleaks.steps[1].shell = 'sh {0}';
  assert.throws(() => validateSecurityScansWorkflow(parsedSh), /disables fail-fast error handling/);

  const parsedDefaults = YAML.parse(read('security-scans.yml'));
  parsedDefaults.defaults = { run: { shell: 'bash {0}' } };
  assert.throws(() => validateSecurityScansWorkflow(parsedDefaults), /disables fail-fast error handling/);

  const parsedUnapproved = YAML.parse(read('security-scans.yml'));
  parsedUnapproved.jobs.gitleaks.steps[1].shell = 'pwsh';
  assert.throws(() => validateSecurityScansWorkflow(parsedUnapproved), /specifies unapproved shell 'pwsh'/);

  const parsedCmdShort = YAML.parse(read('security-scans.yml'));
  parsedCmdShort.jobs.gitleaks.steps[1].shell = "bash -e -c 'exit 0' {0}";
  assert.throws(() => validateSecurityScansWorkflow(parsedCmdShort), /bypasses runner script execution/);

  const parsedCmdLong = YAML.parse(read('security-scans.yml'));
  parsedCmdLong.jobs.gitleaks.steps[1].shell = 'bash -e --command "exit 0" {0}';
  assert.throws(() => validateSecurityScansWorkflow(parsedCmdLong), /bypasses runner script execution/);

  const parsedExtraArg = YAML.parse(read('security-scans.yml'));
  parsedExtraArg.jobs.gitleaks.steps[1].shell = 'bash -eo pipefail {0} extra';
  assert.throws(() => validateSecurityScansWorkflow(parsedExtraArg), /must be approved safe shell template/);

  const parsedLeadingArg = YAML.parse(read('security-scans.yml'));
  parsedLeadingArg.jobs.gitleaks.steps[1].shell = 'bash -eo pipefail /bin/true {0}';
  assert.throws(() => validateSecurityScansWorkflow(parsedLeadingArg), /must be approved safe shell template/);

  assert.doesNotThrow(() => assertSafeShell('bash', 'valid bash'));
  assert.doesNotThrow(() => assertSafeShell('bash --noprofile --norc -eo pipefail {0}', 'valid template'));
  assert.doesNotThrow(() => assertSafeShell('bash --noprofile --norc -e -o pipefail {0}', 'valid template'));
});

// ==============================================================================
// Claude Section 18 Adversarial Regression Test Suite (A1 - C1 Remediation)
// ==============================================================================

// Finding A1: Historical Gitleaks suppression
test('finding A1: historical suppression check rejects suppression introduced in earlier commit', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a1-early-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });
    
    // Commit 1: Introduce inline suppression directive
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'secret // ' + ['gitleaks', 'allow'].join(':') + '\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'add secret with inline suppression'], { cwd: tempDir });

    // Commit 2: unrelated clean file
    fs.writeFileSync(path.join(tempDir, 'other.txt'), 'clean\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'add other clean file'], { cwd: tempDir });

    assert.throws(
      () => assertNoHistoricalGitleaksDirectives(tempDir),
      /Prohibited Gitleaks inline suppression directive found in Git history/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding A1: historical suppression check rejects suppression deleted in subsequent commit', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a1-del-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    // Commit 1: Introduce inline suppression directive
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'secret // ' + ['gitleaks', 'allow'].join(':') + '\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'add secret with inline suppression'], { cwd: tempDir });

    // Commit 2: Delete suppression from tip
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'secret removed\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'clean up tip'], { cwd: tempDir });

    assert.throws(
      () => assertNoHistoricalGitleaksDirectives(tempDir),
      /Prohibited Gitleaks inline suppression directive found in Git history/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding A1: historical suppression check passes on clean history', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a1-clean-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'const safe = 42;\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'clean code'], { cwd: tempDir });

    assert.doesNotThrow(() => assertNoHistoricalGitleaksDirectives(tempDir));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding A1: historical suppression check fails closed on Git command error', () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a1-nogit-'));
  try {
    // Non-git directory causes git log to fail
    assert.throws(
      () => assertNoHistoricalGitleaksDirectives(emptyDir),
      /Failed to inspect Git history for prohibited Gitleaks directives/
    );
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

// Finding A2: Git attributes and hidden scanner content
test('finding A2: rejects prohibited .gitattributes configurations (-diff, binary, diff=, filter=, merge=)', () => {
  for (const directive of ['-diff', 'binary', 'diff=astextplain', 'filter=lfs', 'merge=ours']) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a2-attr-'));
    try {
      fs.mkdirSync(path.join(tempDir, 'sub'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'sub', '.gitattributes'), `*.dat ${directive}\n`);
      assert.throws(
        () => assertNoProhibitedGitAttributes(tempDir),
        /Prohibited \.gitattributes configuration is not permitted/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('finding A2: rejects prohibited .git/info/attributes configurations', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a2-infoattr-'));
  try {
    fs.mkdirSync(path.join(tempDir, '.git', 'info'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.git', 'info', 'attributes'), '* -diff\n');
    assert.throws(
      () => assertNoProhibitedGitAttributes(tempDir),
      /Prohibited \.git\/info\/attributes configuration is not permitted/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding A2: rejects symlinked .gitattributes', t => {
  if (process.platform === 'win32') {
    try {
      fs.symlinkSync('target', path.join(os.tmpdir(), 'probe-symlink'));
      fs.unlinkSync(path.join(os.tmpdir(), 'probe-symlink'));
    } catch {
      t.skip('Symlink creation requires elevated privilege on Windows');
      return;
    }
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a2-symlink-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'real.txt'), '*.dat -diff\n');
    fs.symlinkSync('real.txt', path.join(tempDir, '.gitattributes'));
    assert.throws(
      () => assertNoProhibitedGitAttributes(tempDir),
      /Symlinked \.gitattributes is not permitted/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding A2: detects newly introduced binary files in tracked history', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a2-bin-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    // Track a binary file (containing null byte)
    fs.writeFileSync(path.join(tempDir, 'data.bin'), Buffer.from([0, 1, 2, 3, 4]));
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'add binary file'], { cwd: tempDir });

    if (process.platform === 'win32') {
      assertNoTrackedBinaryFiles(tempDir);
    } else {
      assert.throws(
        () => assertNoTrackedBinaryFiles(tempDir),
        /Tracked binary file is not permitted: data\.bin/
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F1: rejects binary file even if contributor attempts self-authorising .allowed-binaries', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f1-binallow-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.writeFileSync(path.join(tempDir, 'data.bin'), Buffer.from([0, 1, 2, 3, 4]));
    fs.writeFileSync(path.join(tempDir, '.allowed-binaries'), 'data.bin\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'attempt binary and self-authorising allowlist'], { cwd: tempDir });

    if (process.platform === 'win32') {
      assertNoTrackedBinaryFiles(tempDir);
    } else {
      assert.throws(
        () => assertNoTrackedBinaryFiles(tempDir),
        /Tracked binary file is not permitted: data\.bin/
      );
    }
    assert.throws(
      () => assertNoAllowedBinariesFile(tempDir),
      /\.allowed-binaries file is prohibited/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// Finding A3: Nested OSV configuration
test('finding A3: rejects nested osv-scanner.toml and .osv-scanner.toml', () => {
  for (const filename of ['osv-scanner.toml', '.osv-scanner.toml']) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a3-nested-'));
    try {
      const nestedDir = path.join(tempDir, 'services', 'api');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, filename), '[[IgnoredVulns]]\nid = "GO-2023"\n');
      assert.throws(
        () => assertNoOsvConfigOverrides(tempDir),
        /Unreviewed OSV configuration override is not permitted/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('finding A3: nested OSV scanner safely excludes .git and node_modules directories', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-a3-safe-'));
  try {
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'node_modules', 'dep'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.git', 'osv-scanner.toml'), 'ignore in git\n');
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'dep', 'osv-scanner.toml'), 'ignore in deps\n');
    assert.doesNotThrow(() => assertNoOsvConfigOverrides(tempDir));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// Finding B1: Environment variable bypass
test('finding B1: rejects dangerous environment variables in workflow, job, and step env', () => {
  const dangerousVars = [
    'BASH_ENV',
    'PATH',
    'NPM_CONFIG_IGNORE_SCRIPTS',
    'NODE_TLS_REJECT_UNAUTHORIZED',
    'GIT_CONFIG_COUNT'
  ];
  for (const v of dangerousVars) {
    const wfEnv = YAML.parse(read('security-scans.yml'));
    wfEnv.env = { [v]: 'malicious' };
    assert.throws(() => validateSecurityScansWorkflow(wfEnv), new RegExp(`must not define forbidden runtime environment variable '${v}'`));

    const jobEnv = YAML.parse(read('security-scans.yml'));
    jobEnv.jobs.semgrep.env = { [v]: 'malicious' };
    assert.throws(() => validateSecurityScansWorkflow(jobEnv), new RegExp(`must not define forbidden runtime environment variable '${v}'`));

    const stepEnv = YAML.parse(read('uss-validation.yml'));
    stepEnv.jobs.validate.steps[2].env = { [v]: 'malicious' };
    assert.throws(() => validateUssValidationWorkflow(stepEnv), new RegExp(`must not define forbidden runtime environment variable '${v}'`));
  }
});

test('finding B1: rejects inline export statements and dangerous variable assignments in run scripts', () => {
  const parsedExport = YAML.parse(read('uss-validation.yml'));
  parsedExport.jobs.validate.steps[2].run = 'export BASH_ENV=/tmp/bad\n' + parsedExport.jobs.validate.steps[2].run;
  assert.throws(() => validateUssValidationWorkflow(parsedExport), /assigns to dangerous environment variable|must not use inline export statements/);

  for (const v of ['BASH_ENV', 'PATH', 'NPM_CONFIG_IGNORE_SCRIPTS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'GIT_CONFIG_COUNT']) {
    const parsedVar = YAML.parse(read('uss-validation.yml'));
    parsedVar.jobs.validate.steps[2].run = `${v}=/tmp/bad\n` + parsedVar.jobs.validate.steps[2].run;
    assert.throws(() => validateUssValidationWorkflow(parsedVar), /assigns to dangerous environment variable/);
  }
});

// Finding B2: Shell failure masking
test('finding B2: rejects piping (|) in uss-validation.yml steps that can mask exit codes', () => {
  for (const pipeTarget of ['cat', 'tee /tmp/log', 'true', 'head -n 5']) {
    const parsed = YAML.parse(read('uss-validation.yml'));
    parsed.jobs.validate.steps[3].run = `node tools/build-modules.mjs | ${pipeTarget}`;
    assert.throws(() => validateUssValidationWorkflow(parsed), /does not match exact approved execution contract|must not pipe commands/);
  }
});

test('finding B2: rejects backgrounding commands with single &', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps[3].run = 'node tools/build-modules.mjs &';
  assert.throws(() => validateUssValidationWorkflow(parsed), /must not background commands/);
});

test('finding B2: rejects command substitution inside echo, printf, and eval', () => {
  const parsedEcho = YAML.parse(read('uss-validation.yml'));
  parsedEcho.jobs.validate.steps[3].run = 'echo "$(node tools/build-modules.mjs)"';
  assert.throws(() => validateUssValidationWorkflow(parsedEcho), /must not mask command failure inside echo\/eval/);

  const parsedEval = YAML.parse(read('uss-validation.yml'));
  parsedEval.jobs.validate.steps[3].run = 'eval "$(node tools/build-modules.mjs)"';
  assert.throws(() => validateUssValidationWorkflow(parsedEval), /must not mask command failure inside echo\/eval/);
});

test('finding B2: rejects conditional block failure masking (if cmd; then :; fi)', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps[3].run = 'if node tools/build-modules.mjs; then :; fi';
  assert.throws(() => validateUssValidationWorkflow(parsed), /must not mask command failure inside conditional block/);
});

test('finding B2: rejects shell function shadowing', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps[2].run = 'npm() { :; }\nnpm ci --ignore-scripts --no-audit --no-fund';
  assert.throws(() => validateUssValidationWorkflow(parsed), /must not define shell functions/);
});

// Finding B3: Structural weakening
test('finding B3: rejects adding unauthorized steps to uss-validation.yml', () => {
  const parsed = YAML.parse(read('uss-validation.yml'));
  parsed.jobs.validate.steps.push({ name: 'Extra unauthorized step', run: 'echo extra' });
  assert.throws(() => validateUssValidationWorkflow(parsed), /must contain exactly 10 steps/);
});

test('finding B3: rejects adding services to jobs', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.semgrep.services = { redis: { image: 'redis:latest' } };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must not declare services/);
});

test('finding B3: rejects overriding working-directory in defaults or steps', () => {
  const parsedDefaults = YAML.parse(read('security-scans.yml'));
  parsedDefaults.defaults = { run: { 'working-directory': 'subdir' } };
  assert.throws(() => validateSecurityScansWorkflow(parsedDefaults), /defaults\.run must not override working-directory/);

  const parsedJobDefaults = YAML.parse(read('security-scans.yml'));
  parsedJobDefaults.jobs.semgrep.defaults = { run: { 'working-directory': 'subdir' } };
  assert.throws(() => validateSecurityScansWorkflow(parsedJobDefaults), /defaults\.run must not override working-directory/);

  const parsedStep = YAML.parse(read('uss-validation.yml'));
  parsedStep.jobs.validate.steps[2]['working-directory'] = 'subdir';
  assert.throws(() => validateUssValidationWorkflow(parsedStep), /must not override working-directory/);
});

test('finding B3: rejects concurrency cancel-in-progress: true', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.concurrency = { group: 'ci', 'cancel-in-progress': true };
  assert.throws(() => validateSecurityScansWorkflow(parsed), /must not set concurrency cancel-in-progress: true/);
});

test('finding B3: rejects unauthorized containers in non-Semgrep jobs', () => {
  const parsed = YAML.parse(read('security-scans.yml'));
  parsed.jobs.gitleaks.container = 'ubuntu:latest';
  assert.throws(() => validateSecurityScansWorkflow(parsed), /non-Semgrep job gitleaks must not declare a container/);
});

// Finding C1: Consumer template protection
test('finding C1: reusable consumer workflow validator validates canonical template', async () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');
  const parsed = YAML.parse(text);
  assert.doesNotThrow(() => validateConsumerWorkflowStructure(parsed, 'consumer-security-scans.yml'));
});

test('finding C1: reusable consumer workflow validator rejects unpinned actions and weakened guards', async () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');
  
  // Unpinned action
  const unpinned = YAML.parse(text);
  unpinned.jobs.secrets.steps[0].uses = 'actions/checkout@v4';
  assert.throws(() => validateConsumerWorkflowStructure(unpinned), /must use pinned action/);

  // Missing config guard
  const missingGuard = YAML.parse(text);
  missingGuard.jobs.secrets.steps = missingGuard.jobs.secrets.steps.filter(s => s.name !== 'Reject unreviewed scanner configuration');
  assert.throws(() => validateConsumerWorkflowStructure(missingGuard), /must contain exactly 3 steps/);

  // Dangerous env variable in semgrep step run (violates execution contract)
  const dangerousEnv = YAML.parse(text);
  dangerousEnv.jobs.semgrep.steps[2].run = 'BASH_ENV=/tmp/bad\n' + dangerousEnv.jobs.semgrep.steps[2].run;
  assert.throws(() => validateConsumerWorkflowStructure(dangerousEnv), /violates strict execution contract/);

  // Dangerous env variable in job env
  const dangerousJobEnv = YAML.parse(text);
  dangerousJobEnv.jobs.semgrep.env = { BASH_ENV: '/tmp/bad' };
  assert.throws(() => validateConsumerWorkflowStructure(dangerousJobEnv), /job-level env is not permitted|contains unapproved key 'env'/);

  // Failure masking via cat
  const failureMasking = YAML.parse(text);
  failureMasking.jobs.semgrep.steps[2].run += ' | cat';
  assert.throws(() => validateConsumerWorkflowStructure(failureMasking), /violates strict execution contract/);
});

// Supervisory Finding F2: Arbitrary Pinned Action Acceptance & Structural Control
test('finding F2: consumer validator rejects third-party actions pinned to valid-looking SHAs', () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');

  // Third-party substitute with valid 40-char SHA
  const maliciousCheckout = YAML.parse(text);
  maliciousCheckout.jobs.secrets.steps[0].uses = 'malicious/checkout@d23441a48e516b6c34aea4fa41551a30e30af803';
  assert.throws(() => validateConsumerWorkflowStructure(maliciousCheckout), /must use pinned action 'actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803'/);

  // Approved action name with unapproved SHA
  const unapprovedShaCheckout = YAML.parse(text);
  unapprovedShaCheckout.jobs.secrets.steps[0].uses = 'actions/checkout@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.throws(() => validateConsumerWorkflowStructure(unapprovedShaCheckout), /must use pinned action 'actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803'/);

  // Malicious secret scanner substitute
  const maliciousGitleaks = YAML.parse(text);
  maliciousGitleaks.jobs.secrets.steps[2].uses = 'attacker/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e';
  assert.throws(() => validateConsumerWorkflowStructure(maliciousGitleaks), /must use pinned action 'gitleaks\/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e'/);

  // Malicious CodeQL init substitute
  const maliciousCodeql = YAML.parse(text);
  maliciousCodeql.jobs.codeql.steps[1].uses = 'attacker/codeql-action/init@33d7b85da1a04171e211befe2c739303b9a4c066';
  assert.throws(() => validateConsumerWorkflowStructure(maliciousCodeql), /must use pinned action 'github\/codeql-action\/init@33d7b85da1a04171e211befe2c739303b9a4c066'/);

  // Malicious OSV reusable workflow substitute
  const maliciousOsv = YAML.parse(text);
  maliciousOsv.jobs.osv.uses = 'attacker/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@d3c1414ded37de590f207572e37a7d180f1d0ef7';
  assert.throws(() => validateConsumerWorkflowStructure(maliciousOsv), /must use pinned reusable workflow/);
});

test('finding F2: consumer validator rejects unapproved action steps, permissions, and altered container digests', () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');

  // Additional action step in secrets job
  const extraStep = YAML.parse(text);
  extraStep.jobs.secrets.steps.push({ name: 'Exfiltrate', uses: 'actions/upload-artifact@v4' });
  assert.throws(() => validateConsumerWorkflowStructure(extraStep), /must contain exactly 3 steps/);

  // Altered container image/digest in semgrep job
  const alteredContainer = YAML.parse(text);
  alteredContainer.jobs.semgrep.container.image = 'semgrep/semgrep:1.186.0@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.throws(() => validateConsumerWorkflowStructure(alteredContainer), /semgrep container image must be exactly/);

  // Altered permissions in secrets job
  const alteredPerms = YAML.parse(text);
  alteredPerms.jobs.secrets.permissions['contents'] = 'write';
  assert.throws(() => validateConsumerWorkflowStructure(alteredPerms), /configuration mismatch|contains unexpected values/);

  // Permissions added to semgrep job
  const semgrepPerms = YAML.parse(text);
  semgrepPerms.jobs.semgrep.permissions = { contents: 'read' };
  assert.throws(() => validateConsumerWorkflowStructure(semgrepPerms), /must inherit read-only workflow permissions/);
});

// Supervisory Finding F3: Strict Execution Contracts and Pipeline Masking Prevention
test('finding F3: rejects pipeline failure masking in uss-validation and consumer workflow', () => {
  // Example pipeline from ChatGPT: node tools/validate.mjs | sed -n '1,10p'
  const parsedUss = YAML.parse(read('uss-validation.yml'));
  parsedUss.jobs.validate.steps[7].run = "node tools/validate.mjs | sed -n '1,10p'";
  assert.throws(() => validateUssValidationWorkflow(parsedUss), /does not match exact approved execution contract|must not pipe commands/);

  // Pipeline in consumer semgrep scan step
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');
  const parsedConsumer = YAML.parse(text);
  parsedConsumer.jobs.semgrep.steps[2].run = "semgrep scan --config p/default --error --strict --disable-nosem --metrics=off . | sed -n '1,10p'";
  assert.throws(() => validateConsumerWorkflowStructure(parsedConsumer), /violates strict execution contract/);

  // Pipeline in security-scans.yml semgrep scan step
  const parsedSec = YAML.parse(read('security-scans.yml'));
  parsedSec.jobs.semgrep.steps[2].run += " | sed -n '1,10p'";
  assert.throws(() => validateSecurityScansWorkflow(parsedSec), /Semgrep must use the exact approved ruleset|must not pipe commands/);

  // Additional pipeline variants: awk, head, tee, true
  for (const pipeTarget of ['awk \'{print}\'', 'head -n 1', 'tee /tmp/out', 'true']) {
    const parsed = YAML.parse(read('uss-validation.yml'));
    parsed.jobs.validate.steps[7].run = `node tools/validate.mjs | ${pipeTarget}`;
    assert.throws(() => validateUssValidationWorkflow(parsed), /does not match exact approved execution contract|must not pipe commands/);
  }
});

// Supervisory Finding F4: Comprehensive Sensitive Execution Environment Protection
test('finding F4: rejects all execution-sensitive environment variables across workflows', () => {
  const sensitiveVars = [
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_WORK_TREE',
    'GIT_EXEC_PATH',
    'GIT_OBJECT_DIRECTORY',
    'GIT_SSH_COMMAND',
    'GIT_CONFIG_COUNT',
    'LD_PRELOAD',
    'LD_LIBRARY_PATH',
    'NODE_EXTRA_CA_CERTS',
    'PYTHONPATH',
    'DYLD_INSERT_LIBRARIES',
    'DYLD_LIBRARY_PATH',
    'PERL5LIB',
    'RUBYOPT',
    'BASH_ENV',
    'PATH',
    'IFS',
    'SHELLOPTS',
    'BASHOPTS',
    'ENV'
  ];

  const consumerText = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');

  for (const v of sensitiveVars) {
    // Workflow-level env injection
    const wfEnv = YAML.parse(read('security-scans.yml'));
    wfEnv.env = { [v]: '/malicious' };
    assert.throws(() => validateSecurityScansWorkflow(wfEnv), new RegExp(`must not define forbidden runtime environment variable '${v}'`));

    // Consumer workflow-level env injection
    const consumerWfEnv = YAML.parse(consumerText);
    consumerWfEnv.env = { [v]: '/malicious' };
    assert.throws(() => validateConsumerWorkflowStructure(consumerWfEnv), /workflow-level env is not permitted|unapproved workflow-level key 'env'/);

    // Job-level env injection
    const jobEnv = YAML.parse(read('security-scans.yml'));
    jobEnv.jobs.semgrep.env = { [v]: '/malicious' };
    assert.throws(() => validateSecurityScansWorkflow(jobEnv), new RegExp(`must not define forbidden runtime environment variable '${v}'`));

    // Step-level env injection in uss-validation.yml
    const stepEnv = YAML.parse(read('uss-validation.yml'));
    stepEnv.jobs.validate.steps[2].env = { [v]: '/malicious' };
    assert.throws(() => validateUssValidationWorkflow(stepEnv), new RegExp(`must not define forbidden runtime environment variable '${v}'`));

    // Inline assignment in run script
    const inlineRun = YAML.parse(read('uss-validation.yml'));
    inlineRun.jobs.validate.steps[2].run = `${v}=/malicious\n` + inlineRun.jobs.validate.steps[2].run;
    assert.throws(() => validateUssValidationWorkflow(inlineRun), /assigns to dangerous environment variable|does not match exact approved execution contract/);
  }
});

// Supervisory Finding F5: Positive Git Attributes and Binary Detection Bypass
test('finding F5: rejects positive diff attribute in .gitattributes and .git/info/attributes', () => {
  for (const directive of ['diff', '*.bin diff', '!diff', '-diff', 'diff=custom', 'binary', '-binary', '!binary', 'filter=lfs', 'merge=ours']) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-attr-'));
    try {
      fs.writeFileSync(path.join(tempDir, '.gitattributes'), `secret.bin ${directive}\n`);
      assert.throws(
        () => assertNoProhibitedGitAttributes(tempDir),
        /Prohibited \.gitattributes configuration is not permitted/
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    const tempDirInfo = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-infoattr-'));
    try {
      fs.mkdirSync(path.join(tempDirInfo, '.git', 'info'), { recursive: true });
      fs.writeFileSync(path.join(tempDirInfo, '.git', 'info', 'attributes'), `secret.bin ${directive}\n`);
      assert.throws(
        () => assertNoProhibitedGitAttributes(tempDirInfo),
        /Prohibited \.git\/info\/attributes configuration is not permitted/
      );
    } finally {
      fs.rmSync(tempDirInfo, { recursive: true, force: true });
    }
  }
});

test('finding F5: binary file cannot evade detection when positive diff attribute is set', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-evasion-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    // Track a binary file and attempt evasion with positive diff attribute
    fs.writeFileSync(path.join(tempDir, 'payload.bin'), Buffer.from([0, 1, 2, 3, 4]));
    fs.writeFileSync(path.join(tempDir, '.gitattributes'), '*.bin diff\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'attempt binary evasion with diff attr'], { cwd: tempDir });

    // Defense 1: Attribute check catches positive diff attribute
    assert.throws(
      () => assertNoProhibitedGitAttributes(tempDir),
      /Prohibited \.gitattributes configuration is not permitted/
    );

    // Defense 2: Independent content inspection catches binary null byte even if git diff is tricked
    if (process.platform === 'win32') {
      assertNoTrackedBinaryFiles(tempDir);
    } else {
      assert.throws(
        () => assertNoTrackedBinaryFiles(tempDir),
        /Tracked binary/
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F5: preserves legitimate .gitattributes configurations and comments', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-legit-'));
  try {
    fs.writeFileSync(
      path.join(tempDir, '.gitattributes'),
      [
        '# This comment mentions diff and binary without configuring them',
        '* text=auto',
        '*.sh text eol=lf',
        '*.bat text eol=crlf',
        '*.ps1 text eol=crlf',
        '*.md text'
      ].join('\n') + '\n'
    );
    assert.doesNotThrow(() => assertNoProhibitedGitAttributes(tempDir));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F5: streaming binary scanner detects NUL bytes at multiple offsets including beyond 8000 bytes and near EOF', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const offsetsToTest = [
    { name: 'start of file (offset 0)', size: 100, offset: 0 },
    { name: 'middle of small file (offset 512)', size: 1024, offset: 512 },
    { name: 'beyond 8000-byte heuristic (offset 8500)', size: 12000, offset: 8500 },
    { name: 'across 1MB chunk boundary (offset 1500000)', size: 1600000, offset: 1500000 },
    { name: 'near end of large 2MB file (offset 2097140)', size: 2097152, offset: 2097140 }
  ];

  for (const { name, size, offset } of offsetsToTest) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-offset-'));
    try {
      spawnSync('git', ['init', '-q'], { cwd: tempDir });
      spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
      spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
      spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

      const buf = Buffer.alloc(size, 0x41); // 'A'
      buf[offset] = 0x00; // NUL byte
      fs.writeFileSync(path.join(tempDir, 'sample.data'), buf);
      spawnSync('git', ['add', 'sample.data'], { cwd: tempDir });

      const res = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
      if (process.platform === 'win32') {
        assert.equal(res.status, 2, 'Scanner must fail closed by default on win32');
        assert.match(res.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
      } else {
        assert.equal(res.status, 1, `Scanner must exit 1 for NUL byte at ${name}`);
        assert.match(res.stderr, /FAIL: tracked binary file contains NUL byte: sample\.data/, `Error must identify file with NUL byte at ${name}`);
      }

      if (process.platform === 'win32') {
        assertNoTrackedBinaryFiles(tempDir);
      } else {
        assert.throws(
          () => assertNoTrackedBinaryFiles(tempDir),
          /Tracked binary file is not permitted/,
          `assertNoTrackedBinaryFiles must throw for NUL byte at ${name}`
        );
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('finding F5: streaming binary scanner handles unusual filenames and fails closed on missing tracked paths', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-filenames-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.mkdirSync(path.join(tempDir, 'nested dir with spaces'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'nested dir with spaces', 'sub file with spaces.txt'), 'clean text content\n');
    fs.writeFileSync(path.join(tempDir, 'special-symbols-#@!-$%.txt'), 'more clean content\n');
    fs.writeFileSync(path.join(tempDir, "quote'file.txt"), 'quote content\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });

    const cleanRes = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
    if (process.platform === 'win32') {
      assert.equal(cleanRes.status, 2, 'Scanner must fail closed by default on win32');
      assert.match(cleanRes.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
      assertNoTrackedBinaryFiles(tempDir);
    } else {
      assert.equal(cleanRes.status, 0, 'Clean repository with unusual filenames must pass');
      assert.match(cleanRes.stdout, /PASS: complete content scan found no NUL bytes/);
      assert.doesNotThrow(() => assertNoTrackedBinaryFiles(tempDir));
    }

    // Introduce NUL byte into unusual filename
    const evilBuf = Buffer.alloc(200, 0x42);
    evilBuf[100] = 0x00;
    fs.writeFileSync(path.join(tempDir, 'special-symbols-#@!-$%.txt'), evilBuf);
    const evilRes = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
    if (process.platform === 'win32') {
      assert.equal(evilRes.status, 2, 'Scanner must fail closed by default on win32');
      assert.match(evilRes.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.equal(evilRes.status, 1, 'Scanner must detect NUL in file with unusual name');
      assert.match(evilRes.stderr, /FAIL: tracked binary file contains NUL byte: special-symbols-#@!-\$%\.txt/);
    }

    // Fail closed: Tracked file deleted from working tree before scan
    fs.writeFileSync(path.join(tempDir, 'special-symbols-#@!-$%.txt'), 'restored clean text\n');
    fs.writeFileSync(path.join(tempDir, 'ghost.txt'), 'ghost file\n');
    spawnSync('git', ['add', 'ghost.txt'], { cwd: tempDir });
    fs.rmSync(path.join(tempDir, 'ghost.txt')); // deleted from disk but in index!

    const failClosedRes = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(failClosedRes.status, 2, 'Scanner must fail closed (exit 2) when a tracked file cannot be inspected');
    if (process.platform === 'win32') {
      assert.match(failClosedRes.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.match(failClosedRes.stderr, /FAIL CLOSED: cannot inspect tracked path ghost\.txt/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F5: actual workflow guard script executes and rejects malicious binary fixtures', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-guard-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Guard Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'guard-test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    for (const dir of ['tools', 'tests', '.github/workflows', 'templates']) {
      fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
    }
    fs.writeFileSync(path.join(tempDir, 'tools/clean.txt'), 'clean content\n');
    fs.writeFileSync(path.join(tempDir, 'tests/check.mjs'), 'const ok = true;\n');
    fs.writeFileSync(path.join(tempDir, '.github/workflows/test.yml'), 'name: test\n');
    fs.writeFileSync(path.join(tempDir, 'templates/test.yml'), 'name: test\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'clean tree'], { cwd: tempDir });

    const bashEnv = process.platform === 'win32'
      ? { ...process.env, PATH: 'C:\\Program Files\\Git\\usr\\bin;C:\\Users\\HP\\AppData\\Roaming\\Python\\Python314\\Scripts;' + (process.env.PATH || '') }
      : { ...process.env };

    // Clean run of actual SCANNER_CONFIG_GUARD_RUN
    const cleanGuardRun = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd: tempDir, encoding: 'utf8', env: bashEnv, input: SCANNER_CONFIG_GUARD_RUN });
    if (process.platform === 'win32') {
      assert.equal(cleanGuardRun.status, 2, 'Actual workflow guard must fail closed on win32: ' + cleanGuardRun.stderr);
      assert.match(cleanGuardRun.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.equal(cleanGuardRun.status, 0, 'Actual workflow guard must succeed on clean tree: ' + cleanGuardRun.stderr);
      assert.match(cleanGuardRun.stdout, /PASS: complete content scan found no NUL bytes/);
    }

    // Malicious fixture: binary file with NUL byte beyond 8000 bytes
    const evilBuf = Buffer.alloc(10000, 0x41);
    evilBuf[8500] = 0x00;
    fs.writeFileSync(path.join(tempDir, 'tools/malicious.bin'), evilBuf);
    spawnSync('git', ['add', 'tools/malicious.bin'], { cwd: tempDir });

    const evilGuardRun = spawnSync('bash', ['--norc', '--noprofile', '-s'], { cwd: tempDir, encoding: 'utf8', env: bashEnv, input: SCANNER_CONFIG_GUARD_RUN });
    assert.notEqual(evilGuardRun.status, 0, 'Actual workflow guard must reject malicious binary fixture');
    if (process.platform === 'win32') {
      assert.equal(evilGuardRun.status, 2, 'Workflow guard must fail closed on win32');
      assert.match(evilGuardRun.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.match(evilGuardRun.stderr, /FAIL: tracked binary file contains NUL byte: tools\/malicious\.bin/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F5-R1: rejects parent-directory symlink traversal even when destination contains clean file', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-r1-symlink-'));
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-r1-ext-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Symlink Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'symlink-test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    // Track a file containing a NUL byte in sub/child/payload.bin
    fs.mkdirSync(path.join(tempDir, 'sub', 'child'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'sub', 'child', 'payload.bin'), Buffer.from('adversarial\0content'));
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'tracked malicious blob'], { cwd: tempDir });

    // Prepare external clean directory with clean file of same name
    fs.writeFileSync(path.join(externalDir, 'payload.bin'), 'clean external content\n');

    // Replace parent directory 'sub' with a symlink / junction to external clean directory
    fs.rmSync(path.join(tempDir, 'sub'), { recursive: true, force: true });
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(externalDir, path.join(tempDir, 'sub'), linkType);

    const res = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
    if (process.platform === 'win32') {
      assert.equal(res.status, 2, 'Scanner must fail closed by default on win32');
      assert.match(res.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.equal(res.status, 1, 'Scanner must exit 1 when parent directory is a symbolic link');
      assert.match(res.stderr, /FAIL: parent directory component is a symbolic link/);
      assert.doesNotMatch(res.stdout, /PASS: complete content scan found no NUL bytes/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
});

test('finding F5-R1: multi-level nested tracked files pass cleanly', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-r1-nested-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Nested Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'nested-test@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.mkdirSync(path.join(tempDir, 'a', 'b', 'c', 'd'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'a', 'b', 'c', 'd', 'nested.txt'), 'clean multi-level content\n');
    fs.writeFileSync(path.join(tempDir, 'root_file.txt'), 'root clean\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'clean nested files'], { cwd: tempDir });

    const res = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
    if (process.platform === 'win32') {
      assert.equal(res.status, 2, 'Scanner must fail closed by default on win32');
      assert.match(res.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.equal(res.status, 0, 'Clean multi-level nested files must pass with exit 0: ' + res.stderr);
      assert.match(res.stdout, /PASS: complete content scan found no NUL bytes/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F5-R1: symlinked leaf file is safely handled without traversing outside repository', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-r1-leafsymlink-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Symlink Leaf User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'symlink-leaf@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.writeFileSync(path.join(tempDir, 'clean_target.txt'), 'clean regular file content\n');
    try {
      fs.symlinkSync('clean_target.txt', path.join(tempDir, 'clean_link.txt'));
      spawnSync('git', ['add', 'clean_target.txt', 'clean_link.txt'], { cwd: tempDir });
      spawnSync('git', ['commit', '-m', 'add target and symlink'], { cwd: tempDir });

      const res = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, encoding: 'utf8' });
      if (process.platform === 'win32') {
        assert.equal(res.status, 2, 'Scanner must fail closed by default on win32');
        assert.match(res.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
      } else {
        assert.equal(res.status, 0, 'Clean symlink leaf must pass scanner with exit 0: ' + res.stderr);
        assert.match(res.stdout, /PASS: complete content scan found no NUL bytes/);
      }
    } catch (symlinkErr) {
      if (symlinkErr.code !== 'EPERM') throw symlinkErr;
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding F5-R1: fails closed on unsupported platforms when directory-descriptor traversal is required', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');

  if (process.platform === 'win32') {
    const cliRes = spawnSync(pythonBin, [scannerPath], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(cliRes.status, 2, 'Scanner must fail closed by default on win32');
    assert.match(cliRes.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
  }
});

test('finding F5-R1: live workflow guard rejects parent-directory symlink malicious fixture', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-r1-guard-'));
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-f5-r1-guard-ext-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Guard Symlink User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'guard-symlink@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    for (const dir of ['tools', 'tests', '.github/workflows', 'templates']) {
      fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
    }
    fs.writeFileSync(path.join(tempDir, 'tools/clean.txt'), 'clean content\n');
    fs.writeFileSync(path.join(tempDir, 'tests/check.mjs'), 'const ok = true;\n');
    fs.writeFileSync(path.join(tempDir, '.github/workflows/test.yml'), 'name: test\n');
    fs.writeFileSync(path.join(tempDir, 'templates/test.yml'), 'name: test\n');

    fs.mkdirSync(path.join(tempDir, 'sub', 'child'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'sub', 'child', 'blob.bin'), Buffer.from('adversarial\0blob'));
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'clean tree plus tracked malicious blob'], { cwd: tempDir });

    fs.writeFileSync(path.join(externalDir, 'blob.bin'), 'clean external content\n');
    fs.rmSync(path.join(tempDir, 'sub'), { recursive: true, force: true });
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(externalDir, path.join(tempDir, 'sub'), linkType);

    const bashEnv = process.platform === 'win32'
      ? { ...process.env, PATH: 'C:\\Program Files\\Git\\usr\\bin;C:\\Users\\HP\\AppData\\Roaming\\Python\\Python314\\Scripts;' + (process.env.PATH || '') }
      : { ...process.env };

    const guardRun = spawnSync('bash', ['--norc', '--noprofile', '-s'], {
      cwd: tempDir,
      encoding: 'utf8',
      env: bashEnv,
      input: SCANNER_CONFIG_GUARD_RUN
    });

    if (process.platform === 'win32') {
      assert.equal(guardRun.status, 2, 'Live workflow guard must fail closed by default on unsupported win32 platform');
      assert.match(guardRun.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.notEqual(guardRun.status, 0, 'Live workflow guard must reject parent symlink fixture');
      assert.match(guardRun.stderr, /FAIL: parent directory component is a symbolic link/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(externalDir, { recursive: true, force: true });
  }
});

// Supervisory Finding P2-01: GIT Environment Poisoning Prevention
test('finding P2-01: scanner rejects GIT environment poisoning and detects tracked NUL byte regardless of injected variables', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p201-target-'));
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p201-empty-'));

  try {
    // 1. Target repository has tracked binary file with NUL byte
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'P2-01 Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'p201@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.writeFileSync(path.join(tempDir, 'malicious.bin'), Buffer.from([0x48, 0x65, 0x00, 0x6c, 0x6f])); // "He\0lo"
    spawnSync('git', ['add', 'malicious.bin'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'tracked malicious binary'], { cwd: tempDir });

    // 2. Empty external repository with clean text file
    spawnSync('git', ['init', '-q'], { cwd: emptyDir });
    spawnSync('git', ['config', 'user.name', 'Clean User'], { cwd: emptyDir });
    spawnSync('git', ['config', 'user.email', 'clean@example.com'], { cwd: emptyDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: emptyDir });
    fs.writeFileSync(path.join(emptyDir, 'clean.txt'), 'clean content\n');
    spawnSync('git', ['add', 'clean.txt'], { cwd: emptyDir });
    spawnSync('git', ['commit', '-m', 'clean tree'], { cwd: emptyDir });

    // Variables identified by Claude
    const attackVectors = [
      { name: 'GIT_DIR pointing to empty repository', env: { GIT_DIR: path.join(emptyDir, '.git') } },
      { name: 'GIT_INDEX_FILE pointing to external index', env: { GIT_INDEX_FILE: path.join(emptyDir, '.git', 'index') } },
      { name: 'GIT_WORK_TREE pointing to external directory', env: { GIT_WORK_TREE: emptyDir } },
      { name: 'GIT_EXEC_PATH pointing to invalid path', env: { GIT_EXEC_PATH: path.join(emptyDir, 'fake-bin') } },
      { name: 'GIT_OBJECT_DIRECTORY pointing to external objects', env: { GIT_OBJECT_DIRECTORY: path.join(emptyDir, '.git', 'objects') } },
      { name: 'GIT_SSH_COMMAND pointing to failing command', env: { GIT_SSH_COMMAND: 'exit 1' } },
      {
        name: 'Combined GIT_* variables injected simultaneously',
        env: {
          GIT_DIR: path.join(emptyDir, '.git'),
          GIT_INDEX_FILE: path.join(emptyDir, '.git', 'index'),
          GIT_WORK_TREE: emptyDir,
          GIT_EXEC_PATH: path.join(emptyDir, 'fake-bin'),
          GIT_OBJECT_DIRECTORY: path.join(emptyDir, '.git', 'objects'),
          GIT_SSH_COMMAND: 'exit 1',
          GIT_CONFIG_COUNT: '1'
        }
      }
    ];

    for (const { name, env: injectedEnv } of attackVectors) {
      const runEnv = { ...process.env, ...injectedEnv };
      const res = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, env: runEnv, encoding: 'utf8' });

      if (process.platform === 'win32') {
        assert.equal(res.status, 2, `Scanner must fail closed on win32 under ${name}`);
        assert.match(res.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
      } else {
        assert.equal(res.status, 1, `Scanner must reject binary file despite injected ${name}`);
        assert.match(res.stderr, /FAIL: tracked binary file contains NUL byte: malicious\.bin/, `Diagnostic must identify binary file under ${name}`);
        assert.doesNotMatch(res.stdout, /PASS: complete content scan found no NUL bytes/, `Scanner must not report PASS under ${name}`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

test('finding P2-01: live workflow guard unsets inherited GIT_* variables and rejects malicious binary fixture', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p201-guard-'));
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p201-guard-empty-'));

  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'Guard P201 User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'guard-p201@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    for (const dir of ['tools', 'tests', '.github/workflows', 'templates']) {
      fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
    }
    fs.writeFileSync(path.join(tempDir, 'tools/clean.txt'), 'clean content\n');
    fs.writeFileSync(path.join(tempDir, 'tests/check.mjs'), 'const ok = true;\n');
    fs.writeFileSync(path.join(tempDir, '.github/workflows/test.yml'), 'name: test\n');
    fs.writeFileSync(path.join(tempDir, 'templates/test.yml'), 'name: test\n');

    // Introduce malicious binary file
    fs.writeFileSync(path.join(tempDir, 'tools/malicious.bin'), Buffer.from('exploit\0content'));
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'clean tree plus malicious binary'], { cwd: tempDir });

    // Empty repo to attempt redirection
    spawnSync('git', ['init', '-q'], { cwd: emptyDir });
    spawnSync('git', ['config', 'user.name', 'Clean User'], { cwd: emptyDir });
    spawnSync('git', ['config', 'user.email', 'clean@example.com'], { cwd: emptyDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: emptyDir });
    fs.writeFileSync(path.join(emptyDir, 'clean.txt'), 'clean\n');
    spawnSync('git', ['add', '.'], { cwd: emptyDir });
    spawnSync('git', ['commit', '-m', 'clean'], { cwd: emptyDir });

    const bashEnv = {
      ...process.env,
      GIT_DIR: path.join(emptyDir, '.git'),
      GIT_WORK_TREE: emptyDir,
      GIT_INDEX_FILE: path.join(emptyDir, '.git', 'index'),
      GIT_OBJECT_DIRECTORY: path.join(emptyDir, '.git', 'objects'),
      ...(process.platform === 'win32'
        ? { PATH: 'C:\\Program Files\\Git\\usr\\bin;C:\\Users\\HP\\AppData\\Roaming\\Python\\Python314\\Scripts;' + (process.env.PATH || '') }
        : {})
    };

    const guardRun = spawnSync('bash', ['--norc', '--noprofile', '-s'], {
      cwd: tempDir,
      encoding: 'utf8',
      env: bashEnv,
      input: SCANNER_CONFIG_GUARD_RUN
    });

    if (process.platform === 'win32') {
      assert.equal(guardRun.status, 2, 'Live workflow guard must fail closed by default on unsupported win32 platform');
      assert.match(guardRun.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.notEqual(guardRun.status, 0, 'Live workflow guard must reject malicious fixture despite poisoned GIT_* env');
      assert.match(guardRun.stderr, /FAIL: tracked binary file contains NUL byte: tools\/malicious\.bin/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

// Supervisory Finding P3-04: Scanner executable hijacking (PATH poisoning, fake git, wrappers, symlinks)
test('finding P3-04: scanner rejects fake git executable prepended to PATH and resolves trusted git to detect tracked NUL byte', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-fake-'));
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-fakebin-'));

  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'P304 Test User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'p304@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    fs.writeFileSync(path.join(tempDir, 'malicious.bin'), Buffer.from('exploit\0content'));
    spawnSync('git', ['add', 'malicious.bin'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'tracked malicious binary'], { cwd: tempDir });

    // Create fake git in fakeBinDir (pretends to be git, outputs nothing, exits 0)
    const fakeGitPath = path.join(fakeBinDir, process.platform === 'win32' ? 'git.cmd' : 'git');
    if (process.platform === 'win32') {
      fs.writeFileSync(fakeGitPath, '@echo off\r\nexit /b 0\r\n');
    } else {
      fs.writeFileSync(fakeGitPath, '#!/bin/sh\nexit 0\n');
      fs.chmodSync(fakeGitPath, 0o755);
    }

    // Prepend fakeBinDir to PATH
    const poisonedEnv = {
      ...process.env,
      PATH: fakeBinDir + path.delimiter + (process.env.PATH || '')
    };

    const res = spawnSync(pythonBin, [scannerPath], { cwd: tempDir, env: poisonedEnv, encoding: 'utf8' });

    if (process.platform === 'win32') {
      assert.equal(res.status, 2, 'Scanner must fail closed on win32');
      assert.match(res.stderr, /FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: win32/);
    } else {
      assert.equal(res.status, 1, 'Scanner must reject binary file despite fake git prepended to PATH');
      assert.match(res.stderr, /FAIL: tracked binary file contains NUL byte: malicious\.bin/);
      assert.doesNotMatch(res.stdout, /PASS: complete content scan found no NUL bytes/);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(fakeBinDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner fails closed when only untrusted git executables exist in PATH', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-untrusted-'));
  const fakeBinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-fakeonly-'));

  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'P304 Untrusted User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'p304u@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'hello\n');
    spawnSync('git', ['add', '.'], { cwd: tempDir });
    spawnSync('git', ['commit', '-m', 'commit'], { cwd: tempDir });

    const fakeGitPath = path.join(fakeBinDir, process.platform === 'win32' ? 'git.cmd' : 'git');
    if (process.platform === 'win32') {
      fs.writeFileSync(fakeGitPath, '@echo off\r\necho git version 2.99.0\r\nexit /b 0\r\n');
    } else {
      fs.writeFileSync(fakeGitPath, '#!/bin/sh\necho "git version 2.99.0"\nexit 0\n');
      fs.chmodSync(fakeGitPath, 0o755);
    }

    const isolatedEnv = {
      ...process.env,
      PATH: fakeBinDir,
      ProgramFiles: path.join(fakeBinDir, 'nonexistent'),
      'ProgramFiles(x86)': path.join(fakeBinDir, 'nonexistent'),
      LOCALAPPDATA: path.join(fakeBinDir, 'nonexistent')
    };

    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      `found_git = scope["resolve_trusted_git"]({}, candidate_dirs=[${JSON.stringify(fakeBinDir)}])`,
      'if found_git is None:',
      '    print("RESOLVE_FAILED_SAFELY")',
      '    sys.exit(2)',
      'else:',
      '    print("RESOLVED_UNEXPECTED:", found_git)',
      '    sys.exit(0)'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, env: isolatedEnv, encoding: 'utf8' });
    assert.equal(pyRun.status, 2, `Must fail closed when only untrusted fake git exists in PATH. Output: ${pyRun.stdout} ${pyRun.stderr}`);
    assert.match(pyRun.stdout, /RESOLVE_FAILED_SAFELY/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(fakeBinDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects non-root-owned Git installation directories on POSIX', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-nonroot-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      'sys_orig = sys.platform',
      'sys.platform = "linux"',
      'candidate_dir = os.path.realpath("/opt/mock_trusted_git/bin")',
      'candidate_exe = os.path.join(candidate_dir, "git")',
      'class MockStat:',
      '    def __init__(self, mode, uid):',
      '        self.st_mode = mode',
      '        self.st_uid = uid',
      'curr_uid = [1000]',
      'def mock_stat(p, *args, **kwargs):',
      '    rp = os.path.realpath(p)',
      '    if rp == candidate_dir:',
      '        return MockStat(0o040755, curr_uid[0])',
      '    if rp == candidate_exe:',
      '        return MockStat(0o100755, 0)',
      '    return MockStat(0o040755, 0)',
      'orig_isdir = os.path.isdir',
      'orig_isfile = os.path.isfile',
      'def mock_isdir(p):',
      '    if os.path.realpath(p) == candidate_dir: return True',
      '    return orig_isdir(p)',
      'def mock_isfile(p):',
      '    if os.path.realpath(p) == candidate_exe: return True',
      '    return orig_isfile(p)',
      'orig_run = subprocess.run',
      'def mock_run(cmd, *args, **kwargs):',
      '    class Res:',
      '        stdout = b"git version 2.45.0\\n"',
      '    return Res()',
      'os.stat = mock_stat',
      'os.path.isdir = mock_isdir',
      'os.path.isfile = mock_isfile',
      'os.access = lambda p, m: True',
      'subprocess.run = mock_run',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      '# When curr_uid is 1000 (non-root):',
      'curr_uid[0] = 1000',
      'res_non_root = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_non_root is None, f"Expected non-root directory to be rejected, got: {res_non_root}"',
      '# When curr_uid is 0 (root):',
      'curr_uid[0] = 0',
      'res_root = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_root == candidate_exe, f"Expected candidate_exe when owned by root, got: {res_root}"',
      'print("NON_ROOT_DIR_REJECTED_DIFFERENTIALLY")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /NON_ROOT_DIR_REJECTED_DIFFERENTIALLY/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects group-writable Git installation directories even if owned by root', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-groupwrite-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      'sys_orig = sys.platform',
      'sys.platform = "linux"',
      'candidate_dir = os.path.realpath("/opt/mock_trusted_git/bin")',
      'candidate_exe = os.path.join(candidate_dir, "git")',
      'class MockStat:',
      '    def __init__(self, mode, uid):',
      '        self.st_mode = mode',
      '        self.st_uid = uid',
      'curr_mode = [0o040775]',
      'def mock_stat(p, *args, **kwargs):',
      '    rp = os.path.realpath(p)',
      '    if rp == candidate_dir:',
      '        return MockStat(curr_mode[0], 0)',
      '    if rp == candidate_exe:',
      '        return MockStat(0o100755, 0)',
      '    return MockStat(0o040755, 0)',
      'orig_isdir = os.path.isdir',
      'orig_isfile = os.path.isfile',
      'def mock_isdir(p):',
      '    if os.path.realpath(p) == candidate_dir: return True',
      '    return orig_isdir(p)',
      'def mock_isfile(p):',
      '    if os.path.realpath(p) == candidate_exe: return True',
      '    return orig_isfile(p)',
      'orig_run = subprocess.run',
      'def mock_run(cmd, *args, **kwargs):',
      '    class Res:',
      '        stdout = b"git version 2.45.0\\n"',
      '    return Res()',
      'os.stat = mock_stat',
      'os.path.isdir = mock_isdir',
      'os.path.isfile = mock_isfile',
      'os.access = lambda p, m: True',
      'subprocess.run = mock_run',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      '# When group-writable (0o020):',
      'curr_mode[0] = 0o040775',
      'res_gw = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_gw is None, f"Expected group-writable dir to be rejected, got: {res_gw}"',
      '# When safe (0o040755):',
      'curr_mode[0] = 0o040755',
      'res_safe = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_safe == candidate_exe, f"Expected candidate_exe when safe, got: {res_safe}"',
      'print("GROUP_WRITABLE_DIR_REJECTED_DIFFERENTIALLY")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /GROUP_WRITABLE_DIR_REJECTED_DIFFERENTIALLY/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects group-writable and world-writable Git executables', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-exeperms-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      'sys_orig = sys.platform',
      'sys.platform = "linux"',
      'candidate_dir = os.path.realpath("/opt/mock_trusted_git/bin")',
      'candidate_exe = os.path.join(candidate_dir, "git")',
      'class MockStat:',
      '    def __init__(self, mode, uid):',
      '        self.st_mode = mode',
      '        self.st_uid = uid',
      'exe_mode = [0o100777]',
      'def mock_stat(p, *args, **kwargs):',
      '    rp = os.path.realpath(p)',
      '    if rp == candidate_dir:',
      '        return MockStat(0o040755, 0)',
      '    if rp == candidate_exe:',
      '        return MockStat(exe_mode[0], 0)',
      '    return MockStat(0o040755, 0)',
      'orig_isdir = os.path.isdir',
      'orig_isfile = os.path.isfile',
      'def mock_isdir(p):',
      '    if os.path.realpath(p) == candidate_dir: return True',
      '    return orig_isdir(p)',
      'def mock_isfile(p):',
      '    if os.path.realpath(p) == candidate_exe: return True',
      '    return orig_isfile(p)',
      'orig_run = subprocess.run',
      'def mock_run(cmd, *args, **kwargs):',
      '    class Res:',
      '        stdout = b"git version 2.45.0\\n"',
      '    return Res()',
      'os.stat = mock_stat',
      'os.path.isdir = mock_isdir',
      'os.path.isfile = mock_isfile',
      'os.access = lambda p, m: True',
      'subprocess.run = mock_run',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      '# When exe is world/group-writable (0o100777):',
      'exe_mode[0] = 0o100777',
      'res_gw = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_gw is None, f"Expected writable exe to be rejected, got: {res_gw}"',
      '# When exe is safe (0o100755):',
      'exe_mode[0] = 0o100755',
      'res_safe = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_safe == candidate_exe, f"Expected candidate_exe when safe, got: {res_safe}"',
      'print("WRITABLE_EXE_REJECTED_DIFFERENTIALLY")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /WRITABLE_EXE_REJECTED_DIFFERENTIALLY/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects writable parent directory in POSIX ancestor chain', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-ancestor-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      'sys_orig = sys.platform',
      'sys.platform = "linux"',
      'candidate_dir = os.path.realpath("/opt/mock_trusted_git/bin")',
      'parent_dir = os.path.realpath("/opt/mock_trusted_git")',
      'candidate_exe = os.path.join(candidate_dir, "git")',
      'class MockStat:',
      '    def __init__(self, mode, uid):',
      '        self.st_mode = mode',
      '        self.st_uid = uid',
      'parent_mode = [0o040775]',
      'def mock_stat(p, *args, **kwargs):',
      '    rp = os.path.realpath(p)',
      '    if rp == candidate_dir:',
      '        return MockStat(0o040755, 0)',
      '    if rp == candidate_exe:',
      '        return MockStat(0o100755, 0)',
      '    if rp == parent_dir:',
      '        return MockStat(parent_mode[0], 0)',
      '    return MockStat(0o040755, 0)',
      'orig_isdir = os.path.isdir',
      'orig_isfile = os.path.isfile',
      'def mock_isdir(p):',
      '    if os.path.realpath(p) in (candidate_dir, parent_dir): return True',
      '    return orig_isdir(p)',
      'def mock_isfile(p):',
      '    if os.path.realpath(p) == candidate_exe: return True',
      '    return orig_isfile(p)',
      'orig_run = subprocess.run',
      'def mock_run(cmd, *args, **kwargs):',
      '    class Res:',
      '        stdout = b"git version 2.45.0\\n"',
      '    return Res()',
      'os.stat = mock_stat',
      'os.path.isdir = mock_isdir',
      'os.path.isfile = mock_isfile',
      'os.access = lambda p, m: True',
      'subprocess.run = mock_run',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      '# When parent directory is group-writable (0o040775):',
      'parent_mode[0] = 0o040775',
      'res_gw = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_gw is None, f"Expected writable parent ancestor to cause rejection, got: {res_gw}"',
      '# When parent directory is safe (0o040755):',
      'parent_mode[0] = 0o040755',
      'res_safe = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert res_safe == candidate_exe, f"Expected candidate_exe when parent is safe, got: {res_safe}"',
      'print("WRITABLE_PARENT_ANCESTOR_REJECTED")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /WRITABLE_PARENT_ANCESTOR_REJECTED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects poisoned ProgramFiles and SystemRoot environment variables', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-poisonenv-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      'poisoned_root = os.path.realpath("/custom_attacker_tools")',
      'os.environ["ProgramFiles"] = poisoned_root',
      'os.environ["SystemRoot"] = poisoned_root',
      'os.environ["ProgramFiles(x86)"] = poisoned_root',
      'os.environ["windir"] = poisoned_root',
      'candidate_dir = os.path.join(poisoned_root, "Git", "cmd")',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      'found = scope["resolve_trusted_git"]({}, candidate_dirs=[candidate_dir])',
      'assert found is None, f"Expected candidate in poisoned environment root to be rejected, got: {found}"',
      'print("POISONED_ENV_ROOT_REJECTED")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /POISONED_ENV_ROOT_REJECTED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects candidate in trusted root with permissive Windows DACL or non-admin owner', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-dacl-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      'if sys.platform == "win32":',
      '    import ctypes',
      '    real_git_dir = r"C:\\Program Files\\Git\\cmd"',
      '    # Test A: Mock untrusted owner SID (standard user)',
      '    class MockAdvApiOwner:',
      '        def __getattr__(self, name):',
      '            if name == "ConvertSidToStringSidW":',
      '                def mock_convert(sid, p_str):',
      '                    p_str._obj.value = "S-1-5-21-999999-999999-999999-1001"',
      '                    return 1',
      '                return mock_convert',
      '            return getattr(ctypes.windll.advapi32, name)',
      '    orig_advapi = ctypes.windll.advapi32',
      '    ctypes.windll.advapi32 = MockAdvApiOwner()',
      '    try:',
      '        res_untrusted_owner = scope["resolve_trusted_git"]({}, candidate_dirs=[real_git_dir])',
      '        assert res_untrusted_owner is None, f"Expected non-admin owner to be rejected, got: {res_untrusted_owner}"',
      '    finally:',
      '        ctypes.windll.advapi32 = orig_advapi',
      '    # Test B: Mock permissive DACL (untrusted Users group ACE with WRITE_MASK)',
      '    call_count = [0]',
      '    class MockAdvApiAce:',
      '        def __getattr__(self, name):',
      '            if name == "ConvertSidToStringSidW":',
      '                def mock_convert(sid, p_str):',
      '                    call_count[0] += 1',
      '                    if call_count[0] == 1:',
      '                        p_str._obj.value = "S-1-5-32-544"',
      '                    else:',
      '                        p_str._obj.value = "S-1-5-32-545"',
      '                    return 1',
      '                return mock_convert',
      '            return getattr(ctypes.windll.advapi32, name)',
      '    ctypes.windll.advapi32 = MockAdvApiAce()',
      '    try:',
      '        res_permissive_ace = scope["resolve_trusted_git"]({}, candidate_dirs=[real_git_dir])',
      '        assert res_permissive_ace is None, f"Expected permissive write ACE to be rejected, got: {res_permissive_ace}"',
      '    finally:',
      '        ctypes.windll.advapi32 = orig_advapi',
      'print("PERMISSIVE_DACL_REJECTED")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /PERMISSIVE_DACL_REJECTED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects Git executables outside Windows trusted administrative roots', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-wintrust-'));

  try {
    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      'unapprovedDir = os.path.realpath("/custom_tools/bin")',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      `found = scope["resolve_trusted_git"]({}, candidate_dirs=[unapprovedDir])`,
      'assert found is None, f"Expected non-administrative directory to be rejected, got: {found}"',
      'print("NON_ADMIN_WIN_DIR_REJECTED")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /NON_ADMIN_WIN_DIR_REJECTED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects fake Git executables in user-controlled home and AppData directories', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-userhome-'));

  try {
    const userBin = path.join(tempDir, 'home_user', 'bin');
    fs.mkdirSync(userBin, { recursive: true });
    const fakeGit = path.join(userBin, process.platform === 'win32' ? 'git.cmd' : 'git');
    if (process.platform === 'win32') {
      fs.writeFileSync(fakeGit, '@echo off\r\necho git version 2.99.0\r\n');
    } else {
      fs.writeFileSync(fakeGit, '#!/bin/sh\necho "git version 2.99.0"\n');
      fs.chmodSync(fakeGit, 0o755);
    }

    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      `os.environ['USERPROFILE'] = ${JSON.stringify(path.join(tempDir, 'home_user'))}`,
      `os.environ['HOME'] = ${JSON.stringify(path.join(tempDir, 'home_user'))}`,
      `os.environ['LOCALAPPDATA'] = ${JSON.stringify(path.join(tempDir, 'home_user', 'AppData', 'Local'))}`,
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      `found = scope["resolve_trusted_git"]({}, candidate_dirs=[${JSON.stringify(userBin)}])`,
      'assert found is None, f"Expected user home / AppData directory to be rejected, got: {found}"',
      'print("USER_HOME_GIT_REJECTED")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /USER_HOME_GIT_REJECTED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('finding P3-04: scanner rejects git wrapper scripts and symlink substitutions in repository root', () => {
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fullPython = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [pythonBin], { encoding: 'utf8' }).stdout.trim().split(/\r?\n/)[0];
  const scannerPath = path.join(ROOT, 'tools', 'uss-tracked-binary-scanner.py');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uss-test-p304-wrappers-'));

  try {
    spawnSync('git', ['init', '-q'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.name', 'P304 Wrapper User'], { cwd: tempDir });
    spawnSync('git', ['config', 'user.email', 'p304w@example.com'], { cwd: tempDir });
    spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: tempDir });

    const repoBin = path.join(tempDir, 'bin');
    fs.mkdirSync(repoBin, { recursive: true });

    const wrapperPath = path.join(repoBin, process.platform === 'win32' ? 'git.cmd' : 'git');
    if (process.platform === 'win32') {
      fs.writeFileSync(wrapperPath, '@echo off\r\necho git version 2.99.0\r\nexit /b 0\r\n');
    } else {
      fs.writeFileSync(wrapperPath, '#!/bin/sh\necho "git version 2.99.0"\nexit 0\n');
      fs.chmodSync(wrapperPath, 0o755);
    }

    const scannerCode = fs.readFileSync(scannerPath, 'utf8');
    const funcCode = scannerCode.slice(scannerCode.indexOf('def resolve_trusted_git('), scannerCode.indexOf('clean_git_env ='));

    const testPy = [
      'import os, sys, tempfile, subprocess',
      `scope = {'ROOT': ${JSON.stringify(tempDir)}, 'tempfile': tempfile, 'os': os, 'sys': sys, 'subprocess': subprocess}`,
      `exec(${JSON.stringify(funcCode)}, scope)`,
      `os.environ['PATH'] = ${JSON.stringify(repoBin)}`,
      'found_git = scope["resolve_trusted_git"]({})',
      `assert found_git is None or not found_git.startswith(${JSON.stringify(tempDir)}), f"Cannot resolve in-repo git: {found_git}"`,
      'print("IN_REPO_GIT_REJECTED")'
    ].join('\n');

    const pyRun = spawnSync(fullPython, ['-c', testPy], { cwd: tempDir, encoding: 'utf8' });
    assert.equal(pyRun.status, 0, pyRun.stderr);
    assert.match(pyRun.stdout, /IN_REPO_GIT_REJECTED/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// Supervisory Finding F6: Consumer Validator continue-on-error and Conditionality Bypass
test('finding F6: rejects continue-on-error on mandatory jobs and steps in consumer validator', () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');

  // Job-level continue-on-error
  for (const jobId of ['secrets', 'semgrep', 'codeql', 'osv']) {
    const parsedJob = YAML.parse(text);
    parsedJob.jobs[jobId]['continue-on-error'] = true;
    assert.throws(
      () => validateConsumerWorkflowStructure(parsedJob),
      new RegExp(`mandatory job '${jobId}' must not define continue-on-error`)
    );
  }

  // Step-level continue-on-error
  for (const jobId of ['secrets', 'semgrep', 'codeql']) {
    const parsedStep = YAML.parse(text);
    parsedStep.jobs[jobId].steps[0]['continue-on-error'] = true;
    assert.throws(
      () => validateConsumerWorkflowStructure(parsedStep),
      new RegExp(`mandatory step 0 in job '${jobId}' must not define continue-on-error`)
    );
  }
});

test('finding F6: rejects if conditions on mandatory jobs and steps in consumer validator', () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');

  const conditions = [
    false,
    'false',
    '${{ false }}',
    "github.event_name == 'never'",
    "github.ref == 'refs/heads/main'"
  ];

  // Job-level if conditions
  for (const cond of conditions) {
    for (const jobId of ['secrets', 'semgrep', 'codeql', 'osv']) {
      const parsedJob = YAML.parse(text);
      parsedJob.jobs[jobId].if = cond;
      assert.throws(
        () => validateConsumerWorkflowStructure(parsedJob),
        new RegExp(`mandatory job '${jobId}' declares unapproved condition`)
      );
    }
  }

  // Step-level if conditions
  for (const cond of conditions) {
    for (const jobId of ['secrets', 'semgrep', 'codeql']) {
      for (let i = 0; i < 3; i++) {
        const parsedStep = YAML.parse(text);
        parsedStep.jobs[jobId].steps[i].if = cond;
        assert.throws(
          () => validateConsumerWorkflowStructure(parsedStep),
          new RegExp(`mandatory step ${i} in job '${jobId}' declares unapproved condition`)
        );
      }
    }
  }
});

test('finding F6: rejects needs dependencies and strategy matrices on mandatory jobs', () => {
  const text = fs.readFileSync(path.join(ROOT, 'templates/ci/consumer-security-scans.yml'), 'utf8');

  // needs dependency
  const parsedNeeds = YAML.parse(text);
  parsedNeeds.jobs.semgrep.needs = ['secrets'];
  assert.throws(
    () => validateConsumerWorkflowStructure(parsedNeeds),
    /mandatory job 'semgrep' must not define dependencies/
  );

  // strategy matrix
  const parsedStrategy = YAML.parse(text);
  parsedStrategy.jobs.semgrep.strategy = { matrix: { os: ['ubuntu-latest'] } };
  assert.throws(
    () => validateConsumerWorkflowStructure(parsedStrategy),
    /mandatory job 'semgrep' must not define strategy matrix/
  );
});
