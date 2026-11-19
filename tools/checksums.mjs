#!/usr/bin/env node
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const MANIFEST='SHA256SUMS';
const SIGNATURE='SHA256SUMS.sig';
const EXCLUDED=new Set([MANIFEST,SIGNATURE]);

function runGit(args,{allowDiff=false}={}) {
  const r=spawnSync('git',args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(r.error)throw new Error('Unable to run git: '+r.error.message);
  if(allowDiff) {
    if(r.status===0)return;
    if(r.status===1)throw new Error('Working tree has changes outside '+MANIFEST+' and '+SIGNATURE+'. Stage intended changes and ensure the worktree matches the index before creating a manifest.');
    throw new Error('git '+args.join(' ')+' failed: '+(r.stderr||'exit '+r.status).trim());
  } else if(r.status!==0) {
    throw new Error('git '+args.join(' ')+' failed: '+(r.stderr||'exit '+r.status).trim());
  }
  return r.stdout;
}

const rootResult=spawnSync('git',['rev-parse','--show-toplevel'],{cwd:process.cwd(),encoding:'utf8'});
if(rootResult.error||rootResult.status!==0) {
  console.error('Run this command from inside a Git repository.');
  process.exit(1);
}
const ROOT=rootResult.stdout.trim();

function listGitPaths(args) {
  return runGit(args).split('\0').filter(Boolean);
}

function assertNoUnexpectedUntracked() {
  const extras=listGitPaths(['ls-files','--others','--exclude-standard','-z']).filter(p=>!EXCLUDED.has(p));
  if(extras.length)throw new Error('Untracked files must be staged before checksum creation or removed: '+extras.join(', '));
}

function assertSafePath(rel) {
  if(!rel||rel.includes('\n')||rel.includes('\r')||rel.includes('\\')||rel.startsWith('/')||/^[A-Za-z]:/.test(rel)||rel.split('/').some(p=>p==='..'||p==='.'||p==='')) {
    throw new Error('Unsafe or unsupported repository path: '+JSON.stringify(rel));
  }
  const absolute=path.resolve(ROOT,...rel.split('/'));
  const relative=path.relative(ROOT,absolute);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Path escapes repository: '+rel);
  const stat=fs.lstatSync(absolute);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Only regular files can be checksummed: '+rel);
  return absolute;
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function trackedFiles() {
  return listGitPaths(['ls-files','-z']).filter(p=>!EXCLUDED.has(p)).sort();
}

function createManifest() {
  runGit(['diff','--quiet','--','.',':(exclude)'+MANIFEST,':(exclude)'+SIGNATURE],{allowDiff:true});
  assertNoUnexpectedUntracked();
  const files=trackedFiles();
  if(!files.length)throw new Error('No tracked files found to checksum.');
  const lines=files.map(rel=>sha256(assertSafePath(rel))+'  '+rel);
  fs.writeFileSync(path.join(ROOT,MANIFEST),lines.join('\n')+'\n',{encoding:'utf8'});
  console.log('Created '+MANIFEST+' for '+files.length+' tracked files (excluding '+MANIFEST+' and '+SIGNATURE+').');
}

function verifyManifest() {
  runGit(['diff','--quiet','HEAD','--','.',':(exclude)'+MANIFEST,':(exclude)'+SIGNATURE],{allowDiff:true});
  assertNoUnexpectedUntracked();
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
  const actual=names;
  if(JSON.stringify(actual)!==JSON.stringify(expected)) {
    const missing=expected.filter(p=>!names.includes(p));
    const unexpected=names.filter(p=>!expected.includes(p));
    throw new Error('Checksum file set does not match tracked repository files. Missing: '+(missing.join(', ')||'none')+'. Unexpected: '+(unexpected.join(', ')||'none')+'.');
  }
  for(const {digest,rel} of entries) {
    const actualDigest=sha256(assertSafePath(rel));
    if(actualDigest!==digest)throw new Error('SHA-256 mismatch: '+rel);
  }
  console.log('Verified '+entries.length+' file digests in '+MANIFEST+'.');
}

const command=process.argv[2];
try {
  if(command==='create')createManifest();
  else if(command==='verify')verifyManifest();
  else {
    console.error('Usage: node tools/checksums.mjs <create|verify>');
    process.exitCode=2;
  }
} catch(error) {
  console.error('Checksum operation failed: '+error.message);
  process.exitCode=1;
}
