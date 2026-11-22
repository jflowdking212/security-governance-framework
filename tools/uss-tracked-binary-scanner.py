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

def resolve_trusted_git(clean_env):
    untrusted_prefixes = [
        os.path.realpath(ROOT),
        os.path.realpath(tempfile.gettempdir()),
    ]
    for v in ("RUNNER_TEMP", "TEMP", "TMP", "TMPDIR"):
        val = os.environ.get(v)
        if val:
            try:
                untrusted_prefixes.append(os.path.realpath(val))
            except Exception:
                pass
    if sys.platform != "win32":
        untrusted_prefixes.extend(["/tmp", "/var/tmp", "/dev/shm"])

    path_dirs = [p for p in os.environ.get("PATH", "").split(os.pathsep) if p]
    system_dirs = []
    if sys.platform == "win32":
        for var_name in ("ProgramFiles", "ProgramFiles(x86)", "SystemRoot"):
            base = os.environ.get(var_name)
            if base:
                system_dirs.extend([
                    os.path.join(base, "Git", "cmd"),
                    os.path.join(base, "Git", "bin"),
                ])
        local_app = os.environ.get("LOCALAPPDATA")
        if local_app:
            system_dirs.extend([
                os.path.join(local_app, "Programs", "Git", "cmd"),
                os.path.join(local_app, "Programs", "Git", "bin"),
            ])
        exe_names = ["git.exe", "git.cmd"]
    else:
        system_dirs = ["/usr/bin", "/bin", "/usr/local/bin"]
        exe_names = ["git"]

    seen_dirs = set()
    for d in path_dirs + system_dirs:
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

        is_untrusted = False
        for prefix in untrusted_prefixes:
            try:
                if real_d == prefix or os.path.commonpath([real_d, prefix]) == prefix:
                    is_untrusted = True
                    break
            except ValueError:
                pass
        if is_untrusted:
            continue

        if sys.platform != "win32":
            try:
                st_d = os.stat(real_d)
                if st_d.st_mode & 0o002 != 0:
                    continue
                if (st_d.st_mode & 0o020 != 0) and st_d.st_uid != 0:
                    continue
            except OSError:
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

            exe_untrusted = False
            for prefix in untrusted_prefixes:
                try:
                    if real_exe == prefix or os.path.commonpath([real_exe, prefix]) == prefix:
                        exe_untrusted = True
                        break
                except ValueError:
                    pass
            if exe_untrusted:
                continue

            if sys.platform != "win32":
                try:
                    st_exe = os.stat(real_exe)
                    if st_exe.st_mode & 0o002 != 0:
                        continue
                except OSError:
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
