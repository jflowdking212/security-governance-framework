#!/usr/bin/env python3
"""Fail-closed full-stream NUL-byte scan of Git-index tracked regular files."""
import os
import stat
import subprocess
import sys

CHUNK_SIZE = 1024 * 1024
ROOT = os.getcwd()

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

for rel in result.stdout.split(b"\0"):
    if not rel:
        continue
    target_path = os.path.join(os.fsencode(ROOT), rel)
    try:
        before = os.lstat(target_path)
        if stat.S_ISLNK(before.st_mode):
            # Git stores symlink targets as text blobs; do not follow the link.
            continue
        if not stat.S_ISREG(before.st_mode):
            raise OSError("tracked path is not a regular file or symlink")
        flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(target_path, flags)
        try:
            opened = os.fstat(fd)
            if not stat.S_ISREG(opened.st_mode):
                raise OSError("opened tracked path is not a regular file")
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
        print("FAIL CLOSED: cannot inspect tracked path " + os.fsdecode(rel) + ": " + str(exc), file=sys.stderr)
        sys.exit(2)

print("PASS: complete content scan found no NUL bytes in tracked regular files")
