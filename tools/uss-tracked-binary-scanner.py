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

clean_git_env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}

try:
    result = subprocess.run(
        ["git", "-c", f"safe.directory={ROOT}", "-c", "core.fsmonitor=false", "ls-files", "-z"],
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
