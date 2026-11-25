#!/usr/bin/env node
import {createHash,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {isTrustedExecutableStat,isTrustedDirectoryStat} from './trusted-git-policy.mjs';

const MANIFEST='SHA256SUMS';
const SIGNATURE='SHA256SUMS.sig';
const EXCLUDED=new Set([MANIFEST,SIGNATURE]);

function resolveTrustedGit() {
  // USS checksum verification is Linux-only because its root traversal relies
  // on O_NOFOLLOW and /proc/self/fd. Resolve Git from fixed system locations,
  // never from PATH or a caller-controlled environment variable.
  if(process.platform!=='linux') {
    throw new Error('Trusted Git resolution is supported only on Linux; refusing to use PATH-based Git.');
  }
  const candidates=['/usr/bin/git','/bin/git','/usr/local/bin/git'];
  for(const candidate of candidates) {
    try {
      const resolved=fs.realpathSync(candidate);
      const stat=fs.statSync(resolved);
      const currentUid=typeof process.getuid==='function'?process.getuid():undefined;
      if(!isTrustedExecutableStat(stat,currentUid))continue;
      let directory=path.dirname(resolved);
      let safe=true;
      while(directory!=='/') {
        const parentStat=fs.statSync(directory);
        if(!isTrustedDirectoryStat(parentStat,currentUid)) {
          safe=false;break;
        }
        directory=path.dirname(directory);
      }
      if(safe)return resolved;
    } catch {}
  }
  throw new Error('No trusted Git executable found in /usr/bin, /bin or /usr/local/bin; refusing to use PATH.');
}

let TRUSTED_GIT;

function sanitizedGitEnvironment() {
  // Build a strict allowlist. Do not inherit loader variables (LD_PRELOAD,
  // LD_LIBRARY_PATH, LD_AUDIT), shell startup variables, PATH, HOME, XDG or
  // any Git override from the caller.
  return {
    PATH:'/usr/bin:/bin',
    HOME:'/nonexistent',
    XDG_CONFIG_HOME:'/nonexistent',
    TMPDIR:'/tmp',
    GIT_CONFIG_NOSYSTEM:'1',
    GIT_CONFIG_SYSTEM:'/dev/null',
    GIT_CONFIG_GLOBAL:'/dev/null',
    GIT_ATTR_NOSYSTEM:'1',
    GIT_TERMINAL_PROMPT:'0',
    GIT_OPTIONAL_LOCKS:'0',
    LC_ALL:'C'
  };
}

function gitAt(cwd,args,{encoding='utf8'}={}) {
  if(process.platform!=='linux') {
    console.error('Checksum Git mode is supported only on Linux; refusing to use PATH-based Git.');
    process.exit(1);
  }
  if(!TRUSTED_GIT) {
    try {TRUSTED_GIT=resolveTrustedGit();}
    catch(error) {
      console.error('Checksum Git mode failed closed: '+error.message);
      process.exit(1);
    }
  }
  const hardenedArgs=[
    '-c','core.fsmonitor=false',
    '-c','core.hooksPath=/dev/null',
    '-c','core.pager=cat',
    '-c','core.attributesFile=/dev/null',
    '-c','core.excludesFile=/dev/null',
    '-c','diff.external=',
    '-c','protocol.ext.allow=never',
    '-c','credential.helper=',
    ...args
  ];
  const r=spawnSync(TRUSTED_GIT,hardenedArgs,{
    cwd,encoding,stdio:['ignore','pipe','pipe'],env:sanitizedGitEnvironment()
  });
  if(r.error)throw new Error('Unable to run trusted Git: '+r.error.message);
  return r;
}

const argv=process.argv.slice(2);
const command=argv[0];
let rootArg='.';
let FILESYSTEM=false;
for(let i=1;i<argv.length;i++) {
  if(argv[i]==='--root'&&argv[i+1])rootArg=argv[++i];
  else if(argv[i]==='--filesystem')FILESYSTEM=true;
  else throw new Error('Unknown argument: '+argv[i]);
}
const START=process.cwd();
const ROOT=path.resolve(START,rootArg);
const IS_LINUX=process.platform==='linux';
const DIR_OPEN_FLAGS=fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW|(fs.constants.O_CLOEXEC||0);
const FILE_OPEN_FLAGS=fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|(fs.constants.O_CLOEXEC||0)|(fs.constants.O_NONBLOCK||0);
let ROOT_FD=null;

function fdPath(fd,child='') {
  return '/proc/self/fd/'+fd+(child?'/'+child:'');
}

function openDirectoryChild(parentFd,name) {
  if(!name||name==='.'||name==='..'||name.includes('/'))throw new Error('Unsafe directory component: '+name);
  const fd=fs.openSync(fdPath(parentFd,name),DIR_OPEN_FLAGS);
  if(!fs.fstatSync(fd).isDirectory()) {
    fs.closeSync(fd);
    throw new Error('Path component is not a directory: '+name);
  }
  return fd;
}

// On Linux, pin every root component with O_NOFOLLOW directory descriptors.
// All later filesystem reads and writes are resolved beneath this held root,
// not by re-resolving the caller-supplied path string.
function openRootDirectory(target) {
  if(!fs.existsSync('/proc/self/fd'))throw new Error('Linux /proc/self/fd is required for race-resistant checksum access.');
  const parsed=path.parse(target);
  let fd=fs.openSync(parsed.root,DIR_OPEN_FLAGS);
  try {
    const components=target.slice(parsed.root.length).split(path.sep).filter(Boolean);
    for(const component of components) {
      let next;
      try { next=openDirectoryChild(fd,component); }
      catch(error) {
        if(error.code==='ELOOP'||error.code==='ENOTDIR')throw new Error('Checksum root path traverses a symbolic link or non-directory: '+component);
        throw error;
      }
      fs.closeSync(fd);
      fd=next;
    }
    return fd;
  } catch(error) {
    try { fs.closeSync(fd); } catch {}
    throw error;
  }
}

function openParentAtRoot(rel) {
  const parts=rel.split('/');
  let fd=ROOT_FD;
  let owned=false;
  try {
    for(const part of parts.slice(0,-1)) {
      let next;
      try {
        next=openDirectoryChild(fd,part);
      } catch(error) {
        // Keep the descriptor-relative traversal fail-closed, but report
        // symlink/non-directory parents consistently on every platform.
        if(error.code==='ELOOP'||error.code==='ENOTDIR') {
          throw new Error('Path traverses a non-directory or symbolic-link parent: '+rel);
        }
        throw error;
      }
      if(owned)fs.closeSync(fd);
      fd=next;
      owned=true;
    }
    return {fd,leaf:parts[parts.length-1],close(){if(owned)fs.closeSync(fd);}};
  } catch(error) {
    if(owned)try { fs.closeSync(fd); } catch {}
    throw error;
  }
}

function sameFileVersion(a,b) {
  return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
}

function readRegularFileAtRoot(rel) {
  const parent=openParentAtRoot(rel);
  let fd=null;
  try {
    fd=fs.openSync(fdPath(parent.fd,parent.leaf),FILE_OPEN_FLAGS);
    const before=fs.fstatSync(fd,{bigint:true});
    if(!before.isFile())throw new Error('Only regular files can be checksummed: '+rel);
    const bytes=fs.readFileSync(fd);
    const after=fs.fstatSync(fd,{bigint:true});
    if(!sameFileVersion(before,after))throw new Error('File changed while being checksummed: '+rel);
    // Re-open the name relative to the same pinned parent and require it to
    // still identify the inode we actually read. O_NOFOLLOW rejects leaf swaps.
    const currentFd=fs.openSync(fdPath(parent.fd,parent.leaf),FILE_OPEN_FLAGS);
    try {
      const current=fs.fstatSync(currentFd,{bigint:true});
      if(!sameFileVersion(after,current))throw new Error('File path or contents changed while being checksummed: '+rel);
    } finally { fs.closeSync(currentFd); }
    return {bytes,mode:(Number(after.mode)&0o111)!==0?'100755':'100644'};
  } finally {
    if(fd!==null)fs.closeSync(fd);
    parent.close();
  }
}

function writeRegularFileAtRoot(rel,content) {
  const parent=openParentAtRoot(rel);
  const temporary='.'+rel+'.tmp-'+process.pid+'-'+randomBytes(12).toString('hex');
  let fd=null;
  try {
    // O_EXCL prevents opening a pre-existing FIFO, device, symlink or file.
    fd=fs.openSync(fdPath(parent.fd,temporary),fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW|(fs.constants.O_CLOEXEC||0),0o644);
    if(!fs.fstatSync(fd).isFile())throw new Error('Temporary checksum manifest is not a regular file.');
    fs.writeFileSync(fd,content,{encoding:'utf8'});
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd=null;
    // Rename is resolved relative to the held directory descriptor. It
    // replaces a destination symlink itself rather than following it.
    fs.renameSync(fdPath(parent.fd,temporary),fdPath(parent.fd,rel));
    fs.fsyncSync(parent.fd);
  } finally {
    if(fd!==null)fs.closeSync(fd);
    try { fs.unlinkSync(fdPath(parent.fd,temporary)); } catch {}
    parent.close();
  }
}

function walkFilesAtFd(dirFd,relative='') {
  const out=[];
  for(const entry of fs.readdirSync(fdPath(dirFd),{withFileTypes:true})) {
    if(entry.name.toLowerCase()==='.git') {
      if(relative===''&&GIT_ROOT&&ROOT_PREFIX==='')continue;
      throw new Error('Unexpected nested .git directory or gitfile detected in release content: '+(relative?relative+'/.git':'.git'));
    }
    const rel=relative?relative+'/'+entry.name:entry.name;
    if(EXCLUDED.has(rel))continue;
    if(entry.isSymbolicLink())throw new Error('Symbolic links are not supported in checksum snapshots: '+rel);
    if(entry.isDirectory()) {
      const childFd=openDirectoryChild(dirFd,entry.name);
      try { out.push(...walkFilesAtFd(childFd,rel)); }
      finally { fs.closeSync(childFd); }
    } else if(entry.isFile())out.push(rel);
    else throw new Error('Unsupported filesystem entry in checksum snapshot: '+rel);
  }
  return out;
}

function assertNoNestedGitAtFd(dirFd,relative='') {
  for(const entry of fs.readdirSync(fdPath(dirFd),{withFileTypes:true})) {
    if(entry.name.toLowerCase()==='.git') {
      if(relative!==''||!GIT_ROOT||ROOT_PREFIX!=='')throw new Error('Unexpected nested .git directory or gitfile detected in release content: '+(relative?relative+'/.git':'.git'));
    } else if(entry.isDirectory()) {
      const rel=relative?relative+'/'+entry.name:entry.name;
      if(rel!=='node_modules'&&!rel.startsWith('node_modules/')) {
        const childFd=openDirectoryChild(dirFd,entry.name);
        try { assertNoNestedGitAtFd(childFd,rel); }
        finally { fs.closeSync(childFd); }
      }
    }
  }
}
if(ROOT.split(path.sep).some(part=>part.toLowerCase()==='.git')) {
  console.error('Checksum root cannot be inside a .git directory: '+ROOT);
  process.exit(1);
}
if(IS_LINUX) {
  try { ROOT_FD=openRootDirectory(ROOT); }
  catch(error) {
    console.error('Checksum root could not be opened safely: '+error.message);
    process.exit(1);
  }
} else {
  console.error(FILESYSTEM
    ? 'Checksum operation failed: Race-resistant checksum root traversal is unsupported on this platform; refusing to continue.'
    : 'Checksum Git mode is supported only on Linux; refusing to use PATH-based Git.');
  process.exit(1);
}
// Filesystem snapshots must be self-contained. A root .git directory or gitfile
// is untrusted executable configuration and must never be silently excluded.
function assertFilesystemRootHasNoGitMetadata() {
  if(!FILESYSTEM)return;
  const gitEntry=fs.readdirSync(ROOT_FD!==null?fdPath(ROOT_FD):ROOT).find(name=>name.toLowerCase()==='.git');
  if(gitEntry)throw new Error('Root .git metadata is not allowed in filesystem mode: '+gitEntry);
}

// Reject symlinks in every component of the selected checksum root. Checking
// only files beneath ROOT is insufficient because --root itself may resolve
// through a symlink (including a symlinked ancestor) into an external tree.
function assertNoSymlinkRootComponents(target) {
  if(ROOT_FD!==null)return;
  const parsed=path.parse(target);
  let current=parsed.root;
  const components=target.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for(const component of components) {
    current=path.join(current,component);
    const componentStat=fs.lstatSync(current);
    if(componentStat.isSymbolicLink()) {
      throw new Error('Checksum root path traverses a symbolic link: '+current);
    }
    if(!componentStat.isDirectory()) {
      throw new Error('Checksum root path component is not a directory: '+current);
    }
  }
}
// Filesystem mode deliberately avoids invoking Git at all. In particular, do
// not let an untrusted snapshot's Git configuration influence verification.
const gitRootResult=FILESYSTEM?null:gitAt(START,['rev-parse','--show-toplevel']);
const GIT_ROOT=gitRootResult&&gitRootResult.status===0?path.resolve(gitRootResult.stdout.trim()):null;
let ROOT_PREFIX='';
if(GIT_ROOT) {
  const relative=path.relative(GIT_ROOT,ROOT);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)) {
    console.error('--root must be inside the current Git worktree.');
    process.exit(1);
  }
  ROOT_PREFIX=relative?relative.split(path.sep).join('/')+'/':'';
}

