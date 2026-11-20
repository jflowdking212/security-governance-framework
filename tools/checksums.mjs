#!/usr/bin/env node
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const MANIFEST='SHA256SUMS';
const SIGNATURE='SHA256SUMS.sig';
const EXCLUDED=new Set([MANIFEST,SIGNATURE]);

function gitAt(cwd,args) {
  const r=spawnSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
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
if(ROOT.split(path.sep).includes('.git')) {
  console.error('Checksum root cannot be inside a .git directory: '+ROOT);
  process.exit(1);
}
if(!fs.existsSync(ROOT)||!fs.statSync(ROOT).isDirectory()) {
  console.error('Checksum root does not exist or is not a directory: '+ROOT);
  process.exit(1);
}
// Filesystem snapshots must be self-contained. A root .git directory or gitfile
// is untrusted executable configuration and must never be silently excluded.
function assertFilesystemRootHasNoGitMetadata() {
  if(!FILESYSTEM)return;
  const metadataPath=path.join(ROOT,'.git');
  try {
    fs.lstatSync(metadataPath);
  } catch(error) {
    if(error.code==='ENOENT')return;
    throw error;
  }
  throw new Error('Root .git metadata is not allowed in filesystem mode: .git');
}
assertFilesystemRootHasNoGitMetadata();

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
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name==='.git') {
      if(relative!=='') {
        throw new Error('Unexpected nested .git directory detected in release content: '+(relative?relative+'/.git':'.git'));
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
  if(parts.includes('.git')) {
    throw new Error('Unexpected .git entry detected in release path: '+rel);
  }
  const absolute=path.resolve(ROOT,...parts);
  const relative=path.relative(ROOT,absolute);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Path escapes checksum root: '+rel);
  const stat=fs.lstatSync(absolute);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only regular files can be checksummed: '+rel);
  return absolute;
}

function sha256ForPath(rel) {
  const absolute=assertSafePath(rel);
  const diskBytes=fs.readFileSync(absolute);
  if(GIT_ROOT&&!FILESYSTEM) {
    const gitPath=ROOT_PREFIX+rel;
    const r=spawnSync('git',['show','HEAD:'+gitPath],{cwd:GIT_ROOT,encoding:null});
    if(r.error||r.status!==0)throw new Error('Unable to read committed file from HEAD: '+rel);
    const headBytes=r.stdout;
    if(diskBytes.equals(headBytes)) {
      return createHash('sha256').update(diskBytes).digest('hex');
    }
    // Allow Windows CRLF conversion if and only if normalized LF bytes match committed HEAD
    const normalized=Buffer.from(diskBytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
    if(normalized.equals(headBytes)) {
      return createHash('sha256').update(headBytes).digest('hex');
    }
    throw new Error('Working-tree bytes differ from committed HEAD: '+rel);
  }
  return createHash('sha256').update(diskBytes).digest('hex');
}

function walkFiles(dir=ROOT,relative='') {
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name==='.git') {
      if(relative==='') {
        if(FILESYSTEM)throw new Error('Root .git metadata is not allowed in filesystem mode: .git');
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
    runGit(['diff','--quiet','HEAD','--',rootPathspec(),...excludedPathspecs()],{allowDiff:true});
    runGit(['diff','--cached','--quiet','HEAD','--',rootPathspec(),...excludedPathspecs()],{allowDiff:true});
    assertNoUnexpectedUntracked();
  }
  const files=trackedFiles();
  if(!files.length)throw new Error('No tracked files found to checksum.');
  const lines=files.map(rel=>{assertSafePath(rel);return sha256ForPath(rel)+'  '+rel;});
  fs.writeFileSync(path.join(ROOT,MANIFEST),lines.join('\n')+'\n',{encoding:'utf8'});
  console.log('Created '+MANIFEST+' for '+files.length+' files (excluding '+MANIFEST+' and '+SIGNATURE+').');
}

function verifyManifest() {
  if(GIT_ROOT&&!FILESYSTEM) {
    assertNoNestedGit();
    assertNoNonDefaultIndexFlags();
    runGit(['diff','--quiet','HEAD','--',rootPathspec(),...excludedPathspecs()],{allowDiff:true});
    runGit(['diff','--cached','--quiet','HEAD','--',rootPathspec(),...excludedPathspecs()],{allowDiff:true});
    assertNoUnexpectedUntracked();
  }
  const manifestPath=path.join(ROOT,MANIFEST);
  if(!fs.existsSync(manifestPath))throw new Error('Missing '+MANIFEST+'.');
  const raw=fs.readFileSync(manifestPath,'utf8');
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
  console.log('Verified '+entries.length+' file digests in '+MANIFEST+'.');
}

try {
  if(command==='create')createManifest();
  else if(command==='verify')verifyManifest();
  else {
    console.error('Usage: node tools/checksums.mjs <create|verify> [--root <directory>] [--filesystem]');
    process.exitCode=2;
  }
} catch(error) {
  console.error('Checksum operation failed: '+error.message);
  process.exitCode=1;
}
