#!/usr/bin/env node
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {openSecureDirectory} from './secure-root.mjs';

const MANIFEST='SHA256SUMS';
const SIGNATURE='SHA256SUMS.sig';
const EXCLUDED=new Set([MANIFEST,SIGNATURE]);

function gitAt(cwd,args,{encoding='utf8'}={}) {
  // Repository-local core.fsmonitor is executable configuration. Disable it for
  // every Git invocation made by this verifier, including index enumeration.
  const r=spawnSync('git',['-c','core.fsmonitor=false',...args],{cwd,encoding,stdio:['ignore','pipe','pipe']});
  if(r.error)throw new Error('Unable to run git: '+r.error.message);
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
let ROOT_HANDLE;
let ROOT_IO;
if(ROOT.split(path.sep).some(part=>part.toLowerCase()==='.git')) {
  console.error('Checksum root cannot be inside a .git directory: '+ROOT);
  process.exit(1);
}
// Filesystem snapshots must be self-contained. A root .git directory or gitfile
// is untrusted executable configuration and must never be silently excluded.
function assertFilesystemRootHasNoGitMetadata() {
  if(!FILESYSTEM)return;
  const gitEntry=fs.readdirSync(ROOT_IO).find(name=>name.toLowerCase()==='.git');
  if(gitEntry)throw new Error('Root .git metadata is not allowed in filesystem mode: '+gitEntry);
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

function assertNoNestedGit(dirFd=ROOT_HANDLE.fd,relative='') {
  for(const entry of fs.readdirSync('/proc/self/fd/'+dirFd,{withFileTypes:true})) {
    if(entry.name.toLowerCase()==='.git') {
      if(relative!==''||!GIT_ROOT||ROOT_PREFIX!=='') {
        throw new Error('Unexpected nested .git directory or gitfile detected in release content: '+(relative?relative+'/.git':'.git'));
      }
    } else if(entry.isDirectory()) {
      const rel=relative?relative+'/'+entry.name:entry.name;
      if(rel!=='node_modules'&&!rel.startsWith('node_modules/')) {
        const childFd=openDirectoryAt(dirFd,entry.name);
        try {
          const actual=fs.fstatSync(childFd);
          if(actual.dev!==entry.dev||actual.ino!==entry.ino)throw new Error('Filesystem directory changed during checksum traversal: '+rel);
          assertNoNestedGit(childFd,rel);
        } finally {fs.closeSync(childFd);}
      }
    } else if(entry.isSymbolicLink()) {
      throw new Error('Symbolic links are not supported in checksum snapshots: '+(relative?relative+'/':'')+entry.name);
    }
  }
}

function pathParts(rel) {
  if(!rel||rel.includes('\n')||rel.includes('\r')||rel.includes('\\')||rel.startsWith('/')||/^[A-Za-z]:/.test(rel)||rel.split('/').some(p=>p==='..'||p==='.'||p==='')) {
    throw new Error('Unsafe or unsupported repository path: '+JSON.stringify(rel));
  }
  const parts=rel.split('/');
  if(parts.some(part=>part.toLowerCase()==='.git'))throw new Error('Unexpected .git entry detected in release path: '+rel);
  return parts;
}

const DIRECTORY_FLAGS=fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW|(fs.constants.O_CLOEXEC||0);
const FILE_FLAGS=fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|(fs.constants.O_NONBLOCK||0)|(fs.constants.O_CLOEXEC||0);

function openDirectoryAt(parentFd,name) {
  const fd=fs.openSync('/proc/self/fd/'+parentFd+'/'+name,DIRECTORY_FLAGS);
  const stat=fs.fstatSync(fd);
  if(!stat.isDirectory()){fs.closeSync(fd);throw new Error('Path component is not a directory: '+name);}
  return fd;
}

function openRegularFileAt(parentFd,name,expectedEntry) {
  const fd=fs.openSync('/proc/self/fd/'+parentFd+'/'+name,FILE_FLAGS);
  try {
    const stat=fs.fstatSync(fd);
    if(!stat.isFile())throw new Error('Only regular files can be checksummed: '+name);
    if(expectedEntry && (stat.dev!==expectedEntry.dev || stat.ino!==expectedEntry.ino)) {
      throw new Error('Filesystem entry changed during checksum traversal: '+name);
    }
    return {fd,stat,close(){fs.closeSync(fd);}};
  } catch(error) {
    fs.closeSync(fd);
    throw error;
  }
}

function openRegularFile(rel) {
  const parts=pathParts(rel);
  const opened=[];
  let parentFd=ROOT_HANDLE.fd;
  try {
    for(const part of parts.slice(0,-1)) {
      const nextFd=openDirectoryAt(parentFd,part);
      opened.push(nextFd);
      parentFd=nextFd;
    }
    return openRegularFileAt(parentFd,parts[parts.length-1]);
  } catch(error) {
    if(error.code==='ELOOP'||error.code==='ENOTDIR') {
      throw new Error('Path traverses a symbolic link or non-directory parent: '+rel);
    }
    throw error;
  } finally {
    for(let i=opened.length-1;i>=0;i--)try{fs.closeSync(opened[i]);}catch{}
  }
}

function executableMode(stat) {
  return (stat.mode&0o111)!==0?'100755':'100644';
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
  const opened=openRegularFile(rel);
  try {
    const diskBytes=fs.readFileSync(opened.fd);
    let mode=executableMode(opened.stat);
    if(GIT_ROOT&&!FILESYSTEM) {
      const gitPath=ROOT_PREFIX+rel;
      const headMode=gitModeForPath(rel);
      if(process.platform!=='win32'&&mode!==headMode)throw new Error('Working-tree executable mode differs from committed HEAD: '+rel);
      mode=headMode;
      const r=gitAt(GIT_ROOT,['show','HEAD:'+gitPath],{encoding:null});
      if(r.error||r.status!==0)throw new Error('Unable to read committed file from HEAD: '+rel);
      const headBytes=r.stdout;
      if(diskBytes.equals(headBytes))return digestBytes(mode,diskBytes);
      const normalized=Buffer.from(diskBytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
      if(normalized.equals(headBytes))return digestBytes(mode,headBytes);
      throw new Error('Working-tree bytes differ from committed HEAD: '+rel);
    }
    return digestBytes(mode,diskBytes);
  } finally {opened.close();}
}

function walkFiles(dirFd=ROOT_HANDLE.fd,relative='') {
  const out=[];
  for(const entry of fs.readdirSync('/proc/self/fd/'+dirFd,{withFileTypes:true})) {
    if(entry.name.toLowerCase()==='.git') {
      if(relative===''&&GIT_ROOT&&ROOT_PREFIX==='')continue;
      throw new Error('Unexpected nested .git directory or gitfile detected in release content: '+(relative?relative+'/.git':'.git'));
    }
    const rel=relative?relative+'/'+entry.name:entry.name;
    if(EXCLUDED.has(rel))continue;
    if(entry.isSymbolicLink())throw new Error('Symbolic links are not supported in checksum snapshots: '+rel);
    if(entry.isDirectory()) {
      const childFd=openDirectoryAt(dirFd,entry.name);
      try {
        const actual=fs.fstatSync(childFd);
        if(actual.dev!==entry.dev||actual.ino!==entry.ino)throw new Error('Filesystem directory changed during checksum traversal: '+rel);
        out.push(...walkFiles(childFd,rel));
      } finally {fs.closeSync(childFd);}
    } else if(entry.isFile()) {
      const opened=openRegularFileAt(dirFd,entry.name,entry);
      opened.close();
      out.push(rel);
    } else throw new Error('Unsupported filesystem entry in checksum snapshot: '+rel);
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
  const lines=files.map(rel=>sha256ForPath(rel)+'  '+rel);
  // Validate unexpected untracked content after tracked-path checks so a
  // tracked path replaced by a symlinked parent is reported at that boundary.
  if(GIT_ROOT&&!FILESYSTEM)assertNoUnexpectedUntracked();
  fs.writeFileSync(path.join(ROOT_IO,MANIFEST),lines.join('\n')+'\n',{encoding:'utf8'});
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
  const manifestPath=path.join(ROOT_IO,MANIFEST);
  if(!fs.existsSync(manifestPath))throw new Error('Missing '+MANIFEST+'.');
  const raw=fs.readFileSync(manifestPath,'utf8');
  const lines=raw.replace(/\r/g,'').split('\n').filter(Boolean);
  const entries=[];
  for(const line of lines) {
    const match=/^([a-f0-9]{64})  (.+)$/.exec(line);
    if(!match)throw new Error('Malformed checksum line: '+line);
    const [,digest,rel]=match;
    if(EXCLUDED.has(rel))throw new Error('Manifest must not include itself or its signature: '+rel);
    pathParts(rel);
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
  ROOT_HANDLE=openSecureDirectory(ROOT);
  ROOT_IO=ROOT_HANDLE.path;
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
  if(ROOT_HANDLE)ROOT_HANDLE.close();
}