function runGit(args,{allowDiff=false}={}) {
  if(!GIT_ROOT)throw new Error('This operation requires a Git worktree.');
  const r=gitAt(GIT_ROOT,args);
  if(allowDiff) {
    if(r.status===0)return;
    if(r.status===1)throw new Error('Repository has changes outside '+MANIFEST+' and '+SIGNATURE+'. Commit all release files first and ensure the worktree matches HEAD before creating a manifest.');
    throw new Error('git '+args.join(' ')+' failed: '+(r.stderr||'exit '+r.status).trim());
  }
  if(r.status!==0)throw new Error('git '+args.join(' ')+' failed: '+(r.stderr||'exit '+r.status).trim());
  return r.stdout;
}

function listGitPaths(args) {
  return runGit(args).split('\0').filter(Boolean)
    .filter(p=>!ROOT_PREFIX||p.startsWith(ROOT_PREFIX))
    .map(p=>ROOT_PREFIX?p.slice(ROOT_PREFIX.length):p);
}

function rootPathspec() {
  return ROOT_PREFIX?ROOT_PREFIX.slice(0,-1):'.';
}
function excludedPathspecs() {
  return [':(exclude)'+ROOT_PREFIX+MANIFEST,':(exclude)'+ROOT_PREFIX+SIGNATURE];
}

