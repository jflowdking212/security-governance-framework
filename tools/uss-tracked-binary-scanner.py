#!/usr/bin/env python3
"""Fail-closed full-stream NUL-byte scan of Git-index tracked regular files.

Uses secure directory-descriptor-based traversal (openat with O_DIRECTORY | O_NOFOLLOW)
to protect every parent directory component from symbolic link redirection and TOCTOU races.
On platforms lacking directory-descriptor support (e.g. Windows native), parent directory
components are inspected with lstat before opening; strict descriptor enforcement can be
required via USS_SCANNER_REQUIRE_DIR_FD=1 or --require-dir-fd.
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

require_dir_fd = os.environ.get("USS_SCANNER_REQUIRE_DIR_FD") == "1" or "--require-dir-fd" in sys.argv
if require_dir_fd and not SECURE_DIR_FD:
    print(
        f"FAIL CLOSED: secure directory-descriptor traversal is not supported on platform: {sys.platform}",
        file=sys.stderr,
    )
    sys.exit(2)

try:
    result = subprocess.run(
        ["git", "-c", f"safe.directory={ROOT}", "-c", "core.fsmonitor=false", "ls-files", "-z"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
except (OSError, subprocess.CalledProcessError) as exc:
    detail = getattr(exc, "stderr", b"")
    print(f"FAIL CLOSED: cannot enumerate tracked files: {detail.decode('utf-8', 'replace')}", file=sys.stderr)
    sys.exit(2)

if SECURE_DIR_FD:
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
else:
    root_bytes = os.fsencode(ROOT)
    for rel in result.stdout.split(b"\0"):
        if not rel:
            continue

        parts = rel.split(b"/")
        for comp in parts:
            if comp in (b".", b"..") or not comp:
                print(f"FAIL CLOSED: invalid path component in tracked path: {os.fsdecode(rel)}", file=sys.stderr)
                sys.exit(2)

        accum_path = root_bytes
        for comp in parts[:-1]:
            accum_path = os.path.join(accum_path, comp)
            try:
                comp_stat = os.lstat(accum_path)
                is_reparse = bool(getattr(comp_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
                if stat.S_ISLNK(comp_stat.st_mode) or is_reparse or os.path.islink(accum_path):
                    print(f"FAIL: parent directory component is a symbolic link: {os.fsdecode(rel)}", file=sys.stderr)
                    sys.exit(1)
                if not stat.S_ISDIR(comp_stat.st_mode):
                    print(f"FAIL: parent component is not a directory: {os.fsdecode(rel)}", file=sys.stderr)
                    sys.exit(1)
            except OSError as exc:
                print(f"FAIL CLOSED: cannot inspect parent directory component: {exc}", file=sys.stderr)
                sys.exit(2)

        target_path = os.path.join(root_bytes, rel)
        try:
            leaf_stat = os.lstat(target_path)
            is_leaf_reparse = bool(getattr(leaf_stat, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
            if stat.S_ISLNK(leaf_stat.st_mode) or is_leaf_reparse or os.path.islink(target_path):
                continue
            if not stat.S_ISREG(leaf_stat.st_mode):
                print(f"FAIL: tracked path is not a regular file or symlink: {os.fsdecode(rel)}", file=sys.stderr)
                sys.exit(1)

            flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
            fd = os.open(target_path, flags)
            try:
                opened_stat = os.fstat(fd)
                if not stat.S_ISREG(opened_stat.st_mode):
                    print(f"FAIL: opened tracked path is not a regular file: {os.fsdecode(rel)}", file=sys.stderr)
                    sys.exit(1)
                while True:
                    chunk = os.read(fd, CHUNK_SIZE)
                    if not chunk:
                        break
                    if b"\0" in chunk:
                        print("FAIL: tracked binary file contains NUL byte: " + os.fsdecode(rel), file=sys.stderr)
                        sys.exit(1)
            finally:
                os.close(fd)
        except OSError as exc:
            print(f"FAIL CLOSED: cannot inspect tracked path {os.fsdecode(rel)}: {exc}", file=sys.stderr)
            sys.exit(2)

print("PASS: complete content scan found no NUL bytes in tracked regular files")
