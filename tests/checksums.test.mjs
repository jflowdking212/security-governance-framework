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
  git(cwd,'config','commit.gpgsign','false');
  fs.writeFileSync(path.join(cwd,'README.md'),'trusted test content\n');
  fs.writeFileSync(path.join(cwd,'KERNEL.md'),'kernel test content\n');
  git(cwd,'add','README.md','KERNEL.md');
  git(cwd,'commit','-m','fixture');
  return cwd;
}
function run(cwd,command,...args) {
  return spawnSync(process.execPath,[TOOL,command,...args],{cwd,encoding:'utf8'});
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

test('verification works on an extracted release snapshot without Git metadata',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  const bundle=fs.mkdtempSync(path.join(os.tmpdir(),'uss-bundle-'));
  t.after(()=>fs.rmSync(bundle,{recursive:true,force:true}));
  for(const file of ['README.md','KERNEL.md','SHA256SUMS']) {
    fs.copyFileSync(path.join(cwd,file),path.join(bundle,file));
  }
  const verified=run(bundle,'verify');
  assert.equal(verified.status,0,verified.stderr);
});

test('root option verifies a vendored USS subtree inside another Git repository',t=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'uss-vendor-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  git(cwd,'init','-q');
  git(cwd,'config','user.name','USS Test');
  git(cwd,'config','user.email','uss-test@example.invalid');
  fs.mkdirSync(path.join(cwd,'vendor','uss'),{recursive:true});
  fs.writeFileSync(path.join(cwd,'README.md'),'consumer project\n');
  fs.writeFileSync(path.join(cwd,'vendor','uss','KERNEL.md'),'vendored policy\n');
  git(cwd,'add','README.md','vendor/uss/KERNEL.md');
  git(cwd,'commit','-m','vendor fixture');
  const created=run(cwd,'create','--root','vendor/uss');
  assert.equal(created.status,0,created.stderr);
  git(cwd,'add','vendor/uss/SHA256SUMS');
  git(cwd,'commit','-m','add vendored checksum manifest');
  const verified=run(cwd,'verify','--root','vendor/uss');
  assert.equal(verified.status,0,verified.stderr);
});

test('filesystem mode creates and verifies a separate manifest for generated release bundles',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const bundle=path.join(cwd,'dist','bundles');
  fs.mkdirSync(bundle,{recursive:true});
  fs.writeFileSync(path.join(bundle,'payments.md'),'compiled payments bundle\n');
  fs.writeFileSync(path.join(bundle,'full-audit.md'),'compiled audit bundle\n');
  const created=run(cwd,'create','--root','dist/bundles','--filesystem');
  assert.equal(created.status,0,created.stderr);
  const manifest=fs.readFileSync(path.join(bundle,'SHA256SUMS'),'utf8');
  assert.match(manifest,/payments\.md/);
  assert.match(manifest,/full-audit\.md/);
  const verified=run(cwd,'verify','--root','dist/bundles','--filesystem');
  assert.equal(verified.status,0,verified.stderr);
  fs.writeFileSync(path.join(bundle,'payments.md'),'tampered bundle\n');
  const rejected=run(cwd,'verify','--root','dist/bundles','--filesystem');
  assert.notEqual(rejected.status,0);
  assert.match(rejected.stderr,/SHA-256 mismatch: payments\.md/);
});