function assertNoNonDefaultIndexFlags() {
  if(!GIT_ROOT||FILESYSTEM)return;
  const raw=runGit(['ls-files','-v','-z','--',rootPathspec()]);
  const entries=raw.split('\0').filter(Boolean);
  const flagged=[];
  for(const item of entries) {
    const tag=item.charAt(0);
    const gitPath=item.slice(2);
    if(tag!=='H') {
      const rel=ROOT_PREFIX&&gitPath.startsWith(ROOT_PREFIX)?gitPath.slice(ROOT_PREFIX.length):gitPath;
      flagged.push(`${rel} (flag '${tag}')`);
    }
  }
  if(flagged.length) {
    throw new Error('Non-default Git index flags detected (assume-unchanged / skip-worktree / unmerged): '+flagged.join(', '));
  }
}

function assertNoUnexpectedUntracked() {
  if(!GIT_ROOT||FILESYSTEM)return;
  const ordinary=listGitPaths(['ls-files','--others','--exclude-standard','-z','--',rootPathspec()]);
  const ignored=listGitPaths(['ls-files','--others','--ignored','--exclude-standard','-z','--',rootPathspec()]);
  const extras=[...new Set([...ordinary,...ignored])].filter(p=>{
    if(EXCLUDED.has(p))return false;
    if(p==='dist'||p==='dist/bundles'||p.startsWith('dist/bundles/'))return false;
    if(p==='node_modules'||p.startsWith('node_modules/'))return false;
    return true;
  });
  if(extras.length)throw new Error('Untracked or ignored files outside dist/bundles must be staged or removed: '+extras.join(', '));
}

