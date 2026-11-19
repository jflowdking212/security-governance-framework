import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const TOOL=fileURLToPath(new URL('../tools/checksums.mjs',import.meta.url));

function git(cwd,...args) {
  const r=spawnSync('git',args,{cwd,encoding:'utf8'});
  assert.equal(r.status,0,'git '+args.join(' ')+' failed: '+r.stderr);
}
function fixture() {
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'uss-checksums-'));
  git(cwd,'init','-q');
  git(cwd,'config','user.name','USS Test');
  git(cwd,'config','user.email','uss-test@example.invalid');
  fs.writeFileSync(path.join(cwd,'README.md'),'trusted test content\n');
  fs.writeFileSync(path.join(cwd,'KERNEL.md'),'kernel test content\n');
  git(cwd,'add','README.md','KERNEL.md');
  git(cwd,'commit','-m','fixture');
  return cwd;
}
function run(cwd,command) {
  return spawnSync(process.execPath,[TOOL,command],{cwd,encoding:'utf8'});
}

test('checksum tool creates a deterministic manifest and verifies it',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const first=run(cwd,'create');
  assert.equal(first.status,0,first.stderr);
  const manifest=fs.readFileSync(path.join(cwd,'SHA256SUMS'),'utf8');
  assert.match(manifest,/^[a-f0-9]{64}  KERNEL\.md\n[a-f0-9]{64}  README\.md\n$/);
  git(cwd,'add','SHA256SUMS');
  git(cwd,'commit','-m','add checksum manifest');
  const verified=run(cwd,'verify');
  assert.equal(verified.status,0,verified.stderr);
});

test('verification rejects content modified after the manifest was created',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add checksum manifest');
  fs.writeFileSync(path.join(cwd,'README.md'),'tampered content\n');
  git(cwd,'add','README.md');git(cwd,'commit','-m','tamper tracked content');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/SHA-256 mismatch: README\.md/);
});

test('verification rejects files added after the manifest was created',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add checksum manifest');
  fs.writeFileSync(path.join(cwd,'NEW-POLICY.md'),'unlisted policy\n');
  git(cwd,'add','NEW-POLICY.md');git(cwd,'commit','-m','add unlisted file');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Checksum file set does not match tracked repository files/);
});

test('manifest creation refuses unstaged untracked files',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  fs.writeFileSync(path.join(cwd,'untracked.txt'),'not staged\n');
  const result=run(cwd,'create');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Untracked files must be staged/);
});
