#!/usr/bin/env python3
"""Fail-closed full-stream NUL-byte scan of Git-index tracked regular files.

Uses secure directory-descriptor-based traversal (openat with O_DIRECTORY | O_NOFOLLOW)
to protect every parent directory component from symbolic link redirection and TOCTOU races.
Platforms lacking directory-descriptor support (e.g. Windows native) fail closed by default
with exit code 2.
"""
import os
import stat
import subprocess
import sys
import tempfile

CHUNK_SIZE = 1024 * 1024
ROOT = os.getcwd()

SECURE_DIR_FD = (
    os.open in getattr(os, "supports_dir_fd", set()) and
    os.stat in getattr(os, "supports_dir_fd", set()) and
    hasattr(os, "O_DIRECTORY") and
    hasattr(os, "O_NOFOLLOW")
)

if not SECURE_DIR_FD:
    print(
        f"FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: {sys.platform}",
        file=sys.stderr,
    )
    sys.exit(2)

def resolve_trusted_git(clean_env, candidate_dirs=None):
    untrusted_prefixes = [
        os.path.realpath(ROOT),
        os.path.realpath(tempfile.gettempdir()),
    ]
    for v in (
        "RUNNER_TEMP",
        "TEMP",
        "TMP",
        "TMPDIR",
        "USERPROFILE",
        "HOME",
        "HOMEPATH",
        "LOCALAPPDATA",
        "APPDATA",
    ):
        val = os.environ.get(v)
        if val:
            try:
                untrusted_prefixes.append(os.path.realpath(val))
            except Exception:
                pass
    try:
        user_home = os.path.realpath(os.path.expanduser("~"))
        if user_home:
            untrusted_prefixes.append(user_home)
    except Exception:
        pass
    if sys.platform != "win32":
        untrusted_prefixes.extend(["/tmp", "/var/tmp", "/dev/shm"])

    def is_untrusted_path(p):
        try:
            rp = os.path.realpath(p)
        except Exception:
            return True
        for prefix in untrusted_prefixes:
            try:
                if rp == prefix or os.path.commonpath([rp, prefix]) == prefix:
                    return True
            except ValueError:
                pass
        if sys.platform == "win32":
            p_lower = rp.lower()
            if "\\users\\" in p_lower or p_lower.startswith(("\\\\", "//")):
                return True
        else:
            if rp.startswith(("/home/", "/Users/")):
                return True
        return False

    def get_windows_authoritative_roots():
        roots = []
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion") as k:
                for val in ("ProgramFilesDir", "ProgramFilesDir (x86)", "ProgramFilesDir (Arm)", "ProgramW6432Dir"):
                    try:
                        rv, _ = winreg.QueryValueEx(k, val)
                        if rv and os.path.isdir(rv):
                            roots.append(os.path.realpath(rv))
                    except OSError:
                        pass
        except Exception:
            pass
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion") as k:
                rv, _ = winreg.QueryValueEx(k, "SystemRoot")
                if rv and os.path.isdir(rv):
                    roots.append(os.path.realpath(rv))
        except Exception:
            pass
        return list(dict.fromkeys(roots))

    def verify_posix_ancestors(target_path):
        rp = os.path.realpath(target_path)
        curr = rp
        while True:
            try:
                st = os.stat(curr)
            except OSError:
                return False
            if st.st_uid != 0:
                return False
            if (st.st_mode & 0o022) != 0:
                return False
            parent = os.path.dirname(curr)
            if parent == curr:
                break
            curr = parent
        return True

    def verify_windows_dacl(target_path, trusted_roots):
        rp = os.path.realpath(target_path)
        in_trusted_root = False
        for troot in trusted_roots:
            try:
                if rp == troot or os.path.commonpath([rp, troot]) == troot:
                    in_trusted_root = True
                    break
            except ValueError:
                pass
        if not in_trusted_root:
            return False

        try:
            import ctypes
            from ctypes import wintypes
            advapi32 = ctypes.windll.advapi32
            kernel32 = ctypes.windll.kernel32

            SE_FILE_OBJECT = 1
            OWNER_SECURITY_INFORMATION = 1
            DACL_SECURITY_INFORMATION = 4
            AclSizeInformation = 2
            INHERIT_ONLY_ACE = 0x08

            class ACE_HEADER(ctypes.Structure):
                _fields_ = [('AceType', wintypes.BYTE), ('AceFlags', wintypes.BYTE), ('AceSize', wintypes.WORD)]
            class ACL_SIZE_INFORMATION(ctypes.Structure):
                _fields_ = [('AceCount', wintypes.DWORD), ('AclBytesInUse', wintypes.DWORD), ('AclBytesFree', wintypes.DWORD)]

            TRUSTED_SIDS = {
                'S-1-5-32-544',
                'S-1-5-18',
                'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464',
            }
            WRITE_MASK = 0x0002 | 0x0004 | 0x00010000 | 0x00040000 | 0x00080000 | 0x40000000 | 0x10000000

            curr = rp
            while True:
                p_sec_desc = wintypes.LPVOID()
                p_owner = wintypes.LPVOID()
                p_dacl = wintypes.LPVOID()
                res = advapi32.GetNamedSecurityInfoW(
                    curr,
                    SE_FILE_OBJECT,
                    OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
                    ctypes.byref(p_owner),
                    None,
                    ctypes.byref(p_dacl),
                    None,
                    ctypes.byref(p_sec_desc)
                )
                if res != 0 or not p_sec_desc:
                    return False
                try:
                    if not p_owner or not p_dacl:
                        return False

                    if not advapi32.IsValidSid(p_owner):
                        return False
                    owner_len = advapi32.GetLengthSid(p_owner)
                    if owner_len < 8:
                        return False

                    p_str_sid = wintypes.LPWSTR()
                    if not advapi32.ConvertSidToStringSidW(p_owner, ctypes.byref(p_str_sid)):
                        return False
                    try:
                        owner_sid = p_str_sid.value
                    finally:
                        kernel32.LocalFree(p_str_sid)

                    if owner_sid not in TRUSTED_SIDS:
                        return False

                    acl_info = ACL_SIZE_INFORMATION()
                    if not advapi32.GetAclInformation(p_dacl, ctypes.byref(acl_info), ctypes.sizeof(acl_info), AclSizeInformation):
                        return False

                    for i in range(acl_info.AceCount):
                        p_ace = wintypes.LPVOID()
                        if not advapi32.GetAce(p_dacl, i, ctypes.byref(p_ace)) or not p_ace:
                            return False
                        ace_header = ACE_HEADER.from_address(p_ace.value)
                        ace_type = ace_header.AceType
                        ace_size = ace_header.AceSize

                        # Explicit deny ACEs deny access; they do not grant write rights
                        if ace_type in (1, 6, 10, 12):
                            continue

                        # Allow ACEs: standard (0), callback (9), object (5), callback object (11), compound (4)
                        if ace_type in (0, 9):
                            if ace_size < 16:
                                return False
                            mask = ctypes.c_uint32.from_address(p_ace.value + 4).value
                            sid_offset = 8
                            p_sid = ctypes.c_void_p(p_ace.value + 8)
                        elif ace_type in (5, 11):
                            if ace_size < 20:
                                return False
                            mask = ctypes.c_uint32.from_address(p_ace.value + 4).value
                            flags = ctypes.c_uint32.from_address(p_ace.value + 8).value
                            if (flags & ~0x03) != 0:
                                return False
                            offset = 12
                            if (flags & 0x1):
                                offset += 16
                            if (flags & 0x2):
                                offset += 16
                            if ace_size < offset + 8:
                                return False
                            sid_offset = offset
                            p_sid = ctypes.c_void_p(p_ace.value + offset)
                        elif ace_type == 4:
                            if ace_size < 20:
                                return False
                            mask = ctypes.c_uint32.from_address(p_ace.value + 4).value
                            compound_type = ctypes.c_uint16.from_address(p_ace.value + 8).value
                            reserved = ctypes.c_uint16.from_address(p_ace.value + 10).value
                            if compound_type != 1 or reserved != 0:
                                return False
                            sid_offset = 12
                            p_sid = ctypes.c_void_p(p_ace.value + 12)
                        else:
                            # Unknown / unhandled ACE type: fail closed
                            return False

                        if not advapi32.IsValidSid(p_sid):
                            return False
                        sid_len = advapi32.GetLengthSid(p_sid)
                        if sid_len < 8 or ace_size < sid_offset + sid_len:
                            return False
                        revision = ctypes.c_uint8.from_address(p_sid.value).value
                        sub_auth_count = ctypes.c_uint8.from_address(p_sid.value + 1).value
                        if revision != 1 or sid_len != 8 + 4 * sub_auth_count:
                            return False

                        p_ace_str_sid = wintypes.LPWSTR()
                        if not advapi32.ConvertSidToStringSidW(p_sid, ctypes.byref(p_ace_str_sid)):
                            return False
                        try:
                            ace_sid = p_ace_str_sid.value
                        finally:
                            kernel32.LocalFree(p_ace_str_sid)

                        if (mask & WRITE_MASK) != 0:
                            if ace_sid in TRUSTED_SIDS:
                                continue
                            if ace_sid == 'S-1-3-0' and (ace_header.AceFlags & INHERIT_ONLY_ACE):
                                continue
                            return False
                finally:
                    kernel32.LocalFree(p_sec_desc)

                parent = os.path.dirname(curr)
                if parent == curr:
                    break
                if any(curr == troot for troot in trusted_roots):
                    break
                curr = parent

            return True
        except Exception:
            return False

    trusted_roots = []
    if sys.platform == "win32":
        trusted_roots = get_windows_authoritative_roots()
        if not trusted_roots:
            return None
        exe_names = ["git.exe", "git.cmd"]
    else:
        exe_names = ["git"]

    if candidate_dirs is not None:
        search_dirs = list(candidate_dirs)
    else:
        path_dirs = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]
        system_dirs = []
        if sys.platform == "win32":
            for r in trusted_roots:
                system_dirs.extend([
                    os.path.join(r, "Git", "cmd"),
                    os.path.join(r, "Git", "bin"),
                ])
        else:
            system_dirs = ["/usr/bin", "/bin", "/usr/local/bin"]
        search_dirs = path_dirs + system_dirs

    seen_dirs = set()
    for d in search_dirs:
        if not os.path.isabs(d):
            continue
        try:
            real_d = os.path.realpath(d)
        except Exception:
            continue
        if real_d in seen_dirs:
            continue
        seen_dirs.add(real_d)
        if not os.path.isdir(real_d):
            continue

        if is_untrusted_path(d) or is_untrusted_path(real_d):
            continue

        if sys.platform == "win32":
            if not verify_windows_dacl(real_d, trusted_roots):
                continue
        else:
            if not verify_posix_ancestors(real_d):
                continue

        for name in exe_names:
            candidate = os.path.join(real_d, name)
            if not (os.path.isfile(candidate) and os.access(candidate, os.X_OK)):
                continue
            try:
                real_exe = os.path.realpath(candidate)
            except Exception:
                continue
            if not (os.path.isfile(real_exe) and os.access(real_exe, os.X_OK)):
                continue

            if is_untrusted_path(candidate) or is_untrusted_path(real_exe):
                continue

            if sys.platform == "win32":
                if not verify_windows_dacl(real_exe, trusted_roots):
                    continue
            else:
                if not verify_posix_ancestors(real_exe):
                    continue

            try:
                r = subprocess.run(
                    [real_exe, "--version"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=5,
                    check=True,
                    **{"env": clean_env},
                )
                if r.stdout.startswith(b"git version"):
                    return real_exe
            except Exception:
                continue

    return None

clean_git_env = {k: v for k, v in os.environ.items() if not k.upper().startswith("GIT_")}

trusted_git = resolve_trusted_git(clean_git_env)
if not trusted_git:
    print("FAIL CLOSED: trusted git executable could not be resolved", file=sys.stderr)
    sys.exit(2)

try:
    result = subprocess.run(
        [trusted_git, "-c", f"safe.directory={ROOT}", "-c", "core.fsmonitor=false", "ls-files", "-z"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
        **{"env": clean_git_env},
    )
except (OSError, subprocess.CalledProcessError) as exc:
    detail = getattr(exc, "stderr", b"")
    print(f"FAIL CLOSED: cannot enumerate tracked files: {detail.decode('utf-8', 'replace')}", file=sys.stderr)
    sys.exit(2)

root_flags = os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_CLOEXEC", 0)
try:
    root_fd = os.open(os.fsencode(ROOT), root_flags)
except OSError as exc:
    print(f"FAIL CLOSED: cannot open repository root: {exc}", file=sys.stderr)
    sys.exit(2)

try:
    root_stat = os.fstat(root_fd)
    if not stat.S_ISDIR(root_stat.st_mode):
        print("FAIL CLOSED: repository root is not a directory", file=sys.stderr)
        sys.exit(2)

    for rel in result.stdout.split(b"\0"):
        if not rel:
            continue

        parts = rel.split(b"/")
        for comp in parts:
            if comp in (b".", b"..") or not comp:
                print(f"FAIL CLOSED: invalid path component in tracked path: {os.fsdecode(rel)}", file=sys.stderr)
                sys.exit(2)

        cur_fd = root_fd
        close_fds = []
        try:
            for comp in parts[:-1]:
                dir_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
                try:
                    next_fd = os.open(comp, dir_flags, dir_fd=cur_fd)
                except OSError as exc:
                    print(f"FAIL: parent directory component is a symbolic link or cannot be securely traversed: {os.fsdecode(rel)}: {exc}", file=sys.stderr)
                    sys.exit(1)
                close_fds.append(next_fd)
                next_stat = os.fstat(next_fd)
                if not stat.S_ISDIR(next_stat.st_mode):
                    print(f"FAIL: parent component is not a directory: {os.fsdecode(rel)}", file=sys.stderr)
                    sys.exit(1)
                cur_fd = next_fd

            leaf = parts[-1]
            try:
                leaf_stat = os.stat(leaf, dir_fd=cur_fd, follow_symlinks=False)
            except OSError as exc:
                print(f"FAIL CLOSED: cannot inspect tracked path {os.fsdecode(rel)}: {exc}", file=sys.stderr)
                sys.exit(2)

            if stat.S_ISLNK(leaf_stat.st_mode):
                continue

            if not stat.S_ISREG(leaf_stat.st_mode):
                print(f"FAIL: tracked path is not a regular file or symlink: {os.fsdecode(rel)}", file=sys.stderr)
                sys.exit(1)

            file_flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)
            try:
                file_fd = os.open(leaf, file_flags, dir_fd=cur_fd)
            except OSError as exc:
                print(f"FAIL: cannot open tracked regular file {os.fsdecode(rel)}: {exc}", file=sys.stderr)
                sys.exit(1)

            try:
                opened_stat = os.fstat(file_fd)
                if not stat.S_ISREG(opened_stat.st_mode):
                    print(f"FAIL: opened tracked path is not a regular file: {os.fsdecode(rel)}", file=sys.stderr)
                    sys.exit(1)

                while True:
                    chunk = os.read(file_fd, CHUNK_SIZE)
                    if not chunk:
                        break
                    if b"\0" in chunk:
                        print("FAIL: tracked binary file contains NUL byte: " + os.fsdecode(rel), file=sys.stderr)
                        sys.exit(1)
            finally:
                os.close(file_fd)
        finally:
            for fd in close_fds:
                try:
                    os.close(fd)
                except OSError:
                    pass
finally:
    os.close(root_fd)

print("PASS: complete content scan found no NUL bytes in tracked regular files")