function assertNoNestedGit(dir=ROOT,relative='') {
  if(ROOT_FD!==null)return assertNoNestedGitAtFd(ROOT_FD,relative);
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name.toLowerCase()==='.git') {
      // Only the selected repository's own metadata is allowed. When --root
      // selects a vendored subdirectory, a .git entry at that selected root
      // is nested metadata and must be rejected too.
      if(relative!==''||!GIT_ROOT||ROOT_PREFIX!=='') {
        throw new Error('Unexpected nested .git directory or gitfile detected in release content: '+(relative?relative+'/.git':'.git'));
      }
    } else if(entry.isDirectory()) {
      const rel=relative?relative+'/'+entry.name:entry.name;
      if(rel!=='node_modules'&&!rel.startsWith('node_modules/')) {
        assertNoNestedGit(path.join(dir,entry.name),rel);
      }
    }
  }
}

function assertSafePath(rel) {
  if(!rel||rel.includes('\n')||rel.includes('\r')||rel.includes('\\')||rel.startsWith('/')||/^[A-Za-z]:/.test(rel)||rel.split('/').some(p=>p==='..'||p==='.'||p==='')) {
    throw new Error('Unsafe or unsupported repository path: '+JSON.stringify(rel));
  }
  const parts=rel.split('/');
  if(parts.some(part=>part.toLowerCase()==='.git')) {
    throw new Error('Unexpected .git entry detected in release path: '+rel);
  }
  const absolute=path.resolve(ROOT,...parts);
  const relative=path.relative(ROOT,absolute);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Path escapes checksum root: '+rel);
  if(ROOT_FD!==null)return absolute;
  // lstat every parent as well as the leaf. lstat(leaf) follows symlinks in
  // parent components, so checking only the final file would miss a directory
  // replaced by a symlink to attacker-controlled content.
  let parent=ROOT;
  for(const part of parts.slice(0,-1)) {
    parent=path.join(parent,part);
    const parentStat=fs.lstatSync(parent);
    if(!parentStat.isDirectory()||parentStat.isSymbolicLink()) {
      throw new Error('Path traverses a non-directory or symbolic-link parent: '+rel);
    }
  }
  const stat=fs.lstatSync(absolute);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only regular files can be checksummed: '+rel);
  return absolute;
}

