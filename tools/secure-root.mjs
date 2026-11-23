import fs from 'node:fs';
import path from 'node:path';

/**
 * Open an absolute directory path without following any symlink component.
 *
 * The returned /proc/self/fd path remains anchored to the opened directory
 * even if an ancestor pathname is subsequently renamed or replaced. This
 * implementation deliberately supports Linux only: Node's portable fs API
 * does not expose openat/handle-relative traversal on other platforms.
 */
export function openSecureDirectory(target) {
  if (process.platform !== 'linux' ||
      !fs.constants.O_DIRECTORY ||
      !fs.constants.O_NOFOLLOW ||
      !fs.existsSync('/proc/self/fd')) {
    throw new Error('Race-resistant checksum root traversal is unsupported on this platform; refusing to continue.');
  }

  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  const components = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  const directoryFlags = fs.constants.O_RDONLY |
    fs.constants.O_DIRECTORY |
    fs.constants.O_NOFOLLOW |
    (fs.constants.O_CLOEXEC || 0);

  let currentFd;
  try {
    currentFd = fs.openSync(parsed.root, directoryFlags);
    for (const component of components) {
      const nextPath = `/proc/self/fd/${currentFd}/${component}`;
      const nextFd = fs.openSync(nextPath, directoryFlags);
      const stat = fs.fstatSync(nextFd);
      if (!stat.isDirectory()) {
        fs.closeSync(nextFd);
        throw new Error('Checksum root path component is not a directory: ' + component);
      }
      fs.closeSync(currentFd);
      currentFd = nextFd;
    }

    const fd = currentFd;
    currentFd = undefined;
    return Object.freeze({
      fd,
      path: `/proc/self/fd/${fd}`,
      close() {
        try { fs.closeSync(fd); } catch (error) {
          if (error.code !== 'EBADF') throw error;
        }
      }
    });
  } catch (error) {
    if (currentFd !== undefined) {
      try { fs.closeSync(currentFd); } catch {}
    }
    if (error.code === 'ELOOP' || error.code === 'ENOTDIR') {
      throw new Error('Checksum root path contains a symbolic link or non-directory component: ' + absolute);
    }
    throw error;
  }
}