function executableMode(absolute) {
  return (fs.statSync(absolute).mode&0o111)!==0?'100755':'100644';
}

function gitModeForPath(rel) {
  const gitPath=ROOT_PREFIX+rel;
  const r=gitAt(GIT_ROOT,['ls-tree','-z','HEAD','--',gitPath],{encoding:null});
  if(r.error||r.status!==0)throw new Error('Unable to read committed file mode from HEAD: '+rel);
  const records=r.stdout.toString('utf8').split('\0').filter(Boolean);
  if(records.length!==1)throw new Error('Expected exactly one committed tree entry for: '+rel);
  const match=/^(100644|100755) blob [a-f0-9]+\t/.exec(records[0]);
  if(!match)throw new Error('Unsupported committed file mode for checksum path: '+rel);
  return match[1];
}

function digestBytes(mode,bytes) {
  // USS uses a mode-bound digest, not the conventional raw-file sha256sum
  // format: bind the normalized executable mode and file bytes together.
  // Consumers must verify entries with this tool, not `sha256sum -c`.
  // Bind the executable bit to the digest as well as the file contents.
  return createHash('sha256').update(mode).update('\0').update(bytes).digest('hex');
}

function sha256ForPath(rel) {
  const absolute=assertSafePath(rel);
  const opened=ROOT_FD!==null?readRegularFileAtRoot(rel):null;
  const diskBytes=opened?opened.bytes:fs.readFileSync(absolute);
  let mode=opened?opened.mode:executableMode(absolute);
  if(GIT_ROOT&&!FILESYSTEM) {
    const gitPath=ROOT_PREFIX+rel;
    const headMode=gitModeForPath(rel);
    // Windows worktrees commonly do not expose Git's executable bit through
    // stat(2); use the committed tree mode there. On POSIX, reject any drift.
    if(process.platform!=='win32'&&mode!==headMode)throw new Error('Working-tree executable mode differs from committed HEAD: '+rel);
    mode=headMode;
    const r=gitAt(GIT_ROOT,['show','HEAD:'+gitPath],{encoding:null});
    if(r.error||r.status!==0)throw new Error('Unable to read committed file from HEAD: '+rel);
    const headBytes=r.stdout;
    if(diskBytes.equals(headBytes))return digestBytes(mode,diskBytes);
    // Allow Windows CRLF conversion if and only if normalized LF bytes match committed HEAD
    const normalized=Buffer.from(diskBytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
    if(normalized.equals(headBytes))return digestBytes(mode,headBytes);
    throw new Error('Working-tree bytes differ from committed HEAD: '+rel);
  }
  return digestBytes(mode,diskBytes);
}

function walkFiles(dir=ROOT,relative='') {
  if(ROOT_FD!==null)return walkFilesAtFd(ROOT_FD,relative);
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name.toLowerCase()==='.git') {
      if(relative===''&&GIT_ROOT&&ROOT_PREFIX==='') {
        continue;
      }
      throw new Error('Unexpected nested .git directory or gitfile detected in release content: '+(relative?relative+'/.git':'.git'));
    }
    const rel=relative?relative+'/'+entry.name:entry.name;
    if(EXCLUDED.has(rel))continue;
    const full=path.join(dir,entry.name);
    if(entry.isSymbolicLink())throw new Error('Symbolic links are not supported in checksum snapshots: '+rel);
    if(entry.isDirectory())out.push(...walkFiles(full,rel));
    else if(entry.isFile())out.push(rel);
    else throw new Error('Unsupported filesystem entry in checksum snapshot: '+rel);
  }
  return out;
}

function trackedFiles() {
  if(GIT_ROOT&&!FILESYSTEM)return listGitPaths(['ls-files','-z','--',rootPathspec()]).filter(p=>!EXCLUDED.has(p)).sort();
  return walkFiles().sort();
}

function createManifest() {
  if(GIT_ROOT&&!FILESYSTEM) {
    assertNoNestedGit();
    assertNoNonDefaultIndexFlags();
    // Compare each worktree file directly with its committed HEAD blob in
    // sha256ForPath(). Do not run "git diff" against the worktree here: Git may
    // execute repository-configured clean filters while preparing that diff.
    // The cached diff is index-to-HEAD only and does not read/clean worktree files.
    runGit(['diff','--cached','--quiet','--no-ext-diff','--no-textconv','HEAD','--',rootPathspec(),...excludedPathspecs()],{allowDiff:true});
  }
  const files=trackedFiles();
  if(!files.length)throw new Error('No tracked files found to checksum.');
  const lines=files.map(rel=>{assertSafePath(rel);return sha256ForPath(rel)+'  '+rel;});
  // Validate unexpected untracked content after tracked-path checks so a
  // tracked path replaced by a symlinked parent is reported at that boundary.
  if(GIT_ROOT&&!FILESYSTEM)assertNoUnexpectedUntracked();
  const manifestText=lines.join('\n')+'\n';
  if(ROOT_FD!==null)writeRegularFileAtRoot(MANIFEST,manifestText);
  else fs.writeFileSync(path.join(ROOT,MANIFEST),manifestText,{encoding:'utf8'});
  console.log('Created '+MANIFEST+' for '+files.length+' files (excluding '+MANIFEST+' and '+SIGNATURE+').');
}

function verifyManifest() {
  if(GIT_ROOT&&!FILESYSTEM) {
    assertNoNestedGit();
    assertNoNonDefaultIndexFlags();
    // Compare each worktree file directly with its committed HEAD blob in
    // sha256ForPath(). Do not run "git diff" against the worktree here: Git may
    // execute repository-configured clean filters while preparing that diff.
    // The cached diff is index-to-HEAD only and does not read/clean worktree files.
    runGit(['diff','--cached','--quiet','--no-ext-diff','--no-textconv','HEAD','--',rootPathspec(),...excludedPathspecs()],{allowDiff:true});
  }
  const manifestPath=path.join(ROOT,MANIFEST);
  let raw;
  try {
    raw=(ROOT_FD!==null?readRegularFileAtRoot(MANIFEST).bytes:fs.readFileSync(manifestPath)).toString('utf8');
  } catch(error) {
    if(error.code==='ENOENT')throw new Error('Missing '+MANIFEST+'.');
    throw error;
  }
  const lines=raw.replace(/\r/g,'').split('\n').filter(Boolean);
  const entries=[];
  for(const line of lines) {
    const match=/^([a-f0-9]{64})  (.+)$/.exec(line);
    if(!match)throw new Error('Malformed checksum line: '+line);
    const [,digest,rel]=match;
    if(EXCLUDED.has(rel))throw new Error('Manifest must not include itself or its signature: '+rel);
    assertSafePath(rel);
    entries.push({digest,rel});
  }
  const names=entries.map(x=>x.rel);
  if(new Set(names).size!==names.length)throw new Error('Duplicate path in '+MANIFEST+'.');
  const expected=trackedFiles();
  if(JSON.stringify(names)!==JSON.stringify(expected)) {
    const missing=expected.filter(p=>!names.includes(p));
    const unexpected=names.filter(p=>!expected.includes(p));
    throw new Error('Checksum file set does not match release files. Missing: '+(missing.join(', ')||'none')+'. Unexpected: '+(unexpected.join(', ')||'none')+'.');
  }
  for(const {digest,rel} of entries) {
    const actualDigest=sha256ForPath(rel);
    if(actualDigest!==digest)throw new Error('SHA-256 mismatch: '+rel);
  }
  if(GIT_ROOT&&!FILESYSTEM)assertNoUnexpectedUntracked();
  console.log('Verified '+entries.length+' file digests in '+MANIFEST+'.');
}

try {
  // Keep this inside the guarded operation so hostile .git metadata produces
  // a controlled diagnostic rather than an uncaught exception and stack trace.
  if(ROOT_FD===null)assertNoSymlinkRootComponents(ROOT);
  assertFilesystemRootHasNoGitMetadata();
  if(command==='create')createManifest();
  else if(command==='verify')verifyManifest();
  else {
    console.error('Usage: node tools/checksums.mjs <create|verify> [--root <directory>] [--filesystem]');
    process.exitCode=2;
  }
} catch(error) {
  console.error('Checksum operation failed: '+error.message);
  process.exitCode=1;
} finally {
  if(ROOT_FD!==null)try { fs.closeSync(ROOT_FD); } catch {}
}
